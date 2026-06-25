#!/usr/bin/env node
/**
 * Analisi avanzamento PortalAdmin — architettura, import, legacy, gap, bug, deprecation.
 * Genera docs/Avanzamento_Gap_Feature.html
 *
 * Uso: node docs/Avanzamento_Gap_Feature.mjs [--stdout]
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { writeFile } from "node:fs/promises";

import { enrichFindingsWithIssueRefinement } from "../docs.portal.lib/docs.portal.advancement.issues.mjs";
import { enrichFindingsWithProject } from "../docs.portal.lib/docs.portal.advancement.project.mjs";
import { refreshAdvancementPageHtml } from "../docs.portal.lib/docs.portal.advancement.mjs";
import { isFreshEntry, parsePreviousAutoStates } from "../docs.portal.lib/docs.portal.refresh.mjs";
import {
  esc
, renderAdvancementChecksCard
, renderAdvancementMetricsCard
, renderAllAdvancementFindingSections
} from "../docs.portal.lib/docs.portal.advancement.render.mjs";
import { analyzeRepository } from "../docs.portal.lib/docs.portal.analysis.mjs";

const DOCS_DIR    = join(fileURLToPath(import.meta.url), "..");
const PORTAL_ROOT = join(DOCS_DIR, "..");
const OUT_HTML    = join(DOCS_DIR, "Avanzamento_Gap_Feature.html");

/**
 * @param {string} rel
 * @returns {string}
 */
function readText(rel) {
  const file = join(PORTAL_ROOT, rel);

  return existsSync(file) ? readFileSync(file, "utf8") : "";
}

/**
 * @param {string} dir
 * @returns {number}
 */
function countFilesRecursive(dir) {
  if (!existsSync(dir)) {
    return 0;
  }

  let n = 0;

  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st   = statSync(full);

    if (st.isDirectory()) {
      n += countFilesRecursive(full);
    } else {
      n += 1;
    }
  }

  return n;
}

/**
 * @param {string} pattern
 * @param {string} rootRel
 * @returns {string[]}
 */
function grepFiles(pattern, rootRel = ".") {
  const re    = new RegExp(pattern);
  const hits  = [];
  const walk  = (dirRel) => {
    const abs = join(PORTAL_ROOT, dirRel);

    if (!existsSync(abs)) {
      return;
    }

    for (const name of readdirSync(abs)) {
      if (name === "node_modules" || name === ".git") {
        continue;
      }

      const rel  = join(dirRel, name).replace(/\\/g, "/");
      const full = join(PORTAL_ROOT, rel);
      const st   = statSync(full);

      if (st.isDirectory()) {
        walk(rel);
        continue;
      }

      if (!/\.(mjs|js|json|yml|yaml|html|md|mdc)$/.test(name)) {
        continue;
      }

      if (re.test(readText(rel))) {
        hits.push(rel);
      }
    }
  };

  walk(rootRel);

  return hits.sort();
}

/** Path esclusi dalla scansione import live (meta-doc, staging, regole). */
const SCAN_SKIP_PREFIXES = [
  "PARKING_tocheck/"
, "docs.portal/"
, "docs.portal.lib/"
, "docs/"
, "doc.cursor.rule/"
, ".cursor/"
];

