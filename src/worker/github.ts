/**
 * GitHub API integration for the auto-update system.
 *
 * Uses the Compare API to discover exactly which files changed between the
 * user's current version tag and the latest release. This eliminates the need
 * for a manually maintained file manifest - git history IS the manifest.
 *
 * Exclusion list: a small, stable set of paths that should never be overwritten
 * (user configs, migrations, env files).
 */

import type { Env } from "./types";

/** Paths that should NEVER be auto-updated (user-specific configs). */
const EXCLUDED_PATHS = [
  "wrangler.toml",
  "wrangler.local.toml",
  ".env",
  ".dev.vars",
];

/** Path prefixes that should never be auto-updated. */
const EXCLUDED_PREFIXES = [
  ".git/",
  "node_modules/",
  "dist/",
  ".wrangler/",
  "docs/",
  "scripts/", // Release tooling - not needed in user repos
];

const UPSTREAM_OWNER = "ranajahanzaib";
const UPSTREAM_REPO = "waichat";

export interface FileChange {
  path: string;
  status: "added" | "modified" | "removed" | "renamed";
  downloadUrl: string;
}

export interface CommitFile {
  path: string;
  content: string;
}

export interface GitTreeItem {
  path: string;
  mode: "100644" | "100755" | "040000" | "160000" | "120000";
  type: "blob" | "tree" | "commit";
  sha: string | null;
}

function isExcluded(path: string): boolean {
  // Never overwrite secrets or infrastructure config
  if (EXCLUDED_PATHS.includes(path)) return true;

  // Never overwrite local databases
  if (path.endsWith(".sqlite") || path.endsWith(".db")) return true;

  // Never touch internal folders
  return EXCLUDED_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/** UTF-8 safe Base64 encoding using Worker's nodejs_compat. */
function toBase64(str: string): string {
  // Use globalThis cast to avoid TypeScript errors without @types/node
  return (globalThis as any).Buffer.from(str).toString("base64");
}

/**
 * Use the GitHub Compare API to get the exact list of files that changed
 * between two version tags. Returns only files that aren't excluded.
 *
 * Compare API: GET /repos/{owner}/{repo}/compare/{base}...{head}
 */
export async function getChangedFiles(
  env: Env,
  fromTag: string,
  toTag: string,
): Promise<FileChange[]> {
  const response = await fetch(
    `https://api.github.com/repos/${UPSTREAM_OWNER}/${UPSTREAM_REPO}/compare/${fromTag}...${toTag}`,
    {
      headers: {
        "User-Agent": "waichat-updater/1.0",
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Compare API failed (${fromTag}...${toTag}): HTTP ${response.status} - ${body.substring(0, 200)}`,
    );
  }

  const data = (await response.json()) as {
    files: {
      filename: string;
      status: "added" | "modified" | "removed" | "renamed";
      raw_url: string;
    }[];
  };

  if (!Array.isArray(data.files)) {
    throw new Error("Compare API returned unexpected format: missing files array");
  }

  // GitHub Compare API limits the files array to 300.
  // If we hit this, we must abort to prevent an incomplete/broken update.
  if (data.files.length >= 300) {
    throw new Error(
      `Update too large: ${data.files.length} files changed. The auto-updater currently supports a maximum of 300 files per release to ensure integrity.`,
    );
  }

  return data.files
    .filter((f) => !isExcluded(f.filename))
    .map((f) => ({
      path: f.filename,
      status: f.status,
      downloadUrl: f.raw_url,
    }));
}

/**
 * Fetch file contents for all changed files (additions + modifications).
 * Skips removed files - those are handled separately during commit.
 */
export async function fetchChangedFiles(env: Env, changes: FileChange[]): Promise<CommitFile[]> {
  return Promise.all(
    changes
      .filter((change) => change.status !== "removed")
      .map(async (change) => {
        const response = await fetch(change.downloadUrl, {
          headers: { "User-Agent": "waichat-updater/1.0" },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch ${change.path}: HTTP ${response.status}`);
        }

        const content = await response.text();
        return { path: change.path, content };
      }),
  );
}

/**
 * Commit all changes to the user's GitHub repo in a single atomic batch.
 * Flow: Blobs -> Tree -> Commit -> Ref update.
 */
