// @ts-check
import { join } from "path";
import { readFileSync } from "fs";
import express from "express";
import serveStatic from "serve-static";

import shopify from "./shopify.js";
import productCreator from "./product-creator.js";
import PrivacyWebhookHandlers from "./privacy.js";
import { checkDatabaseHealth } from "./db/health.ts";
import {
  findShopByDomain,
  createShop,
  getScanById,
  getScansForShop,
  getLatestCompletedScanForShop,
  getCompletedScansForShop,
  getPreviousCompletedScan,
  deleteScanForShop,
  buildScanResultsPayload,
  getIssuesForScan,
  getIssueCountsByScan,
  getTopPriorityIssues,
} from "./db/index.ts";
import {
  ScanLifecycleError,
  createPendingScan,
  enqueueScan,
  isActiveScanStatus,
  compareLatestWithPrevious,
  compareScans,
  summarizeComparisonForApi,
} from "./scans/index.ts";
import {
  AiAnalysisError,
  getAiAnalysisForScan,
  isAiConfigured,
  runAiAnalysisForScan,
} from "./ai/index.ts";
import { collectProducts } from "./collectors/products/index.ts";

const PORT = parseInt(
  process.env.BACKEND_PORT || process.env.PORT || "3000",
  10
);

const STATIC_PATH =
  process.env.NODE_ENV === "production"
    ? `${process.cwd()}/frontend/dist`
    : `${process.cwd()}/frontend/`;

const app = express();

async function resolveOfflineSession(session) {
  if (!session?.shop) {
    return null;
  }

  if (!session.isOnline) {
    return session;
  }

  const offlineId = shopify.api.session.getOfflineId(session.shop);
  return shopify.config.sessionStorage.loadSession(offlineId);
}

async function persistShopFromSession(session) {
  const tokenSession = await resolveOfflineSession(session);
  if (!tokenSession?.shop || !tokenSession.accessToken) {
    return;
  }

  let shopifyShopId = null;
  try {
    const client = new shopify.api.clients.Graphql({ session: tokenSession });
    const response = await client.request(`
      query getShopInfo {
        shop {
          id
        }
      }
    `);
    shopifyShopId = response?.data?.shop?.id || null;
  } catch (gqlErr) {
    console.warn("Could not retrieve GraphQL shop ID:", gqlErr.message);
  }

  await createShop({
    shopifyDomain: tokenSession.shop,
    shopifyShopId: shopifyShopId,
    accessToken: tokenSession.accessToken,
    plan: "free",
  });
  console.log(`✅ Persisted shop ${tokenSession.shop} into PostgreSQL shops table.`);
}

// Set up Shopify authentication and webhook handling
app.get(shopify.config.auth.path, shopify.auth.begin());
app.get(
  shopify.config.auth.callbackPath,
  shopify.auth.callback(),
  async (_req, res, next) => {
    const session = res.locals.shopify.session;
    if (session?.shop) {
      try {
        await persistShopFromSession(session);
      } catch (dbErr) {
        console.error("❌ Failed to persist shop in PostgreSQL:", dbErr);
      }
    }
    next();
  },
  shopify.redirectToShopifyOrAppRoot()
);
app.post(
  shopify.config.webhooks.path,
  shopify.processWebhooks({ webhookHandlers: PrivacyWebhookHandlers })
);

// If you are adding routes outside of the /api path, remember to
// also add a proxy rule for them in web/frontend/vite.config.js

app.use(express.json());

app.get("/api/db-health", async (_req, res) => {
  const health = await checkDatabaseHealth();
  const statusCode = health.status === "ok" ? 200 : 500;
  res.status(statusCode).send(health);
});

app.use("/api/*", shopify.validateAuthenticatedSession());

async function fetchShopDisplayInfo(session) {
  try {
    const client = new shopify.api.clients.Graphql({ session });
    const response = await client.request(`
      query shopDisplayInfo {
        shop {
          name
          shopOwnerName
        }
      }
    `);
    const shopInfo = response?.data?.shop;
    const storeName = shopInfo?.name?.trim() || null;
    const ownerName = shopInfo?.shopOwnerName?.trim() || null;

    return {
      name: storeName,
      ownerName,
      // Prefer store name (Settings → General) over shopOwnerName, which is the
      // legal/owner contact and often differs from the logged-in staff user.
      displayName: storeName || ownerName,
    };
  } catch (error) {
    console.warn("Could not fetch shop display info:", error.message);
    return {
      name: null,
      ownerName: null,
      displayName: null,
    };
  }
}

