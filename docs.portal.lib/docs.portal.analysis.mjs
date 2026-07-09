/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-26 08:40
 * ------------------------------------------------------------------------------------------------------------------------
 * creato il: 2026-06-26 08:40 by: IbyEll
 * modificato il: 2026-06-26 08:40 by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *        Analisi repo PortalAdmin — controlli architettura, grep e catalogo pagine docs
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Aggiorna documenti e generatori matrice devono leggere lo stesso stato repo (health, overlay,
 *     Jira PARKING, smoke) senza script duplicati per ogni pagina HTML.
 *
 *   A cosa serve:
 *   - analyzeRepository restituisce checks booleani; grepRepoFiles cerca pattern escludendo docs;
 *     listDocPages e isMatrixDocPage alimentano index e stile lista documenti.
 *
 * Generalizzazione:
 *   Si — portalRoot passato come argomento; SCAN_SKIP_PREFIXES configurabile per esclusioni scan.
 *
 * Input (obbligatorio se Si; se No scrivere «Input: —»):
 *   - portalRoot — root checkout PortalAdmin per analyzeRepository e listDocPages
 *   - pattern — regex stringa per grepRepoFiles
 *   - name, raw — filename e HTML per isMatrixDocPage
 *
 * Consumatori:
 *   - docs.portal.lib/docs.portal.mjs — refreshDocs e re-export
 *   - docs.portal/matrix.avanzamento.gap.feature.mjs — grepRepoFiles, analyzeRepository
 *   - docs.portal.lib/docs.portal.refresh.mjs — analyzeRepository su Aggiorna
 *
 * Export principali:
 *   - analyzeRepository — report checks e summary
 *   - grepRepoFiles — ricerca testuale repo con esclusioni
 *   - listDocPages, isMatrixDocPage — catalogo pagine docs.portal
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** Path esclusi da grep drift (staging, meta-doc, regole). */
export const SCAN_SKIP_PREFIXES = [
  "PARKING_tocheck/"
, "docs.portal/"
, "docs.portal.lib/"
, "docs/"
, "doc.cursor.rule/"
, ".cursor/"
];

/**
 * @param {string} rel
 * @returns {boolean}
 */
export function isScanExcluded(rel) {
  const norm = rel.replace(/\\/g, "/");

  return SCAN_SKIP_PREFIXES.some((pfx) => norm === pfx.replace(/\/$/, "") || norm.startsWith(pfx));
}

/**
 * @param {string} rel
 * @returns {boolean}
 */
export function isRuntimeArtifact(rel) {
  const norm = rel.replace(/\\/g, "/");

  return /\.runtime\.state\.json$/.test(norm)
    || /advancement\.finding-issues\.json$/.test(norm)
    || norm.startsWith("cruscotto.frontend/reports/");
}

/**
 * Cerca pattern nel repo escludendo PARKING, docs generati e artefatti runtime.
 *
 * @param {string} portalRoot
 * @param {string} pattern
 * @param {string} [rootRel]
 * @returns {string[]}
 */
export function grepRepoFiles(portalRoot, pattern, rootRel = ".") {
  const re   = new RegExp(pattern);
  /** @type {string[]} */
  const hits = [];

  const walk = (dirRel) => {
    const abs = join(portalRoot, dirRel);

    if (!existsSync(abs)) {
      return;
    }

    for (const name of readdirSync(abs)) {
      if (name === "node_modules" || name === ".git") {
        continue;
      }

      const rel  = join(dirRel, name).replace(/\\/g, "/");
      const full = join(portalRoot, rel);
      const st   = statSync(full);

      if (st.isDirectory()) {
        walk(rel);
        continue;
      }

      if (isScanExcluded(rel) || isRuntimeArtifact(rel)) {
        continue;
      }

      if (!/\.(mjs|js|json|yml|yaml|html|md|mdc)$/.test(name)) {
        continue;
      }

      if (re.test(readText(portalRoot, rel))) {
        hits.push(rel);
      }
    }
  };

  walk(rootRel);

  return hits.sort();
}

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
  const overlayDir     = existsSync(join(portalRoot, "admin.portal.lib/overlay/cruscotto.config.overlay.mjs"));
  const projectBase    = existsSync(join(portalRoot, "PROJECT_Base/page.project.overview.mjs"));
  const portalPaths    = existsSync(join(portalRoot, "admin.portal.lib/portal-paths.mjs"));
  const scriptsDir     = existsSync(join(portalRoot, "scripts"));
  const testSmoke      = existsSync(join(portalRoot, "test.smoke/smoke-ci.mjs"));
  const healthFe       = existsSync(join(portalRoot, "cruscotto.frontend/cruscotto.health.mjs"));
  const healthSrv      = existsSync(join(portalRoot, "server/cruscotto.health.mjs"));
  const testRunAll     = existsSync(join(portalRoot, "admin.portal.lib/test.run.all.mjs"));
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
    , label  : "Config overlay in admin.portal.lib/overlay/"
    , detail : overlayDir
        ? "cruscotto.config.overlay.mjs sotto admin.portal.lib/overlay/"
        : "admin.portal.lib/overlay/ assente"
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
        ? "admin.portal.lib/portal-paths.mjs ancora presente"
        : "Consumer su portal.paths.resolver.mjs"
    }
  , documentiTab: {
      ok     : documentiTab
    , label  : "Documenti in HOME"
    , detail : documentiTab ? "Sezione documenti in portal.home.html (HOME :3990)" : "Tab non ancora montata"
    }
  , docsChrome: {
      ok     : existsSync(join(portalRoot, "docs.portal/utility.toolbar.document.html"))
        && existsSync(join(portalRoot, "docs.portal/utility.toolbar.document.js"))
        && existsSync(join(portalRoot, "docs.portal/docs.style.css"))
    , label  : "Chrome docs condiviso"
    , detail : "utility.toolbar.document.html + .js + docs.style.css"
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
    , label  : "admin.portal.lib/test.run.all.mjs"
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
 * @param {string} name
 * @param {string} raw
 * @returns {boolean}
 */
export function isMatrixDocPage(name, raw) {
  if (/matrix/i.test(name)) {
    return true;
  }

  if (name === "Avanzamento_Gap_Feature.html") {
    return true;
  }

  return /<!-- FINDINGS:[\w-]+ -->/.test(raw) && /class="adv-card"/.test(raw);
}

/**
 * @param {string} portalRoot
 * @returns {{ name: string, title: string, href: string, kind: "matrix" | "doc" }[]}
 */
export function listDocPages(portalRoot) {
  const docsDir = join(portalRoot, "docs.portal");
  const skip    = new Set(["utility.toolbar.document.html", "docs-chrome.html"]);

  return readdirSync(docsDir)
    .filter((name) => name.endsWith(".html") && !skip.has(name))
    .sort((a, b) => {
      if (a === "1.document.index.html" || a === "index.html") {
        return -1;
      }

      if (b === "1.document.index.html" || b === "index.html") {
        return 1;
      }

      return a.localeCompare(b);
    })
    .map((name) => {
      const raw   = readText(portalRoot, `docs.portal/${name}`);
      const title = raw.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() ?? name;
      const kind  = isMatrixDocPage(name, raw) ? "matrix" : "doc";

      return { name, title, href: `/docs/${name}`, kind };
    });
}