export async function commitChangesToGitHub(
  env: Env,
  filesToUpdate: CommitFile[],
  filesToDelete: string[],
  version: string,
): Promise<number> {
  const token = env.GITHUB_TOKEN;
  const repo = env.GITHUB_REPO;

  if (!token) throw new Error("GITHUB_TOKEN not configured");
  if (!repo || !repo.includes("/")) throw new Error(`Invalid GITHUB_REPO: ${repo}`);

  const commonHeaders = {
    Authorization: `Bearer ${token}`,
    "User-Agent": "waichat-updater/1.0",
    "X-GitHub-Api-Version": "2022-11-28",
    Accept: "application/vnd.github+json",
  };

  // 1. Detect default branch
  const repoInfo = await fetch(`https://api.github.com/repos/${repo}`, {
    headers: commonHeaders,
  });
  if (!repoInfo.ok) throw new Error(`Failed to fetch repo info: ${repoInfo.status}`);
  const { default_branch } = (await repoInfo.json()) as { default_branch: string };

  // 2. Get latest commit SHA of default branch
  const refInfo = await fetch(`https://api.github.com/repos/${repo}/git/refs/heads/${default_branch}`, {
    headers: commonHeaders,
  });
  if (!refInfo.ok) throw new Error(`Failed to fetch branch ref: ${refInfo.status}`);
  const { object } = (await refInfo.json()) as { object: { sha: string } };
  const baseCommitSha = object.sha;

  // 3. Get the tree SHA from the base commit
  const commitInfo = await fetch(`https://api.github.com/repos/${repo}/git/commits/${baseCommitSha}`, {
    headers: commonHeaders,
  });
  if (!commitInfo.ok) throw new Error(`Failed to fetch base commit: ${commitInfo.status}`);
  const { tree } = (await commitInfo.json()) as { tree: { sha: string } };
  const baseTreeSha = tree.sha;

  // 4. Create blobs for new/updated files in parallel
  const treeItems: GitTreeItem[] = await Promise.all(
    filesToUpdate.map(async (file) => {
      const blobResponse = await fetch(`https://api.github.com/repos/${repo}/git/blobs`, {
        method: "POST",
        headers: commonHeaders,
        body: JSON.stringify({
          content: toBase64(file.content),
          encoding: "base64",
        }),
      });
      if (!blobResponse.ok) throw new Error(`Failed to create blob for ${file.path}`);
      const { sha } = (await blobResponse.json()) as { sha: string };
      return {
        path: file.path,
        mode: "100644",
        type: "blob",
        sha,
      };
    }),
  );

  // 5. Add deletions to the tree items
  // Setting sha: null in the tree API removes the file
  for (const path of filesToDelete) {
    treeItems.push({
      path,
      mode: "100644",
      type: "blob",
      sha: null,
    });
  }

  if (treeItems.length === 0) return 0;

  // 6. Create a new tree
  const newTreeResponse = await fetch(`https://api.github.com/repos/${repo}/git/trees`, {
    method: "POST",
    headers: commonHeaders,
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: treeItems,
    }),
  });
  if (!newTreeResponse.ok) throw new Error(`Failed to create new tree: ${await newTreeResponse.text()}`);
  const { sha: newTreeSha } = (await newTreeResponse.json()) as { sha: string };

  // 7. Create a commit
  const newCommitResponse = await fetch(`https://api.github.com/repos/${repo}/git/commits`, {
    method: "POST",
    headers: commonHeaders,
    body: JSON.stringify({
      message: `chore(auto-update): deploy ${version}`,
      tree: newTreeSha,
      parents: [baseCommitSha],
    }),
  });
  if (!newCommitResponse.ok) throw new Error(`Failed to create commit: ${await newCommitResponse.text()}`);
  const { sha: newCommitSha } = (await newCommitResponse.json()) as { sha: string };

  // 8. Update the branch reference
  const updateRefResponse = await fetch(`https://api.github.com/repos/${repo}/git/refs/heads/${default_branch}`, {
    method: "PATCH",
    headers: commonHeaders,
    body: JSON.stringify({
      sha: newCommitSha,
      force: false,
    }),
  });
  if (!updateRefResponse.ok) throw new Error(`Failed to update ref: ${await updateRefResponse.text()}`);

  return treeItems.length;
}

