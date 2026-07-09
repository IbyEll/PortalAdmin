/**
 * Catalogo audit ridondanze — scan ibrido + merge JSON precedente.
 *
 * Consumatori:
 *   - docs.portal/matrix.repo.audit.ridondanze.gap.mjs
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { grepRepoFiles } from "./docs.portal.analysis.mjs";
import { findingToMatrixRow } from "./matrix.gap.mjs";
import { analyzePortalAdvancement, grepLiveParkingImports } from "./matrix.gap.scan.mjs";
import { loadFindingIssueLinks } from "./matrix.finding-issues.store.mjs";
import { summarizeMatrixSections } from "./matrix.render.mjs";

/** @typedef {import("./matrix.render.mjs").MatrixRow} MatrixRow */
/** @typedef {import("./matrix.render.mjs").MatrixSection} MatrixSection */
/** @typedef {import("./matrix.gap.scan.mjs").Finding} Finding */

const PA = "PortalAdmin";

/** Scan finding id → audit row id (canonical per Issue refinement / JSON). */
export const SCAN_FINDING_TO_AUDIT_ID = {
  "arch-dual-server"        : "audit-arch-home"
, "arch-overlay-lib"        : "audit-arch-overlay"
, "arch-health-fe"          : "audit-arch-health"
, "arch-jira-core"          : "audit-arch-jira"
, "arch-jira-dup-removed"   : "audit-red-jira-dup"
, "arch-start-dev"          : "audit-arch-startdev"
, "arch-smoke-files"        : "audit-arch-runall"
, "arch-project-base"       : "audit-red-project-base"
, "arch-jira-working-parked": "audit-park-working"
, "bug-tree-regenerate"     : "audit-gap-tree-regen"
, "bug-confluence-import"   : "audit-gap-confluence-gen"
, "bug-pillar-diff-path"    : "audit-gap-pillar-diff"
, "bug-test-startup-path"   : "audit-gap-startup-path"
, "dep-portal-paths-consumers": "audit-red-portal-paths"
, "dep-runner-comments"     : "audit-arch-dashboard"
, "gap-parking-jira-copy"   : "audit-red-parking-jira-copy"
, "imp-promote-parking"     : "audit-imp-parking-promote"
, "imp-ci-admin-overlay"    : "audit-imp-test-ci"
, "imp-readme-sync"         : "audit-imp-readme-sync"
};

export const AUDIT_SECTION_DEFS = [
  { id: "arch", title: "Architettura target vs legacy", open: true }
, { id: "parking", title: "PARKING_tocheck — live nel flusso", open: true }
, { id: "redundancy", title: "Ridondanze e drift" }
, { id: "gap", title: "Gap import / runtime", open: true }
, { id: "improv", title: "Miglioramenti consigliati" }
, { id: "priority", title: "Priorità backlog (R1–R7)", open: true }
];

/**
 * Voce catalogo: id audit canonico, sezione, finding scan collegati, fallback se assente dallo scan.
 *
 * @typedef {{
 *   id: string
 *   section: string
 *   scanIds?: string[]
 *   fallback?: Partial<MatrixRow>
 *   create?: MatrixRow["create"]
 * }} AuditCatalogEntry
 */

