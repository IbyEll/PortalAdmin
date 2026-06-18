/**
 * ** LIBRARY MODULE **
 * Config overlay cruscotto — payload JSON per UI statica (qualsiasi PROJECT_{PRJ_NAME}).
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - le pagine HTML in cruscotto.frontend/ sono template generici; servono label, path
 *     e prefisso Jira del progetto attivo senza hardcode per overlay
 *
 *   A cosa serve:
 *   - costruisce l'oggetto iniettato in window.__CRUSCOTTO_PROJECT__ al serve HTML
 *   - stesso payload su GET /api/cruscotto/project per bootstrap client fallback
 *
 * Consumatori:
 *   - runner/cruscotto.server.mjs — cache al launch, iniezione HTML e API
 *   - cruscotto.frontend/cruscotto.project.bootstrap.js — init window.CRUSCOTTO_PROJECT
 *
 * Export principali:
 *   - buildCruscottoProjectPayload — payload completo da project.config + portal.paths
 */

import {
  getProjectConfig
, getProjectGithubUrl
, resolveDefaultProductRepoPath
, resolveProjectOverlayName
} from "./project.config.mjs";
import { getPortalRoot, resolveProductRepoPath } from "./portal.paths.resolver.mjs";

/**
 * @typedef {{
 *   overlayName              : string
 *   repoName                 : string
 *   repoFolder               : string
 *   slug                     : string
 *   jiraPrefix               : string
 *   githubUrl                : string
 *   productRepoPath          : string
 *   defaultProductRepoSibling: string
 *   dbFilename               : string
 *   dbPrismaRelPath          : string
 *   testScriptDir            : string
 *   dashboardPort            : number
 *   friendbotLabel           : string
 *   titles                   : {
 *     cruscotto     : string
 *     sidebarLocal  : string
 *     backlog       : string
 *     working       : string
 *     projectTree   : string
 *     pillarMatrix  : string
 *   }
 * }} CruscottoProjectPayload
 */

// --- helper path — product repo per UI senza fail se checkout assente ---
/**
 * Path product repo per UI — non fallisce se checkout assente (path atteso comunque).
 *
 * @param {string} portalRoot
 * @returns {string}
 */
function resolveProductRepoPathForUi(portalRoot) {
  // 1. Path configurato se esiste su disco
  try {
    const resolved = resolveProductRepoPath({ required: false });

    if (resolved) {
      return resolved;
    }
  } catch {
    // path configurato ma assente — mostra comunque il valore atteso in UI
  }

  // 2. Fallback sibling ../PRJ_REPO da overlay attivo
  return resolveDefaultProductRepoPath(portalRoot);
}

// --- export pubblico — payload bootstrap cruscotto ---
/**
 * Costruisce il payload progetto per pagine HTML e API cruscotto.
 *
 * @param {{ dashboardPort?: number }} [opts]
 * @returns {CruscottoProjectPayload}
 */
export function buildCruscottoProjectPayload(opts = {}) {
  // 1. Config overlay (PRJ_NAME) e root PortalAdmin
  const cfg         = getProjectConfig();
  const portalRoot  = getPortalRoot();
  const overlayName = resolveProjectOverlayName();
  const repoName    = cfg.PRJ_NAME;
  const jiraPrefix  = cfg.PRJ_JIRA_PREFIX;

  // 2. Porta HTTP dashboard — override opts/env poi PRJ_DASHBOARD_PORT
  const dashboardPort = Number(
    opts.dashboardPort
    ?? process.env.DASHBOARD_PORT
    ?? process.env.ADMIN_PORT
    ?? process.env.PORT
    ?? cfg.PRJ_DASHBOARD_PORT
    ?? 3999
  );

  // 3. Oggetto serializzabile per iniezione script e GET /api/cruscotto/project
  return {
    overlayName
  , repoName
  , repoFolder                : cfg.PRJ_REPO
  , slug                      : cfg.PRJ_SLUG
  , jiraPrefix
  , githubUrl                 : getProjectGithubUrl()
  , productRepoPath           : resolveProductRepoPathForUi(portalRoot)
  , defaultProductRepoSibling : `../${cfg.PRJ_REPO}`
  , dbFilename                : cfg.PRJ_DB_FILENAME
  , dbPrismaRelPath           : cfg.PRJ_DB_PRISMA_DIR
  , testScriptDir             : cfg.PRJ_TEST_SCRIPT
  , dashboardPort
  , friendbotLabel            : `friendBOT ${jiraPrefix}`
  , titles                    : {
      cruscotto    : `Cruscotto ${repoName}`
    , sidebarLocal : `${repoName} local`
    , backlog      : `Backlog ${jiraPrefix} — Epic · Sprint · Pilastri`
    , working      : `Jira Working — Ordine di sviluppo backlog`
    , projectTree  : `Project Tree — backlog ${jiraPrefix}`
    , pillarMatrix : `Matrice pilastri — ${jiraPrefix} × visione × repo`
    }
  };
}
