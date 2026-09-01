import type { ShopifyGraphqlSession } from "../products/collector.ts";
import {
  discoverTargetsFromHomepageLinks,
  resolveStorefrontTargets,
} from "./discover.ts";
import { fetchPublicPage } from "./fetch-page.ts";
import {
  getConfiguredStorefrontPassword,
  unlockStorefrontPassword,
} from "./unlock-password.ts";
import type {
  PageScanResult,
  StorefrontCollectionResult,
  StorefrontTargets,
} from "./types.ts";

export interface CollectStorefrontOptions {
  shopDomain?: string;
  /** Override public storefront origin (e.g. custom domain). */
  baseUrl?: string;
  timeoutMs?: number;
  /**
   * Storefront password for development stores that force password protection.
   * Falls back to STOREFRONT_PASSWORD / SHOPIFY_STOREFRONT_PASSWORD env.
   */
  storefrontPassword?: string | null;
}

function withHomepageFallbacks(
  targets: StorefrontTargets,
  homePage: PageScanResult
): StorefrontTargets {
  if (homePage.status !== "OK") {
    return targets;
  }

  const discovered = discoverTargetsFromHomepageLinks(
    targets.baseUrl,
    targets.shopDomain,
    homePage.links
  );

  return {
    ...targets,
    productUrl: targets.productUrl || discovered.productUrl,
    collectionUrl: targets.collectionUrl || discovered.collectionUrl,
  };
}

/**
 * Collects normalized public storefront page data for:
 * homepage, one product page, one collection page, and cart.
 *
 * Does not run auditing rules or AI analysis.
 */
export async function collectStorefrontData(
  session: ShopifyGraphqlSession,
  options: CollectStorefrontOptions = {}
): Promise<StorefrontCollectionResult> {
  let targets = await resolveStorefrontTargets(session, {
    shopDomain: options.shopDomain || session.shop,
    baseUrl: options.baseUrl,
  });

  const password =
    options.storefrontPassword?.trim() ||
    getConfiguredStorefrontPassword();

  let cookieHeader: string | null = null;
  if (password) {
    const unlock = await unlockStorefrontPassword(
      targets.baseUrl,
      password,
      options.timeoutMs
    );
    if (unlock.ok && unlock.cookieHeader) {
      cookieHeader = unlock.cookieHeader;
      console.log(
        `✅ Storefront password unlock succeeded for ${targets.baseUrl}`
      );
    } else {
      console.warn(
        `⚠️ Storefront password unlock failed for ${targets.baseUrl}: ${
          unlock.errorMessage || "unknown error"
        }`
      );
    }
  } else {
    console.warn(
      "⚠️ No STOREFRONT_PASSWORD configured. Development stores with a forced password gate will return 0 public pages."
    );
  }

  const pages: PageScanResult[] = [];

  const homePage = await fetchPublicPage({
    kind: "HOME",
    url: targets.homeUrl,
    timeoutMs: options.timeoutMs,
    cookieHeader,
  });
  pages.push(homePage);

  targets = withHomepageFallbacks(targets, homePage);

  if (targets.productUrl) {
    pages.push(
      await fetchPublicPage({
        kind: "PRODUCT",
        url: targets.productUrl,
        timeoutMs: options.timeoutMs,
        cookieHeader,
      })
    );
  } else {
    pages.push({
      kind: "PRODUCT",
      requestedUrl: `${targets.baseUrl}/products`,
      finalUrl: null,
      status: "FAILED",
      httpStatus: null,
      redirected: false,
      redirectChain: [],
      errorMessage: "No representative public product URL could be discovered",
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
    });
  }

  if (targets.collectionUrl) {
    pages.push(
      await fetchPublicPage({
        kind: "COLLECTION",
        url: targets.collectionUrl,
        timeoutMs: options.timeoutMs,
        cookieHeader,
      })
    );
  } else {
    // Last resort: Shopify's all-products collection is usually public.
    const fallbackCollection = new URL(
      "/collections/all",
      `${targets.baseUrl}/`
    ).toString();
    pages.push(
      await fetchPublicPage({
        kind: "COLLECTION",
        url: fallbackCollection,
        timeoutMs: options.timeoutMs,
        cookieHeader,
      })
    );
    targets = { ...targets, collectionUrl: fallbackCollection };
  }

  pages.push(
    await fetchPublicPage({
      kind: "CART",
      url: targets.cartUrl,
      timeoutMs: options.timeoutMs,
      cookieHeader,
    })
  );

  const okCount = pages.filter((p) => p.status === "OK").length;
  if (okCount === 0) {
    const statuses = pages
      .map((p) => `${p.kind}:${p.status}${p.errorMessage ? `(${p.errorMessage})` : ""}`)
      .join(", ");
    console.warn(`⚠️ Storefront collection fetched 0 OK pages: ${statuses}`);
  }

  return {
    shopDomain: targets.shopDomain,
    baseUrl: targets.baseUrl,
    targets,
    pages,
    collectedAt: new Date().toISOString(),
  };
}