/** @type {AuditCatalogEntry[]} */
export const AUDIT_CATALOG = [
  { id: "audit-arch-dashboard", section: "arch", scanIds: ["dep-runner-comments"], fallback: { sev: "warn", status: "coperto", voce: "Dashboard HTTP", dettaglio: "Canonico cruscotto.frontend/cruscotto.server.mjs — nessun drift path legacy rilevato", paths: ["cruscotto.frontend/cruscotto.server.mjs"] } }
, { id: "audit-arch-home", section: "arch", scanIds: ["arch-dual-server"], fallback: { sev: "info", status: "coperto", voce: "HOME portal", dettaglio: "admin.portal/portal.home.server.mjs — nessun duplicato server", paths: ["admin.portal/portal.home.server.mjs"] } }
, { id: "audit-arch-health", section: "arch", scanIds: ["arch-health-fe"] }
, { id: "audit-arch-startdev", section: "arch", scanIds: ["arch-start-dev"] }
, { id: "audit-arch-runall", section: "arch", scanIds: ["arch-smoke-files"] }
, { id: "audit-arch-overlay", section: "arch", scanIds: ["arch-overlay-lib"] }
, { id: "audit-arch-jira", section: "arch", scanIds: ["arch-jira-core"] }
, { id: "audit-park-myproject", section: "parking", scanIds: ["audit-park-myproject"], create: { section: "PARKING live", summary: "Promuovere my-project analysis in cruscotto.frontend", detail: "Eliminare import cross-PARKING da dashboard.project.mjs." } }
, { id: "audit-park-pillar-url", section: "parking", scanIds: ["audit-park-pillar-url"], create: { section: "PARKING live", summary: "Pillar matrix URL da cruscotto.frontend/pillar-matrix/", detail: "Allineare backlog pillars a path frontend canonico." } }
, { id: "audit-park-close-pillar", section: "parking", scanIds: ["audit-park-close-pillar"] }
, { id: "audit-park-pillar-regen", section: "parking", scanIds: ["audit-park-pillar-regen"], create: { section: "PARKING live", summary: "Pillar generate output in cruscotto.frontend/pillar-matrix/", detail: "Spostare generate e consumer API su path frontend." } }
, { id: "audit-park-working", section: "parking", scanIds: ["arch-jira-working-parked"] }
, { id: "audit-red-jira-config", section: "redundancy", scanIds: ["audit-red-jira-config"], fallback: { sev: "info", status: "coperto", voce: "Config Jira scan canonica", dettaglio: "admin.portal.JiraCORE/jira.project.config.mjs — gap analysis, signals, scan paths", paths: ["admin.portal.JiraCORE/jira.project.config.mjs"] } }
, { id: "audit-red-jira-dup", section: "redundancy", scanIds: ["arch-jira-dup-removed"] }
, { id: "audit-red-parking-jira-copy", section: "redundancy", scanIds: ["gap-parking-jira-copy", "audit-red-parking-jira-copy"] }
, { id: "audit-red-overlay-drift", section: "redundancy", scanIds: ["audit-red-overlay-drift"] }
, { id: "audit-red-portal-paths", section: "redundancy", scanIds: ["dep-portal-paths-consumers"], create: { section: "Alias e shim", summary: "Allineare consumer a portal.paths.resolver.mjs", detail: "portal-paths.mjs assente; aggiornare workflow CI e fixtures." } }
, { id: "audit-red-project-base", section: "redundancy", scanIds: ["arch-project-base"] }
, { id: "audit-red-discovery-manifest", section: "redundancy", scanIds: ["audit-red-discovery-manifest"] }
, { id: "audit-red-smoke-npm", section: "redundancy", scanIds: ["audit-red-smoke-npm", "arch-smoke-files"], fallback: { sev: "info", status: "coperto", voce: "Smoke path in package.json", dettaglio: "test:ci e script npm puntano a test.smoke/", paths: ["package.json", "test.smoke/smoke-ci.mjs"] } }
, { id: "audit-gap-jlo-plan-data", section: "gap", scanIds: ["audit-gap-jlo-plan-data"], create: { section: "Gap import", summary: "Ripristinare working.plan.data.JustLastOne.mjs", detail: "P0 — piano sprint JLO e devOrder backlog." } }
, { id: "audit-gap-tree-regen", section: "gap", scanIds: ["bug-tree-regenerate"], create: { section: "Gap import", summary: "Fix regenerateProjectTreeHtml su cruscotto.server", detail: "Re-import plan module o disabilitare route fino a promote." } }
, { id: "audit-gap-confluence-gen", section: "gap", scanIds: ["bug-confluence-import"] }
, { id: "audit-gap-pillar-diff", section: "gap", scanIds: ["bug-pillar-diff-path"], create: { section: "Gap import", summary: "Promuovere pillar-matrix-diff sotto admin.portal.lib o standalone", detail: "Fix import publish Confluence." } }
, { id: "audit-gap-startup-path", section: "gap", scanIds: ["bug-test-startup-path"], create: { section: "Gap import", summary: "Fix path test:cruscotto-startup in package.json", detail: "Allineare a admin.portal.testscript/funzionali/." } }
, { id: "audit-imp-smoke-wiring", section: "improv", scanIds: ["audit-imp-smoke-wiring", "arch-smoke-files"], fallback: { sev: "info", status: "coperto", voce: "Quick win — smoke npm/CI", dettaglio: "package.json e smoke-ci allineati a test.smoke/", paths: ["package.json", "test.smoke/smoke-ci.mjs"] } }
, { id: "audit-imp-shim-jira", section: "improv", scanIds: ["audit-imp-shim-jira"] }
, { id: "audit-imp-parking-promote", section: "improv", scanIds: ["imp-promote-parking", "gap-parking-live"], create: { section: "Miglioramenti", summary: "Promuovere moduli PARKING ancora live", detail: "Ridurre import cross-PARKING nel flusso principale." } }
, { id: "audit-imp-jira-scan", section: "improv", scanIds: ["audit-imp-jira-scan"] }
, { id: "audit-imp-server-cleanup", section: "improv", scanIds: ["audit-imp-server-cleanup"] }
, { id: "audit-imp-test-ci", section: "improv", scanIds: ["imp-ci-admin-overlay"], create: { section: "Test e CI", summary: "CI job AdminDashBoard + smoke HOME :3990", detail: "Copertura overlay host PortalAdmin." } }
, { id: "audit-imp-portal-api", section: "improv", scanIds: ["audit-imp-portal-api"], fallback: { sev: "warn", status: "parziale", voce: "admin.portal.testscript fuori test:ci", dettaglio: "~23 script API — richiedono cruscotto up; non in smoke CI default", paths: ["admin.portal.testscript/"] } }
, { id: "audit-imp-comcom", section: "improv", scanIds: ["audit-imp-comcom"], fallback: { sev: "info", status: "coperto", voce: "Comcom testata moduli principali", dettaglio: "lib, PROJECT_*, test.smoke, cruscotto, JiraCORE, admin.portal — drift commenti legacy residuo", paths: [".cursor/rules/ADMIN-Comcom.mdc"] } }
, { id: "audit-imp-readme-sync", section: "improv", scanIds: ["imp-readme-sync"] }
];

