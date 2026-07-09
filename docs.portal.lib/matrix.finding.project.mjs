/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-26 08:40
 * ------------------------------------------------------------------------------------------------------------------------
 * creato il: 2026-06-26 08:40 by: IbyEll
 * modificato il: 2026-06-26 08:40 by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *         Progetto overlay per finding Avanzamento — etichetta tabella e chiave Jira
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - I finding possono riferire path PROJECT_JustLastOne o host cruscotto; la colonna Project
 *     e il progetto Jira alla creazione issue devono essere coerenti.
 *
 *   A cosa serve:
 *   - Risolve etichetta Project da path, issueKey o override FINDING_PROJECT_KEYS; renderizza
 *     cella HTML e traduce label → ADMIN o JLO per jiraCORE.
 *
 * Generalizzazione:
 *   Si — mapping overlay PROJECT_AdminDashBoard e JustLastOne estendibile via costanti modulo.
 *
 * Input (obbligatorio se Si; se No scrivere «Input: —»):
 *   - finding — id, paths, issueKey, project opzionale per resolveFindingProject
 *   - projectLabel — etichetta tabella per projectLabelToJiraProjectKey
 *   - rel — path repo per projectLabelFromPath
 *
 * Consumatori:
 *   - docs.portal.lib/docs.portal.advancement.mjs — renderFindingProjectCell
 *   - docs.portal/matrix.avanzamento.gap.feature.mjs — enrichFindingsWithProject
 *   - docs.portal.lib/docs.portal.advancement.create.mjs — projectLabelToJiraProjectKey
 *
 * Export principali:
 *   - resolveFindingProject, enrichFindingsWithProject — assegnazione progetto
 *   - projectLabelToJiraProjectKey — chiave Jira da etichetta
 *   - renderFindingProjectCell — HTML colonna Project
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

/** Etichetta tabella per finding host/cruscotto (repo Jira = ADMIN). */
export const PORTALADMIN_CRUSCOTTO_LABEL = "PortalAdmin.Cruscotto";

/** @type {Record<string, string>} */
const JIRA_PREFIX_PROJECT = {
  ADMIN: "PortalAdmin"
, JLO  : "JustLastOne"
};

/**
 * Cartella PROJECT_* → etichetta tabella.
 *
 * @type {Record<string, string>}
 */
const OVERLAY_FOLDER_LABEL = {
  AdminDashBoard: "PortalAdmin"
, JustLastOne   : "JustLastOne"
, PROJECT_Base  : "PortalAdmin"
};

/** Override espliciti finding → etichetta Project (repo workflow resta PortalAdmin). */
export const FINDING_PROJECT_KEYS = {
  "gap-parking-live"    : PORTALADMIN_CRUSCOTTO_LABEL
, "imp-ci-admin-overlay": PORTALADMIN_CRUSCOTTO_LABEL
};

/** Etichetta Project → chiave progetto Jira. */
const PROJECT_LABEL_TO_JIRA_KEY = {
  PortalAdmin              : "ADMIN"
, [PORTALADMIN_CRUSCOTTO_LABEL]: "ADMIN"
, JustLastOne              : "JLO"
};

/**
 * @param {string | null | undefined} projectLabel
 * @returns {boolean}
 */
export function isPortalAdminCruscottoLabel(projectLabel) {
  return String(projectLabel ?? "").trim() === PORTALADMIN_CRUSCOTTO_LABEL;
}

/**
 * @param {string} projectLabel
 * @returns {string}
 */
export function projectLabelToJiraProjectKey(projectLabel) {
  const first = String(projectLabel ?? "").split("·")[0].trim();
  const key   = PROJECT_LABEL_TO_JIRA_KEY[first];

  if (!key) {
    throw new Error(`Progetto Jira non mappato per etichetta: ${projectLabel}`);
  }

  return key;
}

/**
 * @param {string} rel
 * @returns {string | null}
 */
export function projectLabelFromPath(rel) {
  const norm = String(rel).replace(/\\/g, "/");
  const overlay = norm.match(/^PROJECT_([^/]+)\//);

  if (overlay) {
    return OVERLAY_FOLDER_LABEL[overlay[1]] ?? overlay[1];
  }

  if (/justlastone/i.test(norm)) {
    return "JustLastOne";
  }

  if (/admindashboard/i.test(norm)) {
    return "PortalAdmin";
  }

  return null;
}

/**
 * @param {string | null | undefined} issueKey
 * @returns {string | null}
 */
export function projectLabelFromIssueKey(issueKey) {
  const m = String(issueKey ?? "").match(/^(ADMIN|JLO)-\d+/i);

  if (!m || m[1].toUpperCase() === "JLO") {
    return null;
  }

  return JIRA_PREFIX_PROJECT[m[1].toUpperCase()] ?? null;
}

/**
 * @param {{ id: string, paths: string[], issueKey?: string | null, project?: string | null }} finding
 * @returns {string}
 */
export function resolveFindingProject(finding) {
  if (finding.project) {
    return finding.project;
  }

  if (FINDING_PROJECT_KEYS[finding.id]) {
    return FINDING_PROJECT_KEYS[finding.id];
  }

  /** @type {Set<string>} */
  const fromPaths = new Set();

  for (const rel of finding.paths) {
    const label = projectLabelFromPath(rel);

    if (label) {
      fromPaths.add(label);
    }
  }

  if (fromPaths.size === 1) {
    return [...fromPaths][0];
  }

  if (fromPaths.size > 1) {
    return [...fromPaths].sort().join(" · ");
  }

  const fromIssue = projectLabelFromIssueKey(finding.issueKey);

  if (fromIssue) {
    return fromIssue;
  }

  return "PortalAdmin";
}

/**
 * @param {Array<{ id: string, paths: string[], issueKey?: string | null, project?: string | null }>} findings
 * @returns {void}
 */
export function enrichFindingsWithProject(findings) {
  for (const finding of findings) {
    finding.project = resolveFindingProject(finding);
  }
}

/**
 * @param {string | null | undefined} project
 * @param {(inner: string) => string} wrap
 * @returns {string}
 */
export function renderFindingProjectCell(project, wrap) {
  const label = project?.trim() || "PortalAdmin";
  const slug  = label.includes("·")
    ? "multi"
    : label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "portaladmin";

  return `<td class="finding-project">${wrap(`<span class="finding-project-tag finding-project-${slug}" title="Progetto / overlay">${label}</span>`)}</td>`;
}
