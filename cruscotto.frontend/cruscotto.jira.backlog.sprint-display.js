/**
 * Badge colonna Sprint — distingue sprint board Jira vs Working Plan (backlog / MyBacklog).
 */
(function initCruscottoSprintDisplay(global) {
  /**
   * Pool backlog Working Plan — non sprint assegnato (vista Fuori piano se senza Jira).
   *
   * @param {string | null | undefined} name
   * @returns {boolean}
   */
  function isWorkingPlanBacklogPoolName(name) {
    return String(name ?? "")
      .toLowerCase()
      .replace(/[—–]/g, "-")
      .replace(/\s+/g, " ")
      .trim() === "backlog corrente";
  }

  /**
   * @param {unknown} row
   * @param {{
   *   backlogIssueByKey: () => Map<string, unknown>,
   *   pickIssueJiraSprintForView: (jiraSprints: unknown) => { name?: string } | null,
   * }} ctx
   * @returns {"jira" | "working-plan" | null}
   */
  function resolveSprintDisplaySource(row, ctx) {
    if (!row || typeof row !== "object") {
      return null;
    }

    /** @type {Record<string, unknown>} */
    const r = /** @type {Record<string, unknown>} */ (row);

    if (r.tier === "subtask" && r.parentKey) {
      return resolveSprintDisplaySource(ctx.backlogIssueByKey().get(String(r.parentKey)), ctx);
    }

    if (r.tier === "sprint") {
      if (isUnplannedSprintHeader(r)) {
        return null;
      }

      if (r.jiraSprintState) {
        return "jira";
      }

      if (isWorkingPlanBacklogPoolName(r.devSprintName)) {
        return null;
      }

      return r.devSprintName ? "working-plan" : null;
    }

    const picked = ctx.pickIssueJiraSprintForView(
      Array.isArray(r.jiraSprints) ? r.jiraSprints : []
    );

    if (picked?.name) {
      return "jira";
    }

    if (isWorkingPlanBacklogPoolName(r.devSprintName)) {
      return null;
    }

    return r.devSprintName ? "working-plan" : null;
  }

  /**
   * @param {Record<string, unknown>} row
   * @returns {boolean}
   */
  function isUnplannedSprintHeader(row) {
    const summary = String(row.summary ?? "");
    const key     = String(row.key ?? "");

    return summary === "— Fuori piano"
      || key.includes("unplanned")
      || isWorkingPlanBacklogPoolName(summary)
      || isWorkingPlanBacklogPoolName(row.devSprintName);
  }

  /**
   * @param {HTMLTableCellElement} td
   * @param {{
   *   label: string | null,
   *   title?: string,
   *   source: "jira" | "working-plan" | null,
   * }} opts
   */
  function fillSprintCell(td, opts) {
    td.replaceChildren();

    const label = opts.label?.trim() ? opts.label.trim() : null;

    if (!label) {
      td.textContent = "—";
      td.classList.add("is-empty");
      td.title = opts.title ?? "";
      return;
    }

    td.classList.remove("is-empty");
    td.title = opts.title ?? label;

    if (opts.source === "working-plan") {
      td.classList.add("is-sprint-from-plan");

      const badge = document.createElement("span");
      badge.className = "sprint-plan-badge";
      badge.textContent = "WP";
      badge.setAttribute("aria-label", "Sprint da Working Plan");
      badge.title = "Sprint da Working Plan — non assegnato su board Jira";

      const labelSpan = document.createElement("span");
      labelSpan.className = "sprint-label-text";
      labelSpan.textContent = label;

      td.append(badge, labelSpan);
      return;
    }

    td.classList.remove("is-sprint-from-plan");

    if (opts.source === "jira") {
      td.classList.add("is-sprint-from-jira");
    } else {
      td.classList.remove("is-sprint-from-jira");
    }

    td.textContent = label;
  }

  global.CruscottoSprintDisplay = {
    resolveSprintDisplaySource
  , fillSprintCell
  , isUnplannedSprintHeader
  , isWorkingPlanBacklogPoolName
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
