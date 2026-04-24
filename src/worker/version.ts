/**
 * Single source of truth for the running application version.
 *
 * This is imported from package.json at build time (both esbuild for the worker
 * and Vite for the client resolve JSON imports). The auto-update system uses this
 * to compare against the latest upstream release.
 *
 * The DB `update_state.current_version` is NOT the source of truth for the running
 * version - it tracks what the updater last committed to GitHub, which may differ
 * from the code actually running (e.g., after a manual deploy or local edit).
 */

import pkg from "../../package.json";

export const APP_VERSION: string = pkg.version;