app.get("/api/dashboard", async (_req, res) => {
  try {
    const session = res.locals.shopify.session;
    let shop = await findShopByDomain(session.shop);

    if (!shop) {
      shop = await createShop({
        shopifyDomain: session.shop,
        plan: "free",
      });
    }

    const scans = await getScansForShop(shop.id, 20, 0);
    const lastScan = scans.length > 0 ? scans[0] : null;
    const lastCompletedScan = await getLatestCompletedScanForShop(shop.id);
    const completedScans = await getCompletedScansForShop(shop.id, 20, 0);

    let completedResults = null;
    if (lastCompletedScan) {
      completedResults = await buildScanResultsPayload(lastCompletedScan, {
        topIssuesLimit: 8,
        resourcesLimit: 12,
      });
    }

    const shopDisplay = await fetchShopDisplayInfo(session);

    res.status(200).send({
      shop: {
        id: shop.id,
        domain: shop.shopify_domain,
        plan: shop.plan,
        name: shopDisplay.name,
        ownerName: shopDisplay.ownerName,
        displayName: shopDisplay.displayName,
      },
      healthScore: lastCompletedScan ? lastCompletedScan.overall_score : null,
      lastScan: lastScan,
      lastCompletedScan: lastCompletedScan,
      completedResults,
      scanHistory: completedScans,
      totalScans: scans.length,
      recentScans: scans,
    });
  } catch (error) {
    console.error("Dashboard API error:", error);
    res.status(500).send({ error: "Failed to load dashboard data." });
  }
});

app.post("/api/scans", async (_req, res) => {
  try {
    const session = res.locals.shopify.session;
    let shop = await findShopByDomain(session.shop);

    if (!shop) {
      shop = await createShop({
        shopifyDomain: session.shop,
        plan: "free",
      });
    }

    const offlineSession = await shopify.ensureValidOfflineSession(session.shop);
    if (!offlineSession?.accessToken) {
      res.status(503).send({
        error:
          "No valid offline session available. Reinstall the app on this store and try again.",
      });
      return;
    }

    const scan = await createPendingScan(shop.id);
    enqueueScan(scan.id, {
      shop: offlineSession.shop,
      accessToken: offlineSession.accessToken,
    });

    res.status(201).send({ success: true, scan });
  } catch (error) {
    if (error instanceof ScanLifecycleError) {
      res.status(409).send({ error: error.message });
      return;
    }
    console.error("Scan creation error:", error);
    res.status(500).send({ error: "Failed to create scan." });
  }
});

/**
 * Completed scan history for the shop.
 */
app.get("/api/scans/history", async (_req, res) => {
  try {
    const session = res.locals.shopify.session;
    const shop = await findShopByDomain(session.shop);

    if (!shop) {
      res.status(404).send({ error: "Shop not found." });
      return;
    }

    const limitRaw = _req.query.limit;
    const limit =
      typeof limitRaw === "string" && limitRaw.trim()
        ? Math.min(50, Math.max(1, parseInt(limitRaw, 10) || 20))
        : 20;

    const history = await getCompletedScansForShop(shop.id, limit, 0);
    const comparison = await compareLatestWithPrevious(shop.id);

    res.status(200).send({
      history,
      comparison: comparison
        ? summarizeComparisonForApi(comparison, 20)
        : null,
    });
  } catch (error) {
    console.error("Scan history error:", error);
    res.status(500).send({ error: "Failed to load scan history." });
  }
});

app.get("/api/scans/:id", async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const shop = await findShopByDomain(session.shop);

    if (!shop) {
      res.status(404).send({ error: "Shop not found." });
      return;
    }

    const scan = await getScanById(req.params.id);
    if (!scan || scan.shop_id !== shop.id) {
      res.status(404).send({ error: "Scan not found." });
      return;
    }

    res.status(200).send({
      scan,
      isActive: isActiveScanStatus(scan.status),
    });
  } catch (error) {
    console.error("Scan fetch error:", error);
    res.status(500).send({ error: "Failed to load scan." });
  }
});

app.delete("/api/scans/:id", async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const shop = await findShopByDomain(session.shop);

    if (!shop) {
      res.status(404).send({ error: "Shop not found." });
      return;
    }

    const result = await deleteScanForShop(shop.id, req.params.id);

    if (result === "not_found") {
      res.status(404).send({ error: "Scan not found." });
      return;
    }

    if (result === "active") {
      res.status(409).send({
        error: "Cannot delete a scan that is still in progress.",
      });
      return;
    }

    res.status(200).send({ success: true });
  } catch (error) {
    console.error("Scan delete error:", error);
    res.status(500).send({ error: "Failed to delete scan." });
  }
});

