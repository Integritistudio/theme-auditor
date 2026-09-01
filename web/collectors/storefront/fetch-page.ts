import { detectNonPublicPage, parsePageHtml } from "./parse-html.ts";
import type { PageFetchStatus, PageKind, PageScanResult } from "./types.ts";

const DEFAULT_TIMEOUT_MS = 20000;
const MAX_REDIRECTS = 8;
/** Cap stored HTML to keep scan payloads manageable. */
const MAX_HTML_CHARS = 1_500_000;

const DEFAULT_HEADERS: Record<string, string> = {
  "User-Agent":
    "StoreAuditAIBot/1.0 (+https://storeaudit.ai; public storefront collector)",
  Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.8",
};

export interface FetchPublicPageOptions {
  kind: PageKind;
  url: string;
  timeoutMs?: number;
  /** Cookie header from a prior storefront password unlock. */
  cookieHeader?: string | null;
}

function emptyResult(
  kind: PageKind,
  requestedUrl: string,
  overrides: Partial<PageScanResult>
): PageScanResult {
  return {
    kind,
    requestedUrl,
    finalUrl: null,
    status: "FAILED",
    httpStatus: null,
    redirected: false,
    redirectChain: [],
    errorMessage: null,
    html: null,
    htmlTruncated: false,
    title: null,
    metaDescription: null,
    canonicalUrl: null,
    openGraph: {
      title: null,
      description: null,
      image: null,
      url: null,
      type: null,
    },
    headings: [],
    images: [],
    scripts: [],
    stylesheets: [],
    links: [],
    fetchedAt: new Date().toISOString(),
    responseTimeMs: null,
    ...overrides,
  };
}

function statusFromHttp(httpStatus: number): PageFetchStatus {
  if (httpStatus === 404 || httpStatus === 410) return "NOT_FOUND";
  if (httpStatus === 401 || httpStatus === 403) return "FORBIDDEN";
  if (httpStatus >= 200 && httpStatus < 400) return "OK";
  return "FAILED";
}

function resolveRedirectUrl(
  location: string | null,
  currentUrl: string
): string | null {
  if (!location) return null;
  try {
    return new URL(location, currentUrl).toString();
  } catch {
    return null;
  }
}

/**
 * Fetches one public storefront URL, follows redirects manually, and normalizes HTML.
 */
export async function fetchPublicPage(
  options: FetchPublicPageOptions
): Promise<PageScanResult> {
  const { kind, url } = options;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const started = Date.now();
  const redirectChain: string[] = [];
  const requestHeaders: Record<string, string> = {
    ...DEFAULT_HEADERS,
  };
  if (options.cookieHeader?.trim()) {
    requestHeaders.Cookie = options.cookieHeader.trim();
  }

  let currentUrl = url;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    for (let i = 0; i <= MAX_REDIRECTS; i++) {
      const response = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual",
        headers: requestHeaders,
        signal: controller.signal,
      });

      if (response.status >= 300 && response.status < 400) {
        const next = resolveRedirectUrl(
          response.headers.get("location"),
          currentUrl
        );
        if (!next) {
          return emptyResult(kind, url, {
            finalUrl: currentUrl,
            status: "FAILED",
            httpStatus: response.status,
            redirected: redirectChain.length > 0,
            redirectChain: [...redirectChain],
            errorMessage: "Redirect response missing Location header",
            responseTimeMs: Date.now() - started,
          });
        }
        redirectChain.push(currentUrl);
        currentUrl = next;
        continue;
      }

      const httpStatus = response.status;
      const responseTimeMs = Date.now() - started;
      const redirected = redirectChain.length > 0;

      if (httpStatus >= 400) {
        let bodyPreview: string | null = null;
        try {
          bodyPreview = (await response.text()).slice(0, 4000);
        } catch {
          bodyPreview = null;
        }

        let status = statusFromHttp(httpStatus);
        let errorMessage: string | null = `HTTP ${httpStatus}`;

        if (bodyPreview) {
          const gate = detectNonPublicPage(bodyPreview, currentUrl);
          if (gate.passwordProtected) {
            status = "PASSWORD_PROTECTED";
            errorMessage = gate.reason;
          } else if (gate.nonPublic) {
            status = "NON_PUBLIC";
            errorMessage = gate.reason;
          }
        }

        return emptyResult(kind, url, {
          finalUrl: currentUrl,
          status,
          httpStatus,
          redirected,
          redirectChain: [...redirectChain],
          errorMessage,
          html: bodyPreview,
          responseTimeMs,
        });
      }

      const rawHtml = await response.text();
      const gate = detectNonPublicPage(rawHtml, currentUrl);
      if (gate.passwordProtected || gate.nonPublic) {
        return emptyResult(kind, url, {
          finalUrl: currentUrl,
          status: gate.passwordProtected ? "PASSWORD_PROTECTED" : "NON_PUBLIC",
          httpStatus,
          redirected,
          redirectChain: [...redirectChain],
          errorMessage: gate.reason,
          html: rawHtml.slice(0, Math.min(rawHtml.length, 50_000)),
          responseTimeMs,
        });
      }

      const htmlTruncated = rawHtml.length > MAX_HTML_CHARS;
      const html = htmlTruncated
        ? rawHtml.slice(0, MAX_HTML_CHARS)
        : rawHtml;
      const parsed = parsePageHtml(html);

      return {
        kind,
        requestedUrl: url,
        finalUrl: currentUrl,
        status: "OK",
        httpStatus,
        redirected,
        redirectChain: [...redirectChain],
        errorMessage: null,
        html,
        htmlTruncated,
        title: parsed.title,
        metaDescription: parsed.metaDescription,
        canonicalUrl: parsed.canonicalUrl,
        openGraph: parsed.openGraph,
        headings: parsed.headings,
        images: parsed.images,
        scripts: parsed.scripts,
        stylesheets: parsed.stylesheets,
        links: parsed.links,
        fetchedAt: new Date().toISOString(),
        responseTimeMs,
      };
    }

    return emptyResult(kind, url, {
      finalUrl: currentUrl,
      status: "FAILED",
      redirected: redirectChain.length > 0,
      redirectChain: [...redirectChain],
      errorMessage: `Too many redirects (>${MAX_REDIRECTS})`,
      responseTimeMs: Date.now() - started,
    });
  } catch (error) {
    const aborted =
      (error instanceof Error && error.name === "AbortError") ||
      (typeof error === "object" &&
        error !== null &&
        "name" in error &&
        (error as { name: string }).name === "AbortError");

    return emptyResult(kind, url, {
      finalUrl: redirectChain.length ? currentUrl : null,
      status: aborted ? "TIMEOUT" : "ERROR",
      redirected: redirectChain.length > 0,
      redirectChain: [...redirectChain],
      errorMessage: aborted
        ? `Timed out after ${timeoutMs}ms`
        : error instanceof Error
          ? error.message
          : "Unknown fetch error",
      responseTimeMs: Date.now() - started,
    });
  } finally {
    clearTimeout(timer);
  }
}
