/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-18 16:10
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-18 16:10   by: IbyEll
 * modificato il: 2026-06-18 16:10   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *                             Regole visibilità bottone gogo — backlog vista Sprint story-like
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - La logica gogo in cruscotto.jira.backlog.html va testabile senza duplicare regole nel test funzionale.
 *
 *   A cosa serve:
 *   - Espone buildGogoCommand, isStoryLikeType/Row e shouldShowGogoButton allineati alla UI backlog.
 *
 * Generalizzazione:
 *   Si — regole riusabili da test funzionale e verificabili contro payload API backlog generico.
 *
 * Input:
 *   - issueKey — key Jira per comando workflow gogo
 *   - row.type, row.tier, row.isStoryLike — campi riga backlog
 *   - viewMode — epic | sprint | pillar (solo sprint abilita bottone)
 *
 * Consumatori:
 *   - admin.portal.testscript/funzionali/test.cruscotto.backlog.gogo.mjs
 *   - cruscotto.frontend/cruscotto.jira.backlog.html — stessa policy story-like (riferimento)
 *
 * Export principali:
 *   - buildGogoCommand — stringa comando workflow gogo KEY
 *   - isStoryLikeType, isStoryLikeRow — filtro Story/Bug/Todo esclusi epic/subtask
 *   - shouldShowGogoButton — visibilità in vista sprint su task story-like con key
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

/**
 * Costruisce il comando workflow gogo per una issue key Jira.
 *
 * @param {string} issueKey
 * @returns {string}
 */
export function buildGogoCommand(issueKey) {
  return `gogo ${String(issueKey).trim()}`;
}

/**
 * Story, Bug, Todo — allineato a cruscotto.jira.backlog.html / jira-backlog.mjs
 *
 * @param {string} type
 * @returns {boolean}
 */
export function isStoryLikeType(type) {
  const t = String(type ?? "").toLowerCase().trim();

  if (t.includes("epic")) {
    return false;
  }

  if (t.includes("sub-task") || t.includes("subtask")) {
    return false;
  }

  if (t.includes("sub") && !(t.includes("story") || t.includes("bug") || t.includes("todo") || t.includes("to do"))) {
    return false;
  }

  return t.includes("story")
    || t.includes("bug")
    || t.includes("todo")
    || t.includes("to do");
}

/**
 * Determina se una riga backlog è story-like (flag API o tier task + type).
 *
 * @param {{ tier?: string, type?: string, isStoryLike?: boolean }} row
 * @returns {boolean}
 */
export function isStoryLikeRow(row) {
  // 1. Flag esplicito API — prioritario su euristica type
  if (row.isStoryLike != null) {
    return row.isStoryLike;
  }

  // 2. Tier task + isStoryLikeType — allineamento UI backlog
  return row.tier === "task" && isStoryLikeType(row.type ?? "");
}

/**
 * Visibilità bottone gogo: solo vista sprint, tier task, story-like, key presente.
 *
 * @param {"epic" | "sprint" | "pillar" | string} viewMode
 * @param {{ tier?: string, type?: string, isStoryLike?: boolean, key?: string }} row
 * @returns {boolean}
 */
export function shouldShowGogoButton(viewMode, row) {
  return viewMode === "sprint"
    && row.tier === "task"
    && isStoryLikeRow(row)
    && !!row.key;
}
