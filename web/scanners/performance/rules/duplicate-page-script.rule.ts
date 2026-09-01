import type { DetectedIssue, ScanRule } from "../../../rules/types.ts";
import type { PageScanResult } from "../../../collectors/storefront/types.ts";

const RULE_ID = "performance.duplicate-page-script";

function pageLabel(kind: string): string {
  switch (kind) {
    case "HOME":
      return "Homepage";
    case "PRODUCT":
      return "Product page";
    case "COLLECTION":
      return "Collection page";
    case "CART":
      return "Cart page";
    default:
      return kind;
  }
}

/**
 * Normalize script URLs so minor query/hash differences still match.
 */
export function normalizePageScriptUrl(src: string): string {
  const trimmed = src.trim();
  if (!trimmed) return "";
  try {
    const withProtocol = trimmed.startsWith("//")
      ? `https:${trimmed}`
      : trimmed;
    if (!/^https?:\/\//i.test(withProtocol)) {
      return trimmed.split("#")[0].toLowerCase();
    }
    const url = new URL(withProtocol);
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    // Drop common cache-buster params but keep meaningful ones.
    for (const key of ["v", "version", "_", "cache"]) {
      url.searchParams.delete(key);
    }
    return `${url.origin}${url.pathname}${url.search}`;
  } catch {
    return trimmed.split("#")[0].toLowerCase();
  }
}

export interface DuplicatePageScriptData {
  pages: PageScanResult[];
}

/**
 * Flags scripts that actually appear more than once in rendered storefront HTML.
 * This catches real double-loads even when theme files only reference the script once each.
 */
export const duplicatePageScriptRule: ScanRule<DuplicatePageScriptData> = {
  id: RULE_ID,
  name: "Script loaded twice on the same page",
  category: "PERFORMANCE",
  defaultSeverity: "HIGH",
  description:
    "Detects the same script URL appearing multiple times in a rendered storefront page.",

  evaluate(data) {
    const issues: DetectedIssue[] = [];

    for (const page of data.pages) {
      if (page.status !== "OK") continue;
      const pageUrl = page.finalUrl || page.requestedUrl;

      const byNormalized = new Map<
        string,
        { srcs: string[]; count: number }
      >();

      for (const script of page.scripts || []) {
        if (!script.src || script.inline) continue;
        const normalized = normalizePageScriptUrl(script.src);
        if (!normalized) continue;
        const entry = byNormalized.get(normalized) || {
          srcs: [],
          count: 0,
        };
        entry.count += 1;
        entry.srcs.push(script.src);
        byNormalized.set(normalized, entry);
      }

      for (const [normalizedUrl, entry] of byNormalized.entries()) {
        if (entry.count < 2) continue;

        const fileName =
          normalizedUrl.split("/").filter(Boolean).pop() || normalizedUrl;

        issues.push({
          ruleId: RULE_ID,
          title: `Script "${fileName}" loaded ${entry.count} times on ${pageLabel(page.kind).toLowerCase()}`,
          description:
            `${pageLabel(page.kind)} loads "${normalizedUrl}" ${entry.count} times. ` +
            `This usually means multiple theme files (layout + section/snippet) each include the same script on this page.`,
          category: "PERFORMANCE",
          severity: entry.count >= 3 ? "HIGH" : "MEDIUM",
          confidence: "HIGH",
          affectedResource: `${pageUrl} :: ${normalizedUrl}`,
          affectedResourceType: "page_script",
          recommendation:
            `Ensure "${fileName}" is included once for this page (e.g. only in layout/theme.liquid, or once via a shared snippet)—not again inside each section rendered here.`,
          metadata: {
            issueGroup: "storefront",
            pageKind: page.kind,
            pageUrl,
            normalizedUrl,
            scriptFile: fileName,
            srcVariants: [...new Set(entry.srcs)],
            occurrenceCount: entry.count,
            scope: "same_page",
            offendingParts: [
              {
                part: "script",
                detail: `Script file loaded ${entry.count}x: ${fileName}`,
              },
              {
                part: "script",
                detail: `URL: ${normalizedUrl}`,
              },
            ],
          },
        });
      }
    }

    return { ruleId: RULE_ID, ok: true, issues };
  },
};
