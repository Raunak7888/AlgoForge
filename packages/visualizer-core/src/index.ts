/**
 * The one visualizer compiler. Pure TypeScript: no DOM, no React, no Node APIs.
 * The browser (editor, canvas) and the API (validation on save) both import it,
 * so a script that compiles in one place compiles identically in the other.
 */
export { compileScript, compileValue, LIMITS as COMPILER_LIMITS } from "./script/compile";
export type { Beat, Compiled, Frame, InstanceMeta } from "./script/compile";
export { buildScriptSchema } from "./script/schema";
export { DS_NAMES, DS_TYPES, findDsType, opsOf } from "./core/registry";
export type { Diagnostic } from "./core/types";
export { analyzeScript, MAX_SCRIPT_CHARS, SCRIPT_SCHEMA_VERSION } from "./analyze";
export type { ScriptAnalysis, ScriptStructure } from "./analyze";
export { CATALOG_SCRIPTS, CATALOG_SLUGS } from "./catalog-scripts";