app.get("/api/scans/:id/results", async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const shop = await findShopByDomain(session.shop);

    if (!shop) {
      res.status(404).send({ error: "Shop not found." });
      return;
    }

    const scan = await getScanById(req.params.id);
    if (!scan || scan.shop_id !== shop.id) {
      res.status(404).send({ error: "Scan not found." });
      return;
    }

    if (scan.status !== "COMPLETED") {
      res.status(409).send({
        error: "Scan results are only available for completed scans.",
        scan,
      });
      return;
    }

    const results = await buildScanResultsPayload(scan, {
      topIssuesLimit: 25,
      resourcesLimit: 50,
    });
    res.status(200).send(results);
  } catch (error) {
    console.error("Scan results error:", error);
    res.status(500).send({ error: "Failed to load scan results." });
  }
});

/**
 * Compare a completed scan with its previous completed scan (or ?with=scanId).
 */
app.get("/api/scans/:id/compare", async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const shop = await findShopByDomain(session.shop);

    if (!shop) {
      res.status(404).send({ error: "Shop not found." });
      return;
    }

    const current = await getScanById(req.params.id);
    if (!current || current.shop_id !== shop.id) {
      res.status(404).send({ error: "Scan not found." });
      return;
    }
    if (current.status !== "COMPLETED") {
      res.status(409).send({
        error: "Only completed scans can be compared.",
      });
      return;
    }

    let previous = null;
    const withId =
      typeof req.query.with === "string" ? req.query.with.trim() : "";
    if (withId) {
      previous = await getScanById(withId);
      if (!previous || previous.shop_id !== shop.id) {
        res.status(404).send({ error: "Comparison scan not found." });
        return;
      }
      if (previous.status !== "COMPLETED") {
        res.status(409).send({
          error: "Only completed scans can be compared.",
        });
        return;
      }
    } else {
      previous = await getPreviousCompletedScan(shop.id, current.id);
    }

    if (!previous) {
      res.status(404).send({
        error: "No previous completed scan available for comparison.",
      });
      return;
    }

    const comparison = await compareScans(current, previous);
    res.status(200).send(summarizeComparisonForApi(comparison, 25));
  } catch (error) {
    console.error("Scan compare error:", error);
    res.status(500).send({ error: "Failed to compare scans." });
  }
});

app.get("/api/scans/:id/issues", async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const shop = await findShopByDomain(session.shop);

    if (!shop) {
      res.status(404).send({ error: "Shop not found." });
      return;
    }

    const scan = await getScanById(req.params.id);
    if (!scan || scan.shop_id !== shop.id) {
      res.status(404).send({ error: "Scan not found." });
      return;
    }

    const [issues, issueCounts, topIssues] = await Promise.all([
      getIssuesForScan(scan.id),
      getIssueCountsByScan(scan.id),
      getTopPriorityIssues(scan.id, 50),
    ]);

    res.status(200).send({
      shop: {
        id: shop.id,
        domain: shop.shopify_domain,
      },
      scan: {
        id: scan.id,
        status: scan.status,
        completed_at: scan.completed_at,
        created_at: scan.created_at,
        overall_score: scan.overall_score,
      },
      issueCounts,
      issues,
      topIssues,
    });
  } catch (error) {
    console.error("Scan issues error:", error);
    res.status(500).send({ error: "Failed to load scan issues." });
  }
});

/**
 * Returns AI analysis for a scan (stored separately from detected issues).
 */
app.get("/api/scans/:id/ai-analysis", async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const shop = await findShopByDomain(session.shop);

    if (!shop) {
      res.status(404).send({ error: "Shop not found." });
      return;
    }

    const scan = await getScanById(req.params.id);
    if (!scan || scan.shop_id !== shop.id) {
      res.status(404).send({ error: "Scan not found." });
      return;
    }

    const analysis = await getAiAnalysisForScan(scan.id);
    res.status(200).send({
      configured: isAiConfigured(),
      analysis: analysis
        ? {
            id: analysis.id,
            scanId: analysis.scan_id,
            status: analysis.status,
            provider: analysis.provider,
            model: analysis.model,
            result: analysis.result,
            errorMessage: analysis.error_message,
            promptTokens: analysis.prompt_tokens,
            completionTokens: analysis.completion_tokens,
            createdAt: analysis.created_at,
            updatedAt: analysis.updated_at,
            completedAt: analysis.completed_at,
          }
        : null,
    });
  } catch (error) {
    console.error("AI analysis fetch error:", error);
    res.status(500).send({ error: "Failed to load AI analysis." });
  }
});