/** @type {{ id: string, sourceId: string, voce: string, create?: MatrixRow["create"] }[]} */
const PRIORITY_DEFS = [
  { id: "audit-prio-r1", sourceId: "audit-imp-smoke-wiring", voce: "R1 — Fix path smoke npm/CI" }
, { id: "audit-prio-r2", sourceId: "audit-imp-shim-jira", voce: "R2 — Shim lib JiraCORE" }
, { id: "audit-prio-r3", sourceId: "audit-gap-jlo-plan-data", voce: "R3 — working.plan.data JLO", create: { section: "Priorità backlog", summary: "Ripristino working.plan.data.JustLastOne.mjs", detail: "P0 piano sprint e devOrder." } }
, { id: "audit-prio-r4", sourceId: "audit-gap-confluence-gen", voce: "R4 — Confluence publish + pillar-diff", create: { section: "Priorità backlog", summary: "Fix Confluence pillar publish imports", detail: "R4 audit matrice priorità." } }
, { id: "audit-prio-r5", sourceId: "audit-imp-parking-promote", voce: "R5 — Promote PARKING frontend", create: { section: "Priorità backlog", summary: "Promote PARKING moduli live", detail: "Architettura pulita — R5." } }
, { id: "audit-prio-r6", sourceId: "audit-imp-test-ci", voce: "R6 — CI AdminDashBoard + HOME", create: { section: "Priorità backlog", summary: "CI smoke AdminDashBoard e admin:home", detail: "R6 audit." } }
, { id: "audit-prio-r7", sourceId: "audit-imp-jira-scan", voce: "R7 — Jira config unico + scan paths" }
];

/**
 * @param {string} portalRoot
 * @param {string} rel
 * @returns {string}
 */
function readTextAt(portalRoot, rel) {
  const file = join(portalRoot, rel);

  return existsSync(file) ? readFileSync(file, "utf8") : "";
}

/**
 * Finding audit-only non coperti da matrix.gap.scan (id = audit id canonico).
 *
 * @param {string} portalRoot
 * @param {Finding[]} findings
 */
