import { collectThemeData } from "../../collectors/themes/index.ts";
import type { ShopifyGraphqlSession } from "../../collectors/products/index.ts";
import { runRules } from "../../rules/runner.ts";
import { setScanProgress } from "../../scans/lifecycle.ts";
import { recalculateAndPersistScanScores } from "../../scoring/index.ts";
import { saveDetectedIssues } from "../products/persist.ts";
import { THEME_RULES } from "./rules/index.ts";

export interface ThemeScannerOptions {
  scanId: string;
  session: ShopifyGraphqlSession;
  shopDomain?: string;
}

export interface ThemeScannerResult {
  themeId: string;
  themeName: string;
  filesFetched: number;
  pageCount: number;
  scriptReferences: number;
  issuesSaved: number;
  rulesFailed: number;
}

const THEME_STAGE_START = 40;
const THEME_STAGE_MID = 50;
const THEME_STAGE_END = 59;

/**
 * Theme scanner: collect → normalize → run theme rules → save issues.
 */
export async function runThemeScanner(
  options: ThemeScannerOptions
): Promise<ThemeScannerResult> {
  const { scanId, session, shopDomain } = options;

  await setScanProgress(scanId, "THEME", THEME_STAGE_START);

  const collection = await collectThemeData(session, {
    shopDomain: shopDomain || session.shop,
  });

  await setScanProgress(scanId, "THEME", THEME_STAGE_MID);

  const summary = await runRules(
    THEME_RULES,
    { theme: collection.theme },
    {
      context: {
        scanId,
        shopDomain: shopDomain || session.shop,
        extras: {
          themeId: collection.theme.themeId,
          themeName: collection.theme.themeName,
        },
      },
    }
  );

  const issuesSaved = await saveDetectedIssues(scanId, summary.issues);
  await recalculateAndPersistScanScores(scanId);
  await setScanProgress(scanId, "THEME", THEME_STAGE_END);

  return {
    themeId: collection.theme.themeId,
    themeName: collection.theme.themeName,
    filesFetched: collection.filesFetched,
    pageCount: collection.pageCount,
    scriptReferences: collection.theme.scriptReferences.length,
    issuesSaved,
    rulesFailed: summary.rulesFailed,
  };
}
