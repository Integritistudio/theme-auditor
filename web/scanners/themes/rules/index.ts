export { largeJavascriptRule } from "./large-javascript.rule.ts";
export { largeCssRule } from "./large-css.rule.ts";
export { duplicateScriptReferenceRule } from "./duplicate-script-reference.rule.ts";
export { duplicateExternalScriptUrlRule } from "./duplicate-external-script-url.rule.ts";
export { renderBlockingScriptRule } from "./render-blocking-script.rule.ts";
export { excessiveThirdPartyScriptsRule } from "./excessive-third-party-scripts.rule.ts";

import type { ScanRule } from "../../../rules/types.ts";
import type { ThemeRulesData } from "../types.ts";
import { largeJavascriptRule } from "./large-javascript.rule.ts";
import { largeCssRule } from "./large-css.rule.ts";
import { duplicateScriptReferenceRule } from "./duplicate-script-reference.rule.ts";
import { duplicateExternalScriptUrlRule } from "./duplicate-external-script-url.rule.ts";
import { renderBlockingScriptRule } from "./render-blocking-script.rule.ts";
import { excessiveThirdPartyScriptsRule } from "./excessive-third-party-scripts.rule.ts";

export const THEME_RULES: readonly ScanRule<ThemeRulesData>[] = [
  largeJavascriptRule,
  largeCssRule,
  duplicateScriptReferenceRule,
  duplicateExternalScriptUrlRule,
  renderBlockingScriptRule,
  excessiveThirdPartyScriptsRule,
];