export function supplementRepoAuditFindings(portalRoot, findings) {
  const has = (id) => findings.some((f) => f.id === id);
  const add = (f) => {
    if (!has(f.id)) {
      findings.push(f);
    }
  };

  const jloPlan = "PROJECT_JustLastOne/working.plan.data.JustLastOne.mjs";

  if (!existsSync(join(portalRoot, jloPlan))) {
    const orderJs = readTextAt(portalRoot, "cruscotto.frontend/cruscotto.jira.working.order.mjs");
    const overlay = readTextAt(portalRoot, "admin.portal.lib/overlay/working.plan.overlay.mjs");

    if (orderJs.includes("working.plan.data") || overlay.includes("working.plan.data")) {
      add({
        id       : "audit-gap-jlo-plan-data"
      , category : "gap"
      , severity : "P0"
      , title    : "working.plan.data.JustLastOne.mjs assente"
      , detail   : "Import in working.order.mjs e working.plan.overlay.mjs — file mancante in PROJECT_JustLastOne/"
      , paths    : [jloPlan, "cruscotto.frontend/cruscotto.jira.working.order.mjs", "admin.portal.lib/overlay/working.plan.overlay.mjs"]
      , status   : "open"
      , project  : "JustLastOne"
      });
    }
  }

  const parkingHits = grepLiveParkingImports(portalRoot, ".");

  if (parkingHits.some((p) => p.includes("my-project"))) {
    add({
      id       : "audit-park-myproject"
    , category : "gap"
    , severity : "P2"
    , title    : "My-project analysis da PARKING"
    , detail   : "dashboard.project.mjs importa analyze da PARKING_tocheck"
    , paths    : ["PARKING_tocheck/cruscotto.jira.my-project.analysis.mjs", "admin.portal.lib/overlay/dashboard.project.mjs"]
    , status   : "open"
    });
  }

  const pillarsJs = readTextAt(portalRoot, "cruscotto.frontend/cruscotto.jira.backlog.pillars.mjs");

  if (pillarsJs.includes("PARKING_tocheck") || pillarsJs.includes("cruscotto.jira.pillar.matrix.portal")) {
    add({
      id       : "audit-park-pillar-url"
    , category : "gap"
    , severity : "P2"
    , title    : "URL pilastri da PARKING"
    , detail   : "cruscotto.jira.backlog.pillars.mjs punta a sorgente in PARKING_tocheck"
    , paths    : ["cruscotto.frontend/cruscotto.jira.backlog.pillars.mjs", "PARKING_tocheck/cruscotto.jira.pillar.matrix.portal.mjs"]
    , status   : "open"
    });
  }

  const closeStory = readTextAt(portalRoot, "admin.portal.JiraCORE/jiraCORE.close.story.mjs");

  if (closeStory.includes("pillar-matrix") && closeStory.includes("PARKING_tocheck")) {
    add({
      id       : "audit-park-close-pillar"
    , category : "gap"
    , severity : "P2"
    , title    : "close-story --pillar path obsoleto"
    , detail   : "jiraCORE.close.story.mjs --pillar usa git path cruscotto/pillar-matrix legacy"
    , paths    : ["admin.portal.JiraCORE/jiraCORE.close.story.mjs", "PARKING_tocheck/pillar-matrix-targeted.mjs"]
    , status   : "partial"
    });
  }

  const serverJs = readTextAt(portalRoot, "cruscotto.frontend/cruscotto.server.mjs");

  if (/PARKING_tocheck\/.*pillar.*generate/.test(serverJs) || /pillar-matrix\.portal\.generate/.test(serverJs)) {
    add({
      id       : "audit-park-pillar-regen"
    , category : "gap"
    , severity : "P2"
    , title    : "API regenerate pillar in PARKING"
    , detail   : "POST regenerate scrive in PARKING_tocheck/pillar-matrix/ non in frontend"
    , paths    : ["cruscotto.frontend/cruscotto.server.mjs", "PARKING_tocheck/cruscotto.jira.pillar.matrix.portal.generate.mjs"]
    , status   : "open"
    });
  }

  if (existsSync(join(portalRoot, "admin.portal.JiraCORE/jira.project.config.mjs"))) {
    add({
      id       : "audit-red-jira-config"
    , category : "architettura"
    , severity : "info"
    , title    : "Config Jira scan canonica"
    , detail   : "admin.portal.JiraCORE/jira.project.config.mjs — gap analysis, signals, scan paths"
    , paths    : ["admin.portal.JiraCORE/jira.project.config.mjs"]
    , status   : "done"
    });
  }

  const overlayDrift = grepRepoFiles(portalRoot, String.raw`admin\.portal\.lib/dashboard\.project\.mjs`)
    .filter((p) => p.startsWith(".cursor/"));

  if (overlayDrift.length > 0) {
    add({
      id       : "audit-red-overlay-drift"
    , category : "deprecation"
    , severity : "warn"
    , title    : "Commenti path overlay legacy"
    , detail   : "Regole Cursor citano admin.portal.lib/dashboard.project.mjs (spostato in overlay/)"
    , paths    : ["admin.portal.lib/overlay/dashboard.project.mjs", ".cursor/rules/"]
    , status   : "partial"
    });
  }

  const jiraCfg = readTextAt(portalRoot, "admin.portal.JiraCORE/jira.project.config.mjs");

  if (jiraCfg.includes("server/") || jiraCfg.includes("scripts/")) {
    add({
      id       : "audit-imp-jira-scan"
    , category : "miglioramento"
    , severity : "P2"
    , title    : "Scan paths Jira config"
    , detail   : "Rimuovere path fantasma server/, scripts/ da jira.project.config.mjs"
    , paths    : ["admin.portal.JiraCORE/jira.project.config.mjs"]
    , status   : "partial"
    });
  }

  const shimHits = grepRepoFiles(portalRoot, String.raw`admin\.portal\.lib/[^"']*jira`)
    .filter((p) => p.startsWith("test.smoke/"));

  if (shimHits.length > 0) {
    add({
      id       : "audit-imp-shim-jira"
    , category : "miglioramento"
    , severity : "P1"
    , title    : "Shim lib → JiraCORE"
    , detail   : "Smoke importano path admin.portal.lib/* — verificare re-export o aggiornare import diretti JiraCORE"
    , paths    : ["admin.portal.JiraCORE/jira.function.repo.refs.mjs", ...shimHits.slice(0, 4)]
    , status   : "partial"
    });
  }

  if (existsSync(join(portalRoot, "server")) || existsSync(join(portalRoot, "runner"))) {
    add({
      id       : "audit-imp-server-cleanup"
    , category : "miglioramento"
    , severity : "P3"
    , title    : "Pulizia server/ e runner/"
    , detail   : "Rimuovere residui orfani se non importati"
    , paths    : ["server/", "runner/"]
    , status   : "partial"
    });
  }

  const manifestOk = existsSync(join(portalRoot, "admin.portal.lib/discovery.services.repo.mjs"))
    && existsSync(join(portalRoot, "lib/product.manifest.mjs"));

  if (manifestOk) {
    add({
      id       : "audit-red-discovery-manifest"
    , category : "miglioramento"
    , severity : "P3"
    , title    : "Discovery + manifest + servicePathById"
    , detail   : "Stesso servizio descritto 3 volte per overlay — single source da definire"
    , paths    : ["admin.portal.lib/discovery.services.repo.mjs", "lib/product.manifest.mjs"]
    , status   : "partial"
    });
  }
}

