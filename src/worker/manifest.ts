/**
 * Version discovery via GitHub Releases API.
 *
 * Supports two update channels:
 *   - "stable"     → GET /releases/latest (skips drafts and pre-releases)
 *   - "pre-release" → GET /releases (includes alpha, beta, rc tags)
 *
 * Release workflow is just: create a GitHub Release (mark as pre-release or not).
 * No manifest file, no generation script needed.
 */

import type { Env } from "./types";

const UPSTREAM_OWNER = "ranajahanzaib";
const UPSTREAM_REPO = "waichat";

export type UpdateChannel = "stable" | "pre-release";

export interface LatestRelease {
  version: string;
  tag: string;
  releaseNotes: string;
  publishedAt: string;
  prerelease: boolean;
}

/**
 * Fetch the latest release from the upstream repo for the given channel.
 *
 * - "stable": Uses /releases/latest (only non-draft, non-prerelease)
 * - "pre-release": Uses /releases and picks the first entry (most recent,
 *   including pre-releases, but excluding drafts)
 */
export async function fetchLatestRelease(
  env: Env,
  channel: UpdateChannel = "stable",
): Promise<LatestRelease | null> {
  try {
    const headers = {
      "User-Agent": "waichat-updater/1.0",
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    };

    if (channel === "stable") {
      // /releases/latest returns only the most recent non-draft, non-prerelease
      const response = await fetch(
        `https://api.github.com/repos/${UPSTREAM_OWNER}/${UPSTREAM_REPO}/releases/latest`,
        { headers },
      );

      if (response.status === 404) {
        console.log("[Manifest] No stable releases found");
        return null;
      }

      if (!response.ok) {
        throw new Error(`GitHub Releases API failed: HTTP ${response.status}`);
      }

      const release = (await response.json()) as {
        tag_name: string;
        body: string;
        published_at: string;
        prerelease: boolean;
      };

      return {
        version: release.tag_name,
        tag: release.tag_name,
        releaseNotes: release.body || "",
        publishedAt: release.published_at || "",
        prerelease: release.prerelease,
      };
    }

    // "pre-release" channel: list all releases, pick the most recent (first)
    const response = await fetch(
      `https://api.github.com/repos/${UPSTREAM_OWNER}/${UPSTREAM_REPO}/releases?per_page=30`,
      { headers },
    );

    if (!response.ok) {
      throw new Error(`GitHub Releases API failed: HTTP ${response.status}`);
    }

    const releases = (await response.json()) as {
      tag_name: string;
      body: string;
      published_at: string;
      prerelease: boolean;
      draft: boolean;
    }[];

    // Filter out drafts, take the first (most recent)
    const latest = releases.find((r) => !r.draft);
    if (!latest) {
      console.log("[Manifest] No releases found (all drafts or empty)");
      return null;
    }

    return {
      version: latest.tag_name,
      tag: latest.tag_name,
      releaseNotes: latest.body || "",
      publishedAt: latest.published_at || "",
      prerelease: latest.prerelease,
    };
  } catch (error) {
    console.error("[Manifest] Failed to fetch latest release:", error);
    return null;
  }
}
