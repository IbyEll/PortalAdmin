/**
 * ** PAGE SCRIPT ** -- commentato il: 2026-06-17
 *
 * Bootstrap progetto cruscotto — inizializza window.CRUSCOTTO_PROJECT al caricamento pagina.
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - le pagine HTML cruscotto sono statiche; label e binding DOM devono riflettere il PROJECT_* attivo
 *   - centralizza publish config e evento cruscotto:project-ready per script companion
 *
 *   A cosa serve:
 *   - legge config iniettata o fetch API, imposta window.CRUSCOTTO_PROJECT
 *   - interpola [data-cruscotto-bind] e aggiorna document.title per pagina
 *
 * Generalizzazione:
 *   Si — payload da buildCruscottoProjectPayload (overlay PROJECT_* / PRJ_NAME al launch).
 *
 * Input:
 *   - window.__CRUSCOTTO_PROJECT__ — JSON iniettato da runner/cruscotto.server.mjs in <head>
 *   - GET /api/cruscotto/project — fallback se pagina aperta senza iniezione
 *   - [data-cruscotto-bind], [data-cruscotto-template] — placeholder DOM in HTML companion
 *
 * Pagina HTML:
 *   - Tutte le pagine cruscotto servite da runner/cruscotto.server.mjs (home, backlog, working, pillar matrix, …)
 *
 * Servito da:
 *   - runner/cruscotto.server.mjs — iniettato automaticamente prima di </head>
 *
 * API (fetch same-origin):
 *   - GET /api/cruscotto/project — config progetto se manca __CRUSCOTTO_PROJECT__
 */
(function bootstrapCruscottoProject() {
  /** @param {string} template @param {Record<string, string>} vars */
  function interpolate(template, vars) {
    return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? "");
  }

  /** @param {Record<string, unknown>} project */
  function templateVars(project) {
    return {
      repoName     : String(project.repoName ?? "")
    , repoFolder   : String(project.repoFolder ?? "")
    , jiraPrefix   : String(project.jiraPrefix ?? "")
    , slug         : String(project.slug ?? "")
    , dbFilename   : String(project.dbFilename ?? "")
    , overlayName  : String(project.overlayName ?? "")
    };
  }

  /** @param {Record<string, unknown>} project */
  function applyDocumentTitles(project) {
    /** @type {Record<string, string> | undefined} */
    const titles = /** @type {Record<string, string> | undefined} */ (project.titles);

    if (titles?.cruscotto && document.title.includes("Cruscotto")) {
      document.title = titles.cruscotto;
    }

    if (titles?.backlog && /Backlog/i.test(document.title) && !/MyBacklog/i.test(document.title)) {
      document.title = titles.backlog;
    }

    if (titles?.myBacklog && /MyBacklog/i.test(document.title)) {
      document.title = titles.myBacklog;
    }

    if (titles?.working && /Jira Working/i.test(document.title)) {
      document.title = titles.working;
    }

    if (titles?.projectTree && /Project Tree/i.test(document.title)) {
      document.title = titles.projectTree;
    }

    if (titles?.pillarMatrix && /Matrice pilastri/i.test(document.title)) {
      document.title = titles.pillarMatrix;
    }
  }

  /** @param {Record<string, unknown>} project */
  function applyDomBindings(project) {
    const vars = templateVars(project);

    document.querySelectorAll("[data-cruscotto-bind]").forEach((el) => {
      const bindKey  = el.getAttribute("data-cruscotto-bind") ?? "text";
      const template = el.getAttribute("data-cruscotto-template") ?? el.textContent ?? "";

      if (bindKey === "document.title") {
        document.title = interpolate(template, vars);
        return;
      }

      if (bindKey === "text" || bindKey === "html") {
        const value = interpolate(template, vars);

        if (bindKey === "html") {
          el.innerHTML = value;
        } else {
          el.textContent = value;
        }
      }
    });

    applyDocumentTitles(project);
  }

  /** @param {Record<string, unknown>} project */
  function publish(project) {
    window.CRUSCOTTO_PROJECT = project;
    applyDomBindings(project);
    document.dispatchEvent(new CustomEvent("cruscotto:project-ready", { detail: project }));
  }

  const injected = window.__CRUSCOTTO_PROJECT__;

  if (injected && typeof injected === "object") {
    publish(/** @type {Record<string, unknown>} */ (injected));
    return;
  }

  fetch("/api/cruscotto/project")
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
    .then((project) => publish(project))
    .catch((err) => {
      console.warn("cruscotto.project.bootstrap — config non caricata:", err);
    });
})();