/**
 * @param {Finding} f
 * @returns {string}
 */
function resolveAuditId(f) {
  return SCAN_FINDING_TO_AUDIT_ID[f.id] ?? f.id;
}

/**
 * @param {Finding[]} findings
 * @returns {Map<string, { finding: Finding, row: MatrixRow }>}
 */
function indexScannedRows(findings) {
  /** @type {Map<string, { finding: Finding, row: MatrixRow }>} */
  const map = new Map();

  for (const f of findings) {
    const auditId = resolveAuditId(f);
    const row     = findingToMatrixRow({ ...f, id: auditId });

    if (!map.has(auditId)) {
      map.set(auditId, { finding: f, row });
    }
  }

  return map;
}

/**
 * @param {string | undefined} status
 * @returns {boolean}
 */
function isRowOpen(status) {
  const s = String(status ?? "").trim().toLowerCase();

  return s === "gap" || s === "open" || s === "parziale";
}

/**
 * @param {string} generatedAt
 * @returns {string}
 */
function formatScanStamp(generatedAt) {
  return generatedAt.slice(0, 19).replace("T", " ");
}

/**
 * @param {MatrixRow} prev
 * @param {string} id
 * @param {{ key: string, issueType?: string } | undefined} link
 * @param {string} generatedAt
 * @returns {MatrixRow}
 */
