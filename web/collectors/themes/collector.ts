import { GraphqlQueryError } from "@shopify/shopify-api";
import shopify from "../../shopify.js";
import type { ShopifyGraphqlSession } from "../products/collector.ts";
import { MAIN_THEME_QUERY, THEME_FILES_PAGE_QUERY } from "./queries.ts";
import { buildInternalThemeData } from "./normalize.ts";
import type {
  ShopifyThemeFileNode,
  ThemeCollectionResult,
} from "./types.ts";

export interface CollectThemeOptions {
  /** Theme file page size (1–50 recommended). Default 50. */
  pageSize?: number;
  shopDomain?: string;
}

type GraphqlClient = InstanceType<typeof shopify.api.clients.Graphql>;

/** Filename patterns that matter for asset size + script reference audits. */
const THEME_FILE_PATTERNS = [
  "assets/*.js",
  "assets/*.mjs",
  "assets/*.css",
  "layout/*",
  "snippets/*",
  "sections/*",
] as const;

function clampPageSize(value: number | undefined, fallback: number): number {
  const n = Number.isFinite(value) ? Number(value) : fallback;
  return Math.min(50, Math.max(1, Math.floor(n)));
}

function formatGraphqlError(error: unknown): Error {
  if (error instanceof GraphqlQueryError) {
    const responseText = JSON.stringify(error.response, null, 2);
    const combined = `${error.message}\n${responseText}`;
    if (
      /read_themes/i.test(combined) ||
      /Access denied for themes field/i.test(combined)
    ) {
      return new Error(
        "Theme access denied: this app install is missing the `read_themes` scope. " +
          "Restart `shopify app dev`, reopen the app, and accept the updated permissions " +
          "(or uninstall/reinstall the app on the development store)."
      );
    }
    return new Error(combined);
  }
  if (error instanceof Error) return error;
  return new Error("Unknown Shopify GraphQL error");
}

async function fetchMainTheme(
  client: GraphqlClient
): Promise<{ id: string; name: string; role: string }> {
  try {
    const response = await client.request(MAIN_THEME_QUERY);
    const theme = response?.data?.themes?.nodes?.[0];
    if (!theme?.id) {
      throw new Error("No MAIN (published) theme found for this shop.");
    }
    return {
      id: theme.id,
      name: theme.name || "Untitled theme",
      role: theme.role || "MAIN",
    };
  } catch (error) {
    throw formatGraphqlError(error);
  }
}

async function fetchThemeFilesPage(
  client: GraphqlClient,
  themeId: string,
  first: number,
  after: string | null,
  filenames: readonly string[]
): Promise<{
  nodes: ShopifyThemeFileNode[];
  hasNextPage: boolean;
  endCursor: string | null;
}> {
  try {
    const response = await client.request(THEME_FILES_PAGE_QUERY, {
      variables: {
        themeId,
        first,
        after,
        filenames: [...filenames],
      },
    });

    const files = response?.data?.theme?.files;
    if (!files) {
      throw new Error("Shopify theme files response missing data.theme.files");
    }

    const userErrors = Array.isArray(files.userErrors) ? files.userErrors : [];
    if (userErrors.length > 0) {
      console.warn("Theme files userErrors:", userErrors);
    }

    return {
      nodes: Array.isArray(files.nodes) ? files.nodes : [],
      hasNextPage: Boolean(files.pageInfo?.hasNextPage),
      endCursor: files.pageInfo?.endCursor ?? null,
    };
  } catch (error) {
    throw formatGraphqlError(error);
  }
}

/**
 * Collects and normalizes the published theme's assets + script references.
 */
export async function collectThemeData(
  session: ShopifyGraphqlSession,
  options: CollectThemeOptions = {}
): Promise<ThemeCollectionResult> {
  const pageSize = clampPageSize(options.pageSize, 50);
  const client = new shopify.api.clients.Graphql({ session });
  const main = await fetchMainTheme(client);

  const fileNodes: ShopifyThemeFileNode[] = [];
  let after: string | null = null;
  let hasNextPage = true;
  let pageCount = 0;

  while (hasNextPage) {
    const page = await fetchThemeFilesPage(
      client,
      main.id,
      pageSize,
      after,
      THEME_FILE_PATTERNS
    );
    pageCount += 1;
    fileNodes.push(...page.nodes);
    hasNextPage = page.hasNextPage;
    after = page.endCursor;

    if (hasNextPage && !after) {
      throw new Error(
        "Theme files pageInfo.hasNextPage is true but endCursor is missing"
      );
    }
  }

  const theme = buildInternalThemeData({
    themeId: main.id,
    themeName: main.name,
    themeRole: main.role,
    shopDomain: options.shopDomain || session.shop || null,
    fileNodes,
  });

  return {
    theme,
    filesFetched: fileNodes.length,
    pageCount,
  };
}