/** Import/export/require dinamico verso moduli in PARKING_tocheck (non menzioni in prosa). */
const LIVE_PARKING_IMPORT_RE = /(?:\bfrom\s+|\brequire\s*\(\s*|\bimport\s*\(\s*)["'`][^"'`]*PARKING_tocheck/;

/**
 * @param {string} rel
 * @returns {boolean}
 */
function isScanExcluded(rel) {
  const norm = rel.replace(/\\/g, "/");

  return SCAN_SKIP_PREFIXES.some((pfx) => norm === pfx.replace(/\/$/, "") || norm.startsWith(pfx));
}

/**
 * File .mjs/.js fuori PARKING con import o re-export verso PARKING_tocheck.
 *
 * @param {string} [rootRel]
 * @returns {string[]}
 */
function grepLiveParkingImports(rootRel = ".") {
  const hits = [];
  const walk = (dirRel) => {
    const abs = join(PORTAL_ROOT, dirRel);

    if (!existsSync(abs)) {
      return;
    }

    for (const name of readdirSync(abs)) {
      if (name === "node_modules" || name === ".git") {
        continue;
      }

      const rel  = join(dirRel, name).replace(/\\/g, "/");
      const full = join(PORTAL_ROOT, rel);
      const st   = statSync(full);

      if (st.isDirectory()) {
        walk(rel);
        continue;
      }

      if (isScanExcluded(rel) || !/\.mjs$/.test(name)) {
        continue;
      }

      if (LIVE_PARKING_IMPORT_RE.test(readText(rel))) {
        hits.push(rel);
      }
    }
  };

  walk(rootRel);

  return hits.sort();
}

/**
 * @typedef {{ id: string, category: string, severity: string, title: string, detail: string, paths: string[], status: string, issueKey?: string | null, issueSummary?: string | null, issueType?: string | null, project?: string | null }} Finding
 */

/**
 * @param {string} portalRoot
 * @returns {Promise<{ generatedAt: string, base: ReturnType<typeof analyzeRepository>, findings: Finding[], metrics: Record<string, unknown> }>}
 */
export async function analyzePortalAdvancement(portalRoot) {
  const base     = analyzeRepository(portalRoot);
  const pkg      = readText("package.json");
  const serverJs = readText("cruscotto.frontend/cruscotto.server.mjs");
  /** @type {Finding[]} */
  const findings = [];

  const add = (f) => findings.push(f);

  // —— Avanzamento / architettura completata ——
  const archDone = [
    { id: "arch-dual-server", title: "Dual entrypoint HOME + Dashboard", paths: ["admin.portal/portal.home.server.mjs", "cruscotto.frontend/cruscotto.server.mjs"], ok: true }
  , { id: "arch-overlay-lib", title: "Overlay in lib/overlay/", paths: ["lib/overlay/"], ok: existsSync(join(portalRoot, "lib/overlay/cruscotto.config.overlay.mjs")) }
  , { id: "arch-health-fe", title: "Health/dev API in cruscotto.frontend", paths: ["cruscotto.frontend/cruscotto.health.mjs"], ok: base.checks.healthInFrontend?.ok }
  , { id: "arch-jira-core", title: "Jira tooling canonico admin.portal.JiraCORE", paths: ["admin.portal.JiraCORE/"], ok: existsSync(join(portalRoot, "admin.portal.JiraCORE/jira.project.config.mjs")) }
  , { id: "arch-jira-dup-removed", title: "cruscotto.frontend/jira/ eliminato", paths: ["cruscotto.frontend/jira/"], ok: !existsSync(join(portalRoot, "cruscotto.frontend/jira")) }
  , { id: "arch-docs-portal", title: "Documenti HTML + chrome su HOME :3990", paths: ["docs/", "admin.portal/portal.home.html"], ok: base.checks.documentiTab?.ok && base.checks.docsChrome?.ok }
  , { id: "arch-start-dev", title: "start:dev → admin.script.standalone", paths: ["admin.script.standalone/start-dev.mjs"], ok: base.checks.startDevCanonical?.ok }
  , { id: "arch-smoke-files", title: "Smoke spostati in test.smoke/", paths: ["test.smoke/"], ok: existsSync(join(portalRoot, "test.smoke/smoke-ci.mjs")) }
  , { id: "arch-project-base", title: "PROJECT_Base fallback", paths: ["PROJECT_Base/"], ok: base.checks.projectBaseFallback?.ok }
  , { id: "arch-jira-working-parked", title: "Jira Working de-integata (PARKING)", paths: ["PARKING_tocheck/cruscotto.jira.working.html"], ok: base.checks.jiraWorkingParked?.ok }
  , { id: "arch-portal-paths-resolver", title: "portal.paths.resolver canonico", paths: ["lib/portal.paths.resolver.mjs"], ok: existsSync(join(portalRoot, "lib/portal.paths.resolver.mjs")) }
  , { id: "arch-server-legacy-gone", title: "server/ legacy rimosso", paths: ["server/"], ok: !existsSync(join(portalRoot, "server/cruscotto.health.mjs")) }
  ];

  for (const item of archDone) {
    add({
      id       : item.id
    , category : item.ok ? "avanzamento" : "architettura"
    , severity : item.ok ? "info" : "P1"
    , title    : item.title
    , detail   : item.ok ? "Completato / allineato allo stato target 2026-06." : "Migrazione incompleta o assente."
    , paths    : item.paths
    , status   : item.ok ? "done" : "open"
    });
  }

  // —— Gap P0/P1 ——
  if (!base.checks.packageJsonSmokePaths?.ok) {
    add({
      id       : "gap-npm-smoke-scripts"
    , category : "gap"
    , severity : "P0"
    , title    : "package.json punta a scripts/ (cartella assente)"
    , detail   : "8 npm script test:* e test:ci non eseguibili; target reale test.smoke/*.mjs."
    , paths    : ["package.json"]
    , status   : "open"
    });
  }

  if (!base.checks.smokeCiSteps?.ok) {
    add({
      id       : "gap-smoke-ci-steps"
    , category : "gap"
    , severity : "P0"
    , title    : "smoke-ci.mjs STEPS ancora su scripts/"
    , detail   : "Orchestratore CI interno fallisce anche dopo fix package.json se STEPS non aggiornati."
    , paths    : ["test.smoke/smoke-ci.mjs"]
    , status   : "open"
    });
  }

  const parkingImports = grepLiveParkingImports(".");

  if (parkingImports.length > 0) {
    add({
      id       : "gap-parking-live"
    , category : "gap"
    , severity : "P1"
    , title    : "PARKING_tocheck referenziato da moduli attivi"
    , detail   : `${parkingImports.length} moduli .mjs fuori PARKING importano o re-exportano da staging.`
    , paths    : parkingImports
    , status   : "partial"
    });
  }

  if (base.checks.parkingJiraCopy && !base.checks.parkingJiraCopy.ok) {
    add({
      id       : "gap-parking-jira-copy"
    , category : "gap"
    , severity : "P2"
    , title    : "Copia jira config in PARKING_tocheck/cruscotto.frontend/jira/"
    , detail   : base.checks.parkingJiraCopy.detail
    , paths    : ["PARKING_tocheck/cruscotto.frontend/jira/"]
    , status   : "open"
    });
  }

  // —— Bug runtime ——
  if (/await regenerateProjectTreeHtml\s*\(\)/.test(serverJs) && !/import\s*\{[^}]*regenerateProjectTreeHtml/.test(serverJs)) {
    add({
      id       : "bug-tree-regenerate"
    , category : "bug"
    , severity : "P1"
    , title    : "regenerateProjectTreeHtml chiamata senza import"
    , detail   : "POST route in cruscotto.server.mjs → ReferenceError a runtime; sorgente in PARKING_tocheck."
    , paths    : ["cruscotto.frontend/cruscotto.server.mjs", "PARKING_tocheck/cruscotto.jira.project.tree.plan.mjs"]
    , status   : "open"
    });
  }

  const publishJs = readText("admin.script.standalone/confluence.pillar.matrix.publish.mjs");

  if (publishJs.includes("generate-confluence-pillar-matrix.mjs")) {
    add({
      id       : "bug-confluence-import"
    , category : "bug"
    , severity : "P1"
    , title    : "Confluence publish import path errato"
    , detail   : "Import ./generate-confluence-pillar-matrix.mjs; file rinominato confluence.pillar.matrix.generate.mjs."
    , paths    : ["admin.script.standalone/confluence.pillar.matrix.publish.mjs"]
    , status   : "open"
    });
  }

  if (publishJs.includes("lib/pillar-matrix-diff.mjs") && !existsSync(join(portalRoot, "lib/pillar-matrix-diff.mjs"))) {
    add({
      id       : "bug-pillar-diff-path"
    , category : "bug"
    , severity : "P1"
    , title    : "pillar-matrix-diff solo in PARKING"
    , detail   : "publish importa ../lib/pillar-matrix-diff.mjs assente; copia in PARKING_tocheck/pillar-matrix-diff.mjs."
    , paths    : ["admin.script.standalone/confluence.pillar.matrix.publish.mjs", "PARKING_tocheck/pillar-matrix-diff.mjs"]
    , status   : "open"
    });
  }

  if (readText(".github/workflows/portal-smoke.yml").includes("portal-paths.mjs") && !existsSync(join(portalRoot, "lib/portal-paths.mjs"))) {
    add({
      id       : "bug-ci-portal-paths"
    , category : "bug"
    , severity : "P1"
    , title    : "CI workflow importa portal-paths.mjs rimosso"
    , detail   : "portal-smoke.yml inline node -e usa lib/portal-paths.mjs; usare portal.paths.resolver.mjs."
    , paths    : [".github/workflows/portal-smoke.yml"]
    , status   : "open"
    });
  }

  const startupScript = "admin.portal.testscript/cruscotto.setup/test.cruscotto.startup.mjs";
  const startupReal   = "admin.portal.testscript/funzionali/test.cruscotto.startup.mjs";

  if (pkg.includes(startupScript) && !existsSync(join(portalRoot, startupScript)) && existsSync(join(portalRoot, startupReal))) {
    add({
      id       : "bug-test-startup-path"
    , category : "bug"
    , severity : "P2"
    , title    : "test:cruscotto-startup path errato in package.json"
    , detail   : `Punta a ${startupScript}; file in funzionali/.`
    , paths    : ["package.json", startupReal]
    , status   : "open"
    });
  }

  // —— Deprecation ——
  const runnerRefs = grepFiles(String.raw`runner/cruscotto\.server`, ".").length;

  if (runnerRefs > 0) {
    add({
      id       : "dep-runner-comments"
    , category : "deprecation"
    , severity : "P2"
    , title    : "Commenti/doc citano cruscotto.frontend/cruscotto.server.mjs"
    , detail   : `${runnerRefs} file con path legacy; server canonico cruscotto.frontend/cruscotto.server.mjs.`
    , paths    : ["runner/", "cruscotto.frontend/cruscotto.server.mjs"]
    , status   : "open"
    });
  }

  if (existsSync(join(portalRoot, "runner/start-dev.mjs"))) {
    add({
      id       : "dep-runner-start-dev"
    , category : "deprecation"
    , severity : "P2"
    , title    : "runner/start-dev.mjs stub legacy"
    , detail   : "Canonico admin.script.standalone/start-dev.mjs (npm run start:dev)."
    , paths    : ["runner/start-dev.mjs", "admin.script.standalone/start-dev.mjs"]
    , status   : "open"
    });
  }

  const shimPortal = grepFiles(String.raw`portal-paths\.mjs`, ".").filter((p) => p !== "lib/portal-paths.mjs");

  if (shimPortal.length > 0) {
    add({
      id       : "dep-portal-paths-consumers"
    , category : "deprecation"
    , severity : "P2"
    , title    : "Consumer residui su portal-paths (shim rimosso)"
    , detail   : `${shimPortal.length} file importano lib/portal-paths.mjs non più presente.`
    , paths    : shimPortal.slice(0, 8)
    , status   : "open"
    });
  }

  // —— Feature completate ——
  add({
    id       : "feat-docs-auto-refresh"
  , category : "feature"
  , severity : "info"
  , title    : "Documenti HOME con Aggiorna + analisi repo"
  , detail   : "lib/docs.portal.* — verifica automatica, sezione DOCS-AUTO-ADDITIONS, stelline su delta."
  , paths    : ["lib/docs.portal.mjs", "lib/docs.portal.analysis.mjs", "docs/docs-chrome.js"]
  , status   : "done"
  });

  add({
    id       : "feat-instance-portal"
  , category : "feature"
  , severity : "info"
  , title    : "Multi-istanza overlay da HOME"
  , detail   : "portal.instance.mjs + card PROJECT_* + persistenza .env PRJ_NAME / PRODUCT_REPO_PATH."
  , paths    : ["lib/portal.instance.mjs", "admin.portal/portal.home.html"]
  , status   : "done"
  });

  add({
    id       : "feat-jira-core-gap"
  , category : "feature"
  , severity : "info"
  , title    : "JiraCORE gap analysis + close story workflow"
  , detail   : "CLI e Task agente per gap repo vs ticket, PR, catalogo segnali."
  , paths    : ["admin.portal.JiraCORE/jiraCORE.repo.issuekey.gap.analysis.mjs"]
  , status   : "done"
  });

  // —— Miglioramenti ——
  add({
    id       : "imp-promote-parking"
  , category : "miglioramento"
  , severity : "P2"
  , title    : "Promuovere moduli PARKING ancora live"
  , detail   : "my-project analysis, pillar generate → cruscotto.frontend/; ridurre import cross-PARKING."
  , paths    : ["PARKING_tocheck/cruscotto.jira.my-project.analysis.mjs", "lib/overlay/dashboard.project.mjs"]
  , status   : "open"
  });

  add({
    id       : "imp-ci-admin-overlay"
  , category : "miglioramento"
  , severity : "P2"
  , title    : "CI job AdminDashBoard + smoke admin:home"
  , detail   : "portal-smoke.yml copre solo JustLastOne; nessuno smoke HOME :3990."
  , paths    : [".github/workflows/portal-smoke.yml"]
  , status   : "open"
  });

  add({
    id       : "imp-readme-sync"
  , category : "miglioramento"
  , severity : "P2"
  , title    : "README allineato ad albero attuale"
  , detail   : "Aggiornare path cruscotto.frontend, test.smoke, assenza server/scripts."
  , paths    : ["README.md"]
  , status   : "open"
  });

  const archScore   = archDone.filter((a) => a.ok).length;
  const archTotal   = archDone.length;
  const openGaps    = findings.filter((f) => f.category === "gap" && f.status !== "done").length;
  const openBugs    = findings.filter((f) => f.category === "bug" && f.status === "open").length;
  const doneFeatures = findings.filter((f) => f.category === "feature" && f.status === "done").length;

  await enrichFindingsWithProject(findings);
  await enrichFindingsWithIssueRefinement(findings, portalRoot);

  return {
    generatedAt : new Date().toISOString()
  , base
  , findings
  , metrics     : {
      archProgressPct : Math.round((archScore / archTotal) * 100)
    , archScore
    , archTotal
    , checksPassed  : base.summary.passed
    , checksTotal   : base.summary.total
    , openGaps
    , openBugs
    , doneFeatures
    , parkingFiles  : countFilesRecursive(join(portalRoot, "PARKING_tocheck"))
    , parkingImports: parkingImports.length
    }
  };
}

/**
 * @param {Awaited<ReturnType<typeof analyzePortalAdvancement>>} report
 * @returns {string}
 */
export function renderAdvancementHtml(report) {
  const date  = report.generatedAt.slice(0, 19).replace("T", " ");
  const byCat = (cat) => report.findings.filter((f) => f.category === cat);

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>PortalAdmin — Avanzamento, gap e feature</title>
  <link rel="stylesheet" href="/docs/docs.style.css" />
</head>
<body>
  <!-- DOCS-CHROME -->
  <div class="page page--wide">
    <header>
      <h1>Avanzamento, gap e feature — PortalAdmin</h1>
      <p class="meta">Generato: ${esc(date)} · script <code>docs/Avanzamento_Gap_Feature.mjs</code></p>
      <p class="lead">Analisi dedotta da filesystem, import, package.json, CI e controlli automatici host.</p>
    </header>

    ${renderAdvancementMetricsCard(report)}
    ${renderAllAdvancementFindingSections(report, byCat)}
    ${renderAdvancementChecksCard(report)}

    <p class="meta">Rigenera: <code>node docs/Avanzamento_Gap_Feature.mjs</code> · Regola Cursor: ADMIN-AvanzamentoGapFeature.mdc</p>
  </div>
  <script src="/docs/docs-chrome.js" defer></script>
</body>
</html>`;
}

/**
 * @param {string} html
 * @param {string} iso
 * @returns {string}
 */
function updateGeneratedMeta(html, iso) {
  const date = iso.slice(0, 19).replace("T", " ");

  return html.replace(
    /(<p class="meta">Generato: )\d{4}-\d{2}-\d{2} \d{2}:\d{2}/
  , `$1${date}`
  );
}

// 1. CLI — analisi + scrittura HTML (solo invocazione diretta, non import)
const isCliMain = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCliMain) {
  const stdoutOnly = process.argv.includes("--stdout");
  const fullRender = process.argv.includes("--full");

  async function main() {
    const report = await analyzePortalAdvancement(PORTAL_ROOT);
    let html;

    const mergeMode = !stdoutOnly && !fullRender && existsSync(OUT_HTML);

    if (mergeMode) {
      const existing = readText(relative(PORTAL_ROOT, OUT_HTML));
      const prev     = parsePreviousAutoStates(existing);

      html = refreshAdvancementPageHtml(existing, report, prev, report.generatedAt, isFreshEntry);
      html = updateGeneratedMeta(html, report.generatedAt);
    } else {
      html = renderAdvancementHtml(report);
    }

    if (stdoutOnly) {
      process.stdout.write(html);
      return;
    }

    await writeFile(OUT_HTML, html, "utf8");
    console.log(`Scritto ${relative(PORTAL_ROOT, OUT_HTML)}${fullRender ? " (full)" : mergeMode ? " (merge)" : ""}`);
    console.log(`Architettura ${report.metrics.archProgressPct}% · gap ${report.metrics.openGaps} · bug ${report.metrics.openBugs}`);
  }

  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
}