function markRowObsolete(prev, id, link, generatedAt) {
  if (link?.key) {
    return {
      ...prev
    , id
    , status     : "fatto"
    , issueKey   : link.key
    , issueType  : link.issueType ?? prev.issueType ?? null
    , create     : undefined
    , resolvedNote: prev.resolvedNote || `✅ ${link.key} — non più rilevato allo scan (${formatScanStamp(generatedAt)})`
    };
  }

  const stamp = formatScanStamp(generatedAt);
  const scanLine = `Ultimo scan ${stamp}.`;
  let resolvedNote;

  if (prev.status === "obsoleto" && prev.resolvedNote) {
    const base = prev.resolvedNote.replace(/\s·\sUltimo scan [^.]+\./, "").trim();

    resolvedNote = base ? `${base} · ${scanLine}` : `⚠ voce non più rilevata dallo scan (storico catalogo) · ${scanLine}`;
  } else {
    resolvedNote = `⚠ voce non più rilevata dallo scan (storico catalogo) · ${scanLine}`;
  }

  return {
    ...prev
  , id
  , status     : "obsoleto"
  , create     : undefined
  , resolvedNote
  };
}

/**
 * @param {string} rowId
 * @param {string[]} scanIds
 * @param {ReturnType<typeof loadFindingIssueLinks>} issueLinks
 * @returns {{ key: string, issueType?: string } | undefined}
 */
function resolveIssueLink(rowId, scanIds, issueLinks) {
  return [rowId, ...scanIds]
    .map((k) => issueLinks.get(k))
    .find(Boolean);
}

/**
 * @param {MatrixRow} older
 * @param {MatrixRow} newer
 * @returns {MatrixRow}
 */
function mergeHistoricalRow(older, newer) {
  return {
    ...older
  , ...newer
  , issueKey     : newer.issueKey ?? older.issueKey ?? null
  , issueType    : newer.issueType ?? older.issueType ?? null
  , issueSummary : newer.issueSummary ?? older.issueSummary ?? null
  , resolvedNote : newer.resolvedNote || older.resolvedNote || ""
  , paths        : newer.paths?.length ? newer.paths : older.paths
  };
}

/**
 * @param {string} jsonPath
 * @param {{ legacyJsonPaths?: string[] }} [opts]
 * @returns {{ rows: Map<string, MatrixRow>, sectionById: Map<string, string> }}
 */
export function loadPreviousAuditCatalog(jsonPath, opts = {}) {
  /** @type {Map<string, MatrixRow>} */
  const rows = new Map();
  /** @type {Map<string, string>} */
  const sectionById = new Map();
  const paths = [...(opts.legacyJsonPaths ?? []), jsonPath].filter((p) => existsSync(p));

  for (const file of paths) {
    try {
      const data = JSON.parse(readFileSync(file, "utf8"));

      const catalogSections = data.source === "unified" && Array.isArray(data.audit)
        ? data.audit
        : (data.sections ?? []);

      for (const sec of catalogSections) {
        for (const row of sec.rows ?? []) {
          if (!row?.id) {
            continue;
          }

          const prev = rows.get(row.id);

          rows.set(row.id, prev ? mergeHistoricalRow(prev, row) : row);
          sectionById.set(row.id, sec.id);
        }
      }
    } catch {
      // file corrotto — salta
    }
  }

  return { rows, sectionById };
}

/**
 * @param {string} jsonPath
 * @param {{ legacyJsonPaths?: string[] }} [opts]
 * @returns {Map<string, MatrixRow>}
 */
export function loadPreviousAuditRows(jsonPath, opts = {}) {
  return loadPreviousAuditCatalog(jsonPath, opts).rows;
}

/**
 * @param {AuditCatalogEntry} entry
 * @param {Map<string, { finding: Finding, row: MatrixRow }>} scanned
 * @returns {MatrixRow | undefined}
 */
function pickScannedRow(entry, scanned) {
  /** @type {MatrixRow[]} */
  const rows = (entry.scanIds ?? [])
    .map((sid) => scanned.get(SCAN_FINDING_TO_AUDIT_ID[sid] ?? sid)?.row)
    .filter((r) => Boolean(r));

  if (rows.length === 0) {
    return scanned.get(entry.id)?.row;
  }

  const open = rows.find((r) => r.status === "gap" || r.status === "parziale");

  return open ?? rows[0];
}
/**
 * @param {MatrixRow | undefined} prev
 * @param {MatrixRow | undefined} fresh
 * @param {AuditCatalogEntry} entry
 * @param {ReturnType<typeof loadFindingIssueLinks>} issueLinks
 * @returns {MatrixRow | null}
 */
