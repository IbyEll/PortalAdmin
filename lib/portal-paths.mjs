/**
 * Alias retrocompatibile — risoluzione path PortalAdmin / product repo.
 *
 * @deprecated Usa lib/portal.paths.resolver.mjs
 */

export {
  getPortalRoot
, PORTAL_ROOT
, resolveProductRepoPath
, getProductRepoPath
, getTestScriptDir
, requireTestScriptDir
, getPortalDataDir
, getPortalFrontendDir
, getPortalReportsDir
, TEST_SCRIPT_DIR
} from "./portal.paths.resolver.mjs";
