/**
 * Ambito analisi docs — dedotto dal titolo HTML della pagina.
 */

/**
 * @param {string} html
 * @returns {string}
 */
export function extractPageTitle(html) {
  return html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() ?? "";
}

/**
 * @param {string} title
 * @returns {{ title: string, focusLabel: string, topics: string[] }}
 */
export function inferPageScope(title) {
  const t = title.toLowerCase();
  /** @type {string[]} */
  const topics = [];

  if (/audit|ridondanze|gap|miglioramenti/.test(t)) {
    topics.push("audit", "architecture", "quality");
  }

  if (/config|runner|overlay|ordine/.test(t)) {
    topics.push("config", "overlay", "paths");
  }

  if (/workflow|jlo/.test(t)) {
    topics.push("jira", "workflow");
  }

  if (/implementazione|nuovo progetto|product|project|repo/.test(t)) {
    topics.push("project", "overlay", "onboarding");
  }

  if (/sviluppo|visione|portaladmin/.test(t)) {
    topics.push("architecture", "portal");
  }

  if (/cruscotto|architettura|db/.test(t)) {
    topics.push("database", "health", "portal");
  }

  if (topics.length === 0) {
    topics.push("general");
  }

  const uniqueTopics = [...new Set(topics)];

  const focusLabel = title.includes("—")
    ? title.split("—").slice(1).join("—").trim()
    : title;

  return { title, focusLabel, topics: uniqueTopics };
}

/**
 * Righe sintesi architettura — generate da controlli, non da frasi nel corpo doc.
 *
 * @type {{ id: string, area: string, checkIds: string[], topics: string[] }[]}
 */
export const ARCHITECTURE_STATUS_ROWS = [
  {
    id       : "arch-home"
  , area     : "HOME portal"
  , checkIds : ["documentiTab"]
  , topics   : ["portal", "architecture"]
  }
, {
    id       : "arch-health"
  , area     : "Health / dev API"
  , checkIds : ["healthInFrontend", "serverFolderOrphan"]
  , topics   : ["health", "architecture", "audit"]
  }
, {
    id       : "arch-stack"
  , area     : "Stack prepare"
  , checkIds : ["startDevCanonical"]
  , topics   : ["config", "paths"]
  }
, {
    id       : "arch-test"
  , area     : "Test run-all / smoke"
  , checkIds : ["testRunAllPresent", "packageJsonSmokePaths", "smokeCiSteps"]
  , topics   : ["quality", "audit"]
  }
, {
    id       : "arch-overlay"
  , area     : "Overlay config"
  , checkIds : ["overlayInLibOverlay", "projectBaseFallback", "portalPathsMigrated"]
  , topics   : ["overlay", "config", "project"]
  }
, {
    id       : "arch-jira"
  , area     : "Jira tooling"
  , checkIds : ["jiraFrontendDupRemoved", "parkingJiraCopy", "jiraWorkingParked"]
  , topics   : ["jira", "workflow", "audit"]
  }
];

/**
 * @param {string[]} pageTopics
 * @param {string[]} rowTopics
 * @returns {boolean}
 */
export function rowMatchesPageTopics(pageTopics, rowTopics) {
  if (pageTopics.includes("general") || pageTopics.includes("audit")) {
    return true;
  }

  return rowTopics.some((t) => pageTopics.includes(t));
}