function mergeCatalogRow(prev, fresh, entry, issueLinks, generatedAt) {
  const link = resolveIssueLink(entry.id, entry.scanIds ?? [], issueLinks);

  if (fresh) {
    /** @type {MatrixRow} */
    const row = {
      ...fresh
    , id: entry.id
    , issueKey     : fresh.issueKey ?? prev?.issueKey ?? link?.key ?? null
    , issueType    : fresh.issueType ?? prev?.issueType ?? link?.issueType ?? null
    , issueSummary : fresh.issueSummary ?? prev?.issueSummary ?? null
    , resolvedNote : fresh.resolvedNote || (prev?.status === "obsoleto" ? "" : prev?.resolvedNote) || ""
    , create       : entry.create ?? fresh.create
    };

    if (row.status === "fatto" && !row.resolvedNote && link?.key) {
      row.resolvedNote = `✅ ${link.key} — condizione repo assente o risolta`;
    }

    return row;
  }

  if (prev) {
    const closed = prev.status === "fatto" || prev.status === "coperto" || prev.status === "obsoleto";

    if (closed && prev.status !== "obsoleto") {
      return {
        ...prev
      , id: entry.id
      , issueKey : prev.issueKey ?? link?.key ?? null
      , issueType: prev.issueType ?? link?.issueType ?? null
      };
    }

    if (isRowOpen(prev.status) || prev.status === "obsoleto") {
      return markRowObsolete(prev, entry.id, link, generatedAt);
    }

    return { ...prev, id: entry.id };
  }

  if (entry.fallback) {
    return {
      id        : entry.id
    , sev       : entry.fallback.sev ?? "info"
    , status    : entry.fallback.status ?? "coperto"
    , project   : entry.fallback.project ?? PA
    , voce      : entry.fallback.voce ?? entry.id
    , dettaglio : entry.fallback.dettaglio ?? ""
    , paths     : entry.fallback.paths ?? []
    , issueKey  : link?.key ?? null
    , issueType : link?.issueType ?? null
    , create    : entry.create
    , resolvedNote: entry.fallback.resolvedNote ?? ""
    };
  }

  return null;
}

/**
 * Reimporta righe storiche assenti dal catalogo/scan corrente — non cancella mai.
 *
 * @param {Map<string, MatrixRow>} prevRows
 * @param {Map<string, MatrixRow>} rowsById
 * @param {Map<string, { finding: Finding, row: MatrixRow }>} scanned
 * @param {ReturnType<typeof loadFindingIssueLinks>} issueLinks
 * @param {string} generatedAt
 */
function absorbHistoricalRows(prevRows, rowsById, scanned, issueLinks, generatedAt) {
  for (const [id, prev] of prevRows) {
    if (id.startsWith("audit-prio-")) {
      continue;
    }

    const freshScan = scanned.get(id)?.row;
    const catalog   = AUDIT_CATALOG.find((e) => e.id === id);
    const link      = resolveIssueLink(id, catalog?.scanIds ?? [], issueLinks);

    if (rowsById.has(id)) {
      const current = rowsById.get(id);

      if (current && freshScan) {
        rowsById.set(id, {
          ...current
        , issueKey    : current.issueKey ?? prev.issueKey ?? link?.key ?? null
        , issueType   : current.issueType ?? prev.issueType ?? link?.issueType ?? null
        , resolvedNote: current.resolvedNote || prev.resolvedNote || ""
        });
      }

      continue;
    }

    if (freshScan) {
      rowsById.set(id, {
        ...freshScan
      , issueKey    : freshScan.issueKey ?? prev.issueKey ?? link?.key ?? null
      , issueType   : freshScan.issueType ?? prev.issueType ?? link?.issueType ?? null
      , resolvedNote: freshScan.resolvedNote || prev.resolvedNote || ""
      });
      continue;
    }

    if (isRowOpen(prev.status) || prev.status === "obsoleto") {
      rowsById.set(id, markRowObsolete(prev, id, link, generatedAt));
      continue;
    }

    rowsById.set(id, { ...prev });
  }
}

/**
 * @param {Map<string, MatrixRow>} rowsById
 * @returns {MatrixRow[]}
 */
