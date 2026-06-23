/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-23 20:42
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-23 20:42   by: IbyEll
 * modificato il: 2026-06-23 20:42   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *        Config overlay cruscotto — payload JSON per UI statica (qualsiasi PROJECT_{PRJ_NAME}).
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Le pagine HTML in cruscotto.frontend sono template generici; servono label, path e prefisso
 *     Jira del progetto attivo senza hardcode per overlay.
 *
 *   A cosa serve:
 *   - Costruisce oggetto iniettato in window.__CRUSCOTTO_PROJECT__ al serve HTML e API bootstrap.
 *
 * Generalizzazione:
 *   Si — payload da PRJ_NAME, project.config, portal.instance e discovery.config overlay.
 *
 * Input:
 *   - PRJ_NAME — overlay attivo (project.config, portal.instance)
 *   - PRODUCT_REPO_PATH — path product per label repo in UI
 *   - discovery.config overlay — servizi e porte stack dev
 *
 * Consumatori:
 *   - cruscotto.frontend/cruscotto.server.mjs — cache al launch, iniezione HTML e API
 *   - cruscotto.frontend/cruscotto.project.bootstrap.js — init window.CRUSCOTTO_PROJECT
 *
 * Export principali:
 *   - buildCruscottoProjectPayload — payload completo da project.config e portal.paths
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import {
  getProjectConfig
, getProjectGithubUrl
, projectHasProductDatabase
, resolveDefaultProductRepoPath
, resolveJiraBoardId
, resolveProjectOverlayName
} from "../project.config.mjs";
import { getDiscoveryConfig } from "./discovery.config.mjs";
import { getPortalRoot, resolveProductRepoPath } from "../portal.paths.resolver.mjs";
import { readInstanceForOverlay } from "../portal.instance.mjs";
import { getWorkingJiraBoardUrl } from "./working.plan.overlay.mjs";

/**
 * @typedef {{
 *   overlayName              : string
 *   repoName                 : string
 *   projectDisplayName       : string
 *   repoFolder               : string
 *   slug                     : string
 *   jiraPrefix               : string
 *   githubUrl                : string
 *   productRepoPath          : string
 *   defaultProductRepoSibling: string
 *   hasProductDatabase       : boolean
 *   dbFilename               : string
 *   dbPrismaRelPath          : string
 *   testScriptDir            : string
 *   dashboardPort            : number
 *   friendbotLabel           : string
 *   stackStartServiceIds     : string[]
 *   stackStartScriptRel      : string
 *   titles                   : {
 *     cruscotto     : string
 *     sidebarLocal  : string
 *     backlog       : string
 *     myBacklog     : string
 *     projectTree   : string
 *     pillarMatrix  : string
 *     myProject     : string
 *   }
 *   jiraSite                 : string
 *   jiraBoardId              : number
 *   jiraBoardUrl             : string
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
  const cfg                = getProjectConfig();
  const portalRoot         = getPortalRoot();
  const overlayName        = resolveProjectOverlayName();
  const repoName           = cfg.PRJ_NAME;
  const instance           = readInstanceForOverlay(overlayName);
  const projectDisplayName = String(instance?.prjName ?? repoName);
  const jiraPrefix         = cfg.PRJ_JIRA_PREFIX;
  const hasProductDatabase = projectHasProductDatabase(cfg);
  const discoveryCfg       = getDiscoveryConfig();
  const jiraSite           = String(process.env.JIRA_SITE ?? "myfuturejobsearch.atlassian.net").replace(/^https?:\/\//, "");
  const jiraBoardId        = resolveJiraBoardId(cfg);
  const jiraBoardUrl       = getWorkingJiraBoardUrl();

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
  , projectDisplayName
  , repoFolder                : cfg.PRJ_REPO
  , slug                      : cfg.PRJ_SLUG
  , jiraPrefix
  , githubUrl                 : getProjectGithubUrl()
  , productRepoPath           : resolveProductRepoPathForUi(portalRoot)
  , defaultProductRepoSibling : `../${cfg.PRJ_REPO}`
  , hasProductDatabase
  , dbFilename                : hasProductDatabase ? cfg.PRJ_DB_FILENAME : ""
  , dbPrismaRelPath           : hasProductDatabase ? cfg.PRJ_DB_PRISMA_DIR : ""
  , testScriptDir             : cfg.PRJ_TEST_SCRIPT
  , dashboardPort
  , jiraSite
  , jiraBoardId
  , jiraBoardUrl
  , friendbotLabel            : `friendBOT ${jiraPrefix}`
  , stackStartServiceIds      : [...discoveryCfg.stackStartServiceIds]
  , stackStartScriptRel       : discoveryCfg.stackStartScript.rel
  , titles                    : {
      cruscotto    : `Cruscotto ${projectDisplayName}`
    , sidebarLocal : `${projectDisplayName} local`
    , backlog      : `Backlog ${jiraPrefix} — Epic · Sprint · Pilastri`
    , myBacklog    : `MyBacklog ${jiraPrefix} — Epic · Sprint · Pilastri`
    , projectTree  : `Project Tree — backlog ${jiraPrefix}`
    , pillarMatrix : `Matrice pilastri — ${jiraPrefix} × visione × repo`
    , myProject    : `My Project — ${repoName} vs Jira ${jiraPrefix}`
    }
  };
}