/**
 * Runs or regenerates AI analysis for a completed scan (rate-limited).
 */
app.post("/api/scans/:id/ai-analysis", async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const shop = await findShopByDomain(session.shop);

    if (!shop) {
      res.status(404).send({ error: "Shop not found." });
      return;
    }

    const scan = await getScanById(req.params.id);
    if (!scan || scan.shop_id !== shop.id) {
      res.status(404).send({ error: "Scan not found." });
      return;
    }

    if (scan.status !== "COMPLETED") {
      res.status(409).send({
        error: "AI analysis is only available for completed scans.",
      });
      return;
    }

    const analysis = await runAiAnalysisForScan({
      scanId: scan.id,
      shopId: shop.id,
      shopDomain: session.shop,
    });

    res.status(200).send({
      configured: isAiConfigured(),
      analysis: {
        id: analysis.id,
        scanId: analysis.scan_id,
        status: analysis.status,
        provider: analysis.provider,
        model: analysis.model,
        result: analysis.result,
        errorMessage: analysis.error_message,
        promptTokens: analysis.prompt_tokens,
        completionTokens: analysis.completion_tokens,
        createdAt: analysis.created_at,
        updatedAt: analysis.updated_at,
        completedAt: analysis.completed_at,
      },
    });
  } catch (error) {
    if (error instanceof AiAnalysisError) {
      const status =
        error.code === "RATE_LIMIT"
          ? 429
          : error.code === "SCAN_STATE"
            ? 409
            : error.code === "NOT_CONFIGURED"
              ? 503
              : error.code === "VALIDATION" || error.code === "PROVIDER"
                ? 502
                : 500;
      res.status(status).send({ error: error.message, code: error.code });
      return;
    }
    console.error("AI analysis run error:", error);
    res.status(500).send({ error: "Failed to run AI analysis." });
  }
});

app.get("/api/products/count", async (_req, res) => {
  const client = new shopify.api.clients.Graphql({
    session: res.locals.shopify.session,
  });

  const countData = await client.request(`
    query shopifyProductCount {
      productsCount {
        count
      }
    }
  `);

  res.status(200).send({ count: countData.data.productsCount.count });
});

/**
 * Collects and returns normalized product catalog data (no auditing).
 * Query params:
 *   max  - optional cap (recommended for large stores while testing)
 */
app.get("/api/products/collect", async (req, res) => {
  try {
    const maxRaw = req.query.max;
    const maxProducts =
      typeof maxRaw === "string" && maxRaw.trim()
        ? parseInt(maxRaw, 10)
        : undefined;

    if (
      maxProducts !== undefined &&
      (!Number.isFinite(maxProducts) || maxProducts < 1)
    ) {
      res.status(400).send({ error: "Query param 'max' must be a positive integer." });
      return;
    }

    const result = await collectProducts(res.locals.shopify.session, {
      pageSize: 50,
      mediaPageSize: 50,
      maxProducts,
    });

    res.status(200).send({
      totalFetched: result.totalFetched,
      pageCount: result.pageCount,
      truncated: result.truncated,
      products: result.products,
    });
  } catch (error) {
    console.error("Product collect error:", error);
    res.status(500).send({
      error: "Failed to collect product data.",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/api/products", async (_req, res) => {
  let status = 200;
  let error = null;

  try {
    await productCreator(res.locals.shopify.session);
  } catch (e) {
    console.log(`Failed to process products/create: ${e.message}`);
    status = 500;
    error = e.message;
  }
  res.status(status).send({ success: status === 200, error });
});

app.use(shopify.cspHeaders());
app.use(serveStatic(STATIC_PATH, { index: false }));

app.use("/*", shopify.ensureInstalledOnShop(), async (_req, res, _next) => {
  return res
    .status(200)
    .set("Content-Type", "text/html")
    .send(
      readFileSync(join(STATIC_PATH, "index.html"))
        .toString()
        .replace("%VITE_SHOPIFY_API_KEY%", process.env.SHOPIFY_API_KEY || "")
    );
});

app.listen(PORT);
