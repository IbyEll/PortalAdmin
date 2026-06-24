/**
 * Analisi repo PortalAdmin per aggiornamento documentazione HTML (barrato + commento).
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * @param {string} portalRoot
 * @returns {string}
 */
function readText(portalRoot, rel) {
  const file = join(portalRoot, rel);

  if (!existsSync(file)) {
    return "";
  }

  return readFileSync(file, "utf8");
}

/**
 * @param {string} portalRoot
 * @returns {Record<string, { ok: boolean, label: string, detail: string }>}
 */
export function analyzeRepository(portalRoot) {
  const pkg            = readText(portalRoot, "package.json");
  const homeHtml       = readText(portalRoot, "admin.portal/portal.home.html");
  const homeJs         = readText(portalRoot, "cruscotto.frontend/cruscotto.home.js");
  const serverJs       = readText(portalRoot, "cruscotto.frontend/cruscotto.server.mjs");
  const parkingWorking = existsSync(join(portalRoot, "PARKING_tocheck/cruscotto.jira.working.html"));
  const overlayDir     = existsSync(join(portalRoot, "lib/overlay/cruscotto.config.overlay.mjs"));
  const projectBase    = existsSync(join(portalRoot, "PROJECT_Base/page.project.overview.mjs"));
  const portalPaths    = existsSync(join(portalRoot, "lib/portal-paths.mjs"));
  const scriptsDir     = existsSync(join(portalRoot, "scripts"));
  const testSmoke      = existsSync(join(portalRoot, "test.smoke/smoke-ci.mjs"));
  const healthFe       = existsSync(join(portalRoot, "cruscotto.frontend/cruscotto.health.mjs"));
  const healthSrv      = existsSync(join(portalRoot, "server/cruscotto.health.mjs"));
  const testRunAll     = existsSync(join(portalRoot, "lib/test.run.all.mjs"));
  const startDevOk     = /admin\.script\.standalone\/start-dev\.mjs/.test(pkg);
  const jiraFeDir      = existsSync(join(portalRoot, "cruscotto.frontend/jira"));
  const parkingJira    = existsSync(join(portalRoot, "PARKING_tocheck/cruscotto.frontend/jira"));

  const pkgUsesScripts = /node scripts\//.test(pkg);
  const smokeCiScripts = /scripts\/smoke-/.test(readText(portalRoot, "test.smoke/smoke-ci.mjs"));
  const jiraWorkingInNav = /data-tab="jiraworking"/.test(homeHtml);
  const jiraWorkingApi   = /\/api\/jira\/working\//.test(serverJs) && !serverJs.includes("// Jira Working");
  const documentiTab     = /data-portal-view="documenti"/.test(homeHtml);

  /** @type {Record<string, { ok: boolean, label: string, detail: string }>} */
  const checks = {
    jiraWorkingParked: {
      ok     : parkingWorking && !jiraWorkingInNav && !jiraWorkingApi
    , label  : "Jira Working in PARKING, fuori SPA"
    , detail : parkingWorking
        ? "HTML in PARKING_tocheck; tab e API working rimosse dal cruscotto attivo"
        : "Pagina working non trovata in PARKING"
    }
  , overlayInLibOverlay: {
      ok     : overlayDir
    , label  : "Config overlay in lib/overlay/"
    , detail : overlayDir
        ? "cruscotto.config.overlay.mjs sotto lib/overlay/"
        : "lib/overlay/ assente"
    }
  , projectBaseFallback: {
      ok     : projectBase
    , label  : "PROJECT_Base fallback"
    , detail : projectBase
        ? "PROJECT_Base con file condivisi"
        : "PROJECT_Base assente"
    }
  , packageJsonSmokePaths: {
      ok     : !pkgUsesScripts && testSmoke
    , label  : "package.json smoke → test.smoke/"
    , detail : pkgUsesScripts
        ? "package.json punta ancora a scripts/ (cartella assente)"
        : "Path smoke allineati a test.smoke/"
    }
  , smokeCiSteps: {
      ok     : !smokeCiScripts
    , label  : "smoke-ci.mjs STEPS"
    , detail : smokeCiScripts
        ? "STEPS ancora su scripts/"
        : "STEPS su test.smoke/"
    }
  , healthInFrontend: {
      ok     : healthFe && serverJs.includes("cruscotto.frontend/cruscotto.health.mjs")
    , label  : "Health in cruscotto.frontend"
    , detail : healthFe
        ? "cruscotto.health.mjs in frontend"
        : "Modulo health frontend assente"
    }
  , serverFolderOrphan: {
      ok     : !healthSrv || healthFe
    , label  : "server/ legacy"
    , detail : healthSrv
        ? "Copia server/cruscotto.health.mjs ancora presente (orfana se FE canonico)"
        : "Nessuna copia health in server/"
    }
  , portalPathsMigrated: {
      ok     : !portalPaths
    , label  : "Alias portal-paths rimosso"
    , detail : portalPaths
        ? "lib/portal-paths.mjs ancora presente"
        : "Consumer su portal.paths.resolver.mjs"
    }
  , documentiTab: {
      ok     : documentiTab
    , label  : "Documenti in HOME"
    , detail : documentiTab ? "Sezione documenti in portal.home.html (HOME :3990)" : "Tab non ancora montata"
    }
  , docsChrome: {
      ok     : existsSync(join(portalRoot, "docs/docs-chrome.html"))
    , label  : "Chrome docs condiviso"
    , detail : "docs/docs-chrome.html + CSS/JS"
    }
  , startDevCanonical: {
      ok     : startDevOk
    , label  : "start:dev canonico"
    , detail : startDevOk
        ? "package.json → admin.script.standalone/start-dev.mjs"
        : "package.json non punta a admin.script.standalone/start-dev.mjs"
    }
  , testRunAllPresent: {
      ok     : testRunAll
    , label  : "lib/test.run.all.mjs"
    , detail : testRunAll
        ? "Modulo presente; smoke-run-all può spawnarlo"
        : "File assente — smoke-run-all non può completare lo spawn"
    }
  , jiraFrontendDupRemoved: {
      ok     : !jiraFeDir
    , label  : "cruscotto.frontend/jira/ rimosso"
    , detail : jiraFeDir
        ? "Cartella duplicati ancora presente sotto cruscotto.frontend/jira/"
        : "Cartella eliminata; canonico solo admin.portal.JiraCORE/"
    }
  , parkingJiraCopy: {
      ok     : !parkingJira
    , label  : "PARKING jira/ copia"
    , detail : parkingJira
        ? "Copia parziale ancora in PARKING_tocheck/cruscotto.frontend/jira/"
        : "Nessuna copia jira in PARKING"
    }
  };

  return {
    analyzedAt : new Date().toISOString()
  , portalRoot
  , checks
  , summary: {
      passed : Object.values(checks).filter((c) => c.ok).length
    , failed : Object.values(checks).filter((c) => !c.ok).length
    , total  : Object.keys(checks).length
    }
  };
}

/**
 * @param {string} portalRoot
 * @returns {{ name: string, title: string, href: string }[]}
 */
export function listDocPages(portalRoot) {
  const docsDir = join(portalRoot, "docs");
  const skip    = new Set(["docs-chrome.html"]);

  return readdirSync(docsDir)
    .filter((name) => name.endsWith(".html") && !skip.has(name))
    .sort((a, b) => {
      if (a === "index.html") {
        return -1;
      }

      if (b === "index.html") {
        return 1;
      }

      return a.localeCompare(b);
    })
    .map((name) => {
      const raw   = readText(portalRoot, `docs/${name}`);
      const title = raw.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() ?? name;

      return { name, title, href: `/docs/${name}` };
    });
}
