export { sectionLoadRiskRule } from "./section-load-risk.rule.ts";
export { duplicatePageScriptRule } from "./duplicate-page-script.rule.ts";

import type { ScanRule } from "../../../rules/types.ts";
import type { SectionPerformanceData } from "../types.ts";
import { sectionLoadRiskRule } from "./section-load-risk.rule.ts";
import {
  duplicatePageScriptRule,
  type DuplicatePageScriptData,
} from "./duplicate-page-script.rule.ts";

export const SECTION_PERFORMANCE_RULES: readonly ScanRule<SectionPerformanceData>[] =
  [sectionLoadRiskRule];

export const PAGE_PERFORMANCE_RULES: readonly ScanRule<DuplicatePageScriptData>[] =
  [duplicatePageScriptRule];