function buildPriorityRows(rowsById) {
  /** @type {MatrixRow[]} */
  const rows = [];

  for (const def of PRIORITY_DEFS) {
    const src = rowsById.get(def.sourceId);

    if (!src) {
      continue;
    }

    const open = src.status === "gap" || src.status === "parziale";

    rows.push({
      id        : def.id
    , sev       : src.sev
    , status    : src.status === "obsoleto" ? "obsoleto" : src.status
    , project   : src.project
    , voce      : def.voce
    , dettaglio : src.dettaglio
    , paths     : src.paths
    , issueKey  : src.issueKey ?? null
    , issueType : src.issueType ?? null
    , issueSummary: src.issueSummary ?? null
    , resolvedNote: src.resolvedNote ?? ""
    , create    : open && def.create && !src.issueKey ? def.create : undefined
    });
  }

  return rows;
}

/**
 * @param {string} portalRoot
 * @param {string} [previousJsonPath]
 * @param {{ legacyJsonPaths?: string[], report?: Awaited<ReturnType<typeof analyzePortalAdvancement>> }} [opts]
 * @returns {Promise<{ sections: MatrixSection[], report: Awaited<ReturnType<typeof analyzePortalAdvancement>> }>}
 */
export async function buildRepoAuditSectionsFromReport(portalRoot, previousJsonPath, opts = {}) {
  const report     = opts.report ?? await analyzePortalAdvancement(portalRoot);
  const findings   = report.findings;
  const generatedAt = report.generatedAt;

  supplementRepoAuditFindings(portalRoot, findings);

  const scanned    = indexScannedRows(findings);
  const { rows: prevRows, sectionById: prevSectionById } = previousJsonPath
    ? loadPreviousAuditCatalog(previousJsonPath, { legacyJsonPaths: opts.legacyJsonPaths })
    : { rows: new Map(), sectionById: new Map() };
  const issueLinks = await loadFindingIssueLinks();

  /** @type {Map<string, MatrixRow>} */
  const rowsById = new Map();

  for (const entry of AUDIT_CATALOG) {
    const fresh  = pickScannedRow(entry, scanned);
    const merged = mergeCatalogRow(prevRows.get(entry.id), fresh, entry, issueLinks, generatedAt);

    if (merged) {
      rowsById.set(entry.id, merged);
    }
  }

  for (const [auditId, { row }] of scanned) {
    if (rowsById.has(auditId) || auditId.startsWith("audit-prio-")) {
      continue;
    }

    if (row.category === "feature" || auditId.startsWith("feat-")) {
      continue;
    }

    if (AUDIT_CATALOG.some((e) => e.id === auditId)) {
      continue;
    }

    rowsById.set(auditId, row);
  }

  absorbHistoricalRows(prevRows, rowsById, scanned, issueLinks, generatedAt);

  /** @type {MatrixSection[]} */
  const sections = AUDIT_SECTION_DEFS.map((def) => {
    const rows = def.id === "priority"
      ? buildPriorityRows(rowsById)
      : [...rowsById.values()].filter((r) => {
          if (r.id.startsWith("audit-prio-")) {
            return false;
          }

          const entry = AUDIT_CATALOG.find((e) => e.id === r.id);

          if (entry) {
            return entry.section === def.id;
          }

          const histSec = prevSectionById.get(r.id);

          if (histSec) {
            return histSec === def.id;
          }

          return def.id === sectionGuessFromId(r.id);
        });

    const open     = rows.filter((r) => r.status === "gap" || r.status === "parziale").length;
    const obsolete = rows.filter((r) => r.status === "obsoleto").length;
    const badge    = obsolete > 0
      ? `${open} aperti · ${obsolete} obsolete · ${rows.length} voci`
      : open > 0
        ? `${open} aperti · ${rows.length} voci`
        : `${rows.length} voci`;

    return {
      id    : def.id
    , title : def.title
    , open  : def.open ?? open > 0
    , badge
    , rows
    };
  });

  return { sections, report };
}

/**
 * @param {string} id
 * @returns {string}
 */
function sectionGuessFromId(id) {
  if (id.startsWith("audit-arch-")) {
    return "arch";
  }

  if (id.startsWith("audit-park-")) {
    return "parking";
  }

  if (id.startsWith("audit-red-")) {
    return "redundancy";
  }

  if (id.startsWith("audit-gap-") || id.startsWith("bug-")) {
    return "gap";
  }

  if (id.startsWith("audit-imp-") || id.startsWith("imp-")) {
    return "improv";
  }

  return "improv";
}

/**
 * @param {MatrixSection[]} sections
 * @returns {{ gap: number, partial: number, done: number, total: number, obsolete: number }}
 */
export function summarizeRepoAuditSections(sections) {
  return summarizeMatrixSections(sections);
}
