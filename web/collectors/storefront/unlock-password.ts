/**
 * Unlock a password-gated Shopify storefront and return Cookie header value.
 * Partner development stores often force this gate and disallow turning it off.
 */

const DEFAULT_HEADERS: Record<string, string> = {
  "User-Agent":
    "StoreAuditAIBot/1.0 (+https://storeaudit.ai; public storefront collector)",
  Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.8",
};

function normalizeBaseUrl(urlOrDomain: string): string {
  const trimmed = urlOrDomain.trim().replace(/\/+$/, "");
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function mergeSetCookie(
  existing: Map<string, string>,
  setCookieHeaders: string[]
): void {
  for (const header of setCookieHeaders) {
    const first = header.split(";")[0]?.trim();
    if (!first) continue;
    const eq = first.indexOf("=");
    if (eq <= 0) continue;
    const name = first.slice(0, eq).trim();
    const value = first.slice(eq + 1).trim();
    if (name) existing.set(name, value);
  }
}

function cookieHeaderFromMap(cookies: Map<string, string>): string {
  return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function getSetCookieHeaders(response: Response): string[] {
  const headers = response.headers as Headers & {
    getSetCookie?: () => string[];
  };
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }
  const single = response.headers.get("set-cookie");
  return single ? [single] : [];
}

function extractAuthenticityToken(html: string): string | null {
  const patterns = [
    /name=["']authenticity_token["'][^>]*value=["']([^"']+)["']/i,
    /value=["']([^"']+)["'][^>]*name=["']authenticity_token["']/i,
  ];
  for (const re of patterns) {
    const match = html.match(re);
    if (match?.[1]) return match[1];
  }
  return null;
}

export interface UnlockStorefrontResult {
  ok: boolean;
  cookieHeader: string | null;
  errorMessage: string | null;
}

/**
 * POSTs the storefront password and returns a Cookie header for later fetches.
 */
export async function unlockStorefrontPassword(
  baseUrl: string,
  password: string,
  timeoutMs = 20000
): Promise<UnlockStorefrontResult> {
  const trimmedPassword = password.trim();
  if (!trimmedPassword) {
    return {
      ok: false,
      cookieHeader: null,
      errorMessage: "Storefront password is empty",
    };
  }

  const origin = normalizeBaseUrl(baseUrl);
  const passwordUrl = new URL("/password", `${origin}/`).toString();
  const cookies = new Map<string, string>();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Load password page first (captures cookies + authenticity token).
    const gateResponse = await fetch(passwordUrl, {
      method: "GET",
      redirect: "manual",
      headers: DEFAULT_HEADERS,
      signal: controller.signal,
    });
    mergeSetCookie(cookies, getSetCookieHeaders(gateResponse));
    const gateHtml = await gateResponse.text().catch(() => "");
    const authenticityToken = extractAuthenticityToken(gateHtml);

    const body = new URLSearchParams();
    body.set("form_type", "storefront_password");
    body.set("utf8", "✓");
    body.set("password", trimmedPassword);
    if (authenticityToken) {
      body.set("authenticity_token", authenticityToken);
    }

    const cookieHeader = cookieHeaderFromMap(cookies);
    const unlockResponse = await fetch(passwordUrl, {
      method: "POST",
      redirect: "manual",
      headers: {
        ...DEFAULT_HEADERS,
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: origin,
        Referer: passwordUrl,
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      body: body.toString(),
      signal: controller.signal,
    });
    mergeSetCookie(cookies, getSetCookieHeaders(unlockResponse));

    // Follow a short redirect chain if Shopify issues Location after unlock.
    let currentUrl = passwordUrl;
    let response = unlockResponse;
    for (let i = 0; i < 5; i++) {
      if (response.status < 300 || response.status >= 400) break;
      const location = response.headers.get("location");
      if (!location) break;
      currentUrl = new URL(location, currentUrl).toString();
      response = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual",
        headers: {
          ...DEFAULT_HEADERS,
          Cookie: cookieHeaderFromMap(cookies),
        },
        signal: controller.signal,
      });
      mergeSetCookie(cookies, getSetCookieHeaders(response));
    }

    const finalCookie = cookieHeaderFromMap(cookies);
    if (!finalCookie) {
      return {
        ok: false,
        cookieHeader: null,
        errorMessage:
          "Storefront unlock returned no cookies. Check STOREFRONT_PASSWORD.",
      };
    }

    // Verify homepage is no longer the password gate.
    const verify = await fetch(new URL("/", `${origin}/`).toString(), {
      method: "GET",
      redirect: "follow",
      headers: {
        ...DEFAULT_HEADERS,
        Cookie: finalCookie,
      },
      signal: controller.signal,
    });
    const verifyHtml = await verify.text().catch(() => "");
    const stillLocked =
      /storefront_password/i.test(verifyHtml) ||
      (/name=["']password["']/i.test(verifyHtml) &&
        /enter store password/i.test(verifyHtml));

    if (stillLocked || verify.status >= 400) {
      return {
        ok: false,
        cookieHeader: null,
        errorMessage:
          "Storefront password unlock failed. Confirm STOREFRONT_PASSWORD matches Online Store → Preferences.",
      };
    }

    return { ok: true, cookieHeader: finalCookie, errorMessage: null };
  } catch (error) {
    const aborted =
      error instanceof Error && error.name === "AbortError";
    return {
      ok: false,
      cookieHeader: null,
      errorMessage: aborted
        ? `Timed out unlocking storefront after ${timeoutMs}ms`
        : error instanceof Error
          ? error.message
          : "Unknown unlock error",
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Reads storefront password from env for development-store testing.
 */
export function getConfiguredStorefrontPassword(): string | null {
  const value =
    process.env.STOREFRONT_PASSWORD ||
    process.env.SHOPIFY_STOREFRONT_PASSWORD ||
    "";
  const trimmed = value.trim();
  return trimmed || null;
}
