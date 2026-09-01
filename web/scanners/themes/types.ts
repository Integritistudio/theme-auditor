import type { InternalThemeData } from "../../collectors/themes/types.ts";

/** Input shared by all theme audit rules. */
export interface ThemeRulesData {
  theme: InternalThemeData;
}

/** JS assets above this size (bytes) are flagged. */
export const LARGE_JS_BYTES = 200 * 1024; // 200 KB

/** CSS assets above this size (bytes) are flagged. */
export const LARGE_CSS_BYTES = 150 * 1024; // 150 KB

/** Unique third-party script URLs above this count are flagged. */
export const EXCESSIVE_THIRD_PARTY_SCRIPT_COUNT = 8;

export function formatBytes(bytes: number | null | undefined): string | null {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) {
    return null;
  }
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
