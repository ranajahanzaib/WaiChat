import { useEffect, useState } from "react";
import type { UpdateChannel } from "../../worker/manifest";

interface UpdateStatusData {
  current_version: string;
  latest_version: string | null;
  last_check: string;
  last_attempt: string | null;
  status: "up_to_date" | "available" | "queued" | "success" | "failed";
  last_error: string | null;
  channel: "stable" | "pre-release";
  is_configured: boolean;
  recent_logs: {
    id: number;
    version: string | null;
    attempted_at: string;
    status: string;
    files_updated: number | null;
    duration_ms: number | null;
    error_message: string | null;
  }[];
}

export default function UpdateStatus() {
  const [data, setData] = useState<UpdateStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [applying, setApplying] = useState(false);
  const [changingChannel, setChangingChannel] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const response = await fetch("/api/updates/status");
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error || `HTTP ${response.status}`);
      }
      const json = (await response.json()) as UpdateStatusData;
      setData(json);
      setFetchError(null);
    } catch (error) {
      setFetchError(error instanceof Error ? error.message : "Failed to fetch update status");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 60_000); // Poll every 60s
    return () => clearInterval(interval);
  }, []);

  const handleCheckNow = async () => {
    setChecking(true);
    setFetchError(null);
    try {
      const response = await fetch("/api/updates/check", { method: "POST" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error || `Check failed: HTTP ${response.status}`,
        );
      }
      await fetchStatus();
    } catch (error) {
      setFetchError(error instanceof Error ? error.message : "Failed to trigger check");
    } finally {
      setChecking(false);
    }
  };

  const handleUpdateNow = async () => {
    setApplying(true);
    setFetchError(null);
    try {
      const response = await fetch("/api/updates/apply", { method: "POST" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error || `Update failed: HTTP ${response.status}`,
        );
      }
      await fetchStatus();
    } catch (error) {
      setFetchError(error instanceof Error ? error.message : "Failed to start update");
    } finally {
      setApplying(false);
    }
  };

  const handleChannelChange = async (newChannel: string) => {
    if (!data) return;

    // Optimistic update
    const oldData = data;
    setData({ ...data, channel: newChannel as UpdateChannel });
    setChangingChannel(true);

    try {
      const response = await fetch(`/api/settings/update_channel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: newChannel }),
      });
      if (!response.ok) throw new Error("Failed to save channel preference");
      await fetchStatus();
    } catch (error) {
      setData(oldData); // Rollback on error
      setFetchError(error instanceof Error ? error.message : "Failed to change channel");
    } finally {
      setChangingChannel(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="py-3 px-4 rounded-xl bg-white/60 dark:bg-white/5 border-[0.5px] border-black/10 dark:border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-black/10 dark:bg-white/10 animate-pulse" />
          <span className="text-[13px] md:text-sm text-gray-500 dark:text-white/40">
            Loading update status…
          </span>
        </div>
      </div>
    );
  }

  // Connection / migration error
  if (fetchError && !data) {
    return (
      <div className="py-3 px-4 rounded-xl bg-white/60 dark:bg-white/5 border-[0.5px] border-black/10 dark:border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[13px] md:text-sm font-medium text-gray-900 dark:text-white/95">
            App Updates
          </p>
          <span className="text-[10px] font-mono text-gray-400 dark:text-white/30 uppercase tracking-wider">
            Unavailable
          </span>
        </div>
        <p className="text-xs text-gray-500 dark:text-white/40 leading-relaxed">{fetchError}</p>
      </div>
    );
  }

  if (!data) return null;

  const hasUpdate =
    data.status === "available" &&
    data.latest_version &&
    data.current_version !== data.latest_version;

  const lastCheckTime = (() => {
    try {
      if (!data.last_check) return "Never";
      return new Date(data.last_check).toLocaleString();
    } catch {
      return data.last_check;
    }
  })();

  // Main render
  return (
    <div className="py-3 px-4 rounded-xl bg-white/60 dark:bg-white/5 border-[0.5px] border-black/10 dark:border-white/10 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[13px] md:text-sm font-medium text-gray-900 dark:text-white/95">
          App Updates
        </p>
        <span className="text-[10px] font-mono text-gray-400 dark:text-white/30 uppercase tracking-wider">
          {data.current_version}
        </span>
      </div>

      {/* Channel Selector */}
      <div className="flex items-center justify-between gap-4">
        <label className="text-[11px] font-medium text-gray-500 dark:text-white/40 uppercase tracking-tight">
          Release Channel
        </label>
        <select
          value={data.channel}
          onChange={(e) => handleChannelChange(e.target.value)}
          disabled={changingChannel || checking || data.status === "queued"}
          className="bg-black/5 dark:bg-white/5 border-[0.5px] border-black/10 dark:border-white/10 rounded-lg px-2 py-1 text-[12px] text-gray-700 dark:text-white/80 focus:outline-none transition-all cursor-pointer disabled:opacity-50"
        >
          <option value="stable">Stable</option>
          <option value="pre-release">Pre-release</option>
        </select>
      </div>

      {/* Configuration Warning */}
      {!data.is_configured && (
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border-[0.5px] border-amber-200 dark:border-amber-500/20">
          <p className="text-xs font-medium text-amber-800 dark:text-amber-400 mb-1">
            Configuration Required
          </p>
          <p className="text-[11px] text-amber-600 dark:text-amber-400/80 leading-relaxed">
            Update access is not fully configured. Go to your <b>Cloudflare Dashboard</b> →{" "}
            <b>Workers & Pages</b> → <b>[Your Worker]</b> → <b>Settings</b> → <b>Variables</b> and
            add your <code>GITHUB_TOKEN</code> (Secret) and <code>GITHUB_REPO</code> (Variable) to
            enable updates.
          </p>
        </div>
      )}

      {/* Error state */}
      {data.last_error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border-[0.5px] border-red-200 dark:border-red-500/20">
          <p className="text-xs font-medium text-red-800 dark:text-red-400 mb-1">Update Failed</p>
          <p className="text-[11px] text-red-600 dark:text-red-400/80 leading-relaxed break-words">
            {data.last_error}
          </p>
        </div>
      )}

      {/* Queued / In-progress state */}
      {data.status === "queued" && (
        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-500/10 border-[0.5px] border-blue-200 dark:border-blue-500/20">
          <div className="flex items-center gap-2">
            <svg
              className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <p className="text-xs font-medium text-blue-800 dark:text-blue-400">
              Update in progress…
            </p>
          </div>
          <p className="text-[11px] text-blue-600 dark:text-blue-400/80 mt-1 ml-5.5">
            Fetching and applying files. This may take a minute.
          </p>
        </div>
      )}

      {/* Up-to-date state */}
      {(data.status === "up_to_date" || data.status === "success") && !hasUpdate && (
        <div className="p-3 rounded-lg bg-green-50 dark:bg-green-500/10 border-[0.5px] border-green-200 dark:border-green-500/20">
          <div className="flex items-center gap-2">
            <svg
              className="w-3.5 h-3.5 text-green-600 dark:text-green-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-xs font-medium text-green-800 dark:text-green-400">Up to Date</p>
          </div>
          <p className="text-[11px] text-green-600 dark:text-green-400/80 mt-1 ml-5.5">
            Last checked: {lastCheckTime}
          </p>
        </div>
      )}

      {/* Update available state */}
      {hasUpdate && data.status !== "queued" && (
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border-[0.5px] border-amber-200 dark:border-amber-500/20">
          <div className="flex items-center gap-2">
            <svg
              className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
              />
            </svg>
            <p className="text-xs font-medium text-amber-800 dark:text-amber-400">
              Update Available
            </p>
          </div>
          <p className="text-[11px] text-amber-600 dark:text-amber-400/80 mt-1 ml-5.5">
            {data.current_version} → {data.latest_version}
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-2">
        {data.status === "available" && (
          <button
            onClick={handleUpdateNow}
            disabled={applying || checking}
            className="w-full py-2 text-[13px] md:text-sm font-semibold rounded-full transition-all duration-200 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed
              bg-blue-600 hover:bg-blue-700 dark:bg-blue-500/20 dark:hover:bg-blue-500/30
              text-white dark:text-blue-400
              border-[0.5px] border-blue-700/10 dark:border-blue-500/20 shadow-sm"
          >
            {applying ? "Starting Update…" : "Update Now"}
          </button>
        )}

        <button
          onClick={handleCheckNow}
          disabled={checking || applying || changingChannel || data.status === "queued"}
          className="w-full py-2 text-[13px] md:text-sm font-medium rounded-full transition-all duration-200 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed
            bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10
            text-gray-700 hover:text-gray-900 dark:text-white/80 dark:hover:text-white/95
            border-[0.5px] border-black/10 dark:border-white/10"
        >
          {checking ? "Checking…" : "Check for Updates"}
        </button>
      </div>

      <p className="text-[10px] text-gray-400 dark:text-white/25 text-center leading-relaxed">
        Automatic checks run daily at 2:00 AM UTC
      </p>
    </div>
  );
}
