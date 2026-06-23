/**
 * ** PAGE SCRIPT ** -- commentato il: 2026-06-17
 *
 * Validazione insight toolbar — mirror browser di cruscotto.jira.backlog.insights.mjs.
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - le pagine Jira HTML mostrano appunti insight generati dal server; servono flag stale lato client
 *   - evita round-trip API per ogni hover/refresh quando lo snapshot è già in pagina
 *
 *   A cosa serve:
 *   - espone window.JloInsightValidate (isInsightStillValid, applyStaleFlags, filterNewInsights)
 *   - confronta testo insight con snapshot (issues, repo, report, sprint, housekeeping)
 *
 * Generalizzazione:
 *   Si — logica snapshot-agnostica; chiavi issue e testi pattern da dati server, non hardcoded su un ticket.
 *
 * Input:
 *   - snapshot — oggetto buildInsightSnapshot passato dai consumer HTML (issues, repo, report, sprints, …)
 *   - insight.text, insight.key — testo e key dell'appunto da validare
 *
 * Pagina HTML:
 *   - cruscotto.jira.backlog.html, cruscotto.jira.working.html, cruscotto.jira.project.tree.html, working.old
 *
 * Servito da:
 *   - runner/cruscotto.server.mjs — URL /insight-validate.js (INSIGHT_STATIC_FILES → cruscotto.frontend/jira/)
 *
 * Asset correlati:
 *   - cruscotto.jira.backlog.insights.mjs — sorgente canonica isInsightStillValid lato Node
 *   - jira/jira.toolbar.insight.css — stili toolbar insight
 */
(function insightValidateModule(global) {
  /**
   * @param {string[]} a
   * @param {string[]} b
   */
  function sameKeyList(a, b) {
    if (a.length !== b.length) {
      return false;
    }

    return [...a].sort().join(",") === [...b].sort().join(",");
  }

  /**
   * @param {{ text: string, key?: string }} insight
   * @param {Record<string, unknown>} snapshot
   * @returns {boolean}
   */
  function isInsightStillValid(insight, snapshot) {
    if (!snapshot) {
      return true;
    }

    const { text, key } = insight;
    const issues = /** @type {Record<string, { done: boolean }>} */ (snapshot.issues ?? {});
    const repo = /** @type {Record<string, { complete: boolean, found: number, total: number }>} */ (snapshot.repo ?? {});
    const report = /** @type {{ generatedAt?: string | null, passed: number, failed: number, scripts: Record<string, { ok: boolean, failed: number }> }} */ (snapshot.report ?? { passed: 0, failed: 0, scripts: {} });
    const sprints = /** @type {Record<string, { done: number, total: number, openKeys: string[] }>} */ (snapshot.sprints ?? {});
    const housekeeping = /** @type {{ open: string[] }} */ (snapshot.housekeeping ?? { open: [] });

    if (text.includes("Ultimo test report")) {
      const match = text.match(/(\d+) pass · (\d+) fail/);

      if (!match || !report.generatedAt) {
        return false;
      }

      return Number(match[1]) === report.passed && Number(match[2]) === report.failed;
    }

    if (text.includes("Nessun report test")) {
      return !report.generatedAt;
    }

    if (text.startsWith("Piano sprint") || text.startsWith("Scansione repo")) {
      const backlogMatch = text.match(/(\d+) issue backlog/)
        ?? text.match(/(\d+) issue nel backlog Jira/);
      const legacyMatch = text.match(/(\d+) issue Jira/)
        ?? text.match(/backlog (\d+) issue/);

      if (backlogMatch) {
        return Number(backlogMatch[1]) === snapshot.issueCount;
      }

      return legacyMatch ? Number(legacyMatch[1]) === snapshot.issueCount : false;
    }

    if (
      (text.includes("citata nel repo") || text.includes("compare nel repo"))
      && (text.includes("assente dal backlog") || text.includes("non è nel backlog"))
    ) {
      const match = text.match(/^(JLO-\d+)/);

      if (!match) {
        return true;
      }

      return !issues[match[1]];
    }

    for (const [name, sprint] of Object.entries(sprints)) {
      if (!text.startsWith(`${name}:`)) {
        continue;
      }

      const countMatch = text.match(/(\d+)\/(\d+) Fatto/);

      if (!countMatch) {
        return true;
      }

      const openMatch = text.match(/ancora aperti (.+)$/)
        ?? text.match(/aperti (.+)$/);
      const openInText = openMatch ? openMatch[1].split(/,\s*/).filter(Boolean) : [];

      return Number(countMatch[1]) === sprint.done
        && Number(countMatch[2]) === sprint.total
        && sameKeyList(openInText, sprint.openKeys);
    }

    if (text.includes("Housekeeping Fase 0 completato")) {
      return housekeeping.open.length === 0;
    }

    if (text.includes("Housekeeping parziale")) {
      const match = text.match(/restano(?: da chiudere)?: (.+)$/);

      return match ? sameKeyList(match[1].split(/,\s*/), housekeeping.open) : false;
    }

    if (text.includes("Fase 0 housekeeping:")) {
      const match = text.match(/: ([A-Z]+-\d+(?:,\s*[A-Z]+-\d+)*) hanno/);

      if (!match) {
        return true;
      }

      return match[1].split(/,\s*/).every((itemKey) => {
        const iss = issues[itemKey];
        const rep = repo[itemKey];

        return iss && !iss.done && rep?.complete;
      });
    }

    if (
      (text.includes("repo pronto per") && text.includes("Jira ancora aperto"))
      || text.includes("in repo c'è già codice per")
    ) {
      const match = text.match(/repo pronto per (.+?) —/)
        ?? text.match(/codice per (.+?), ma/);

      if (!match) {
        return true;
      }

      return match[1].split(/,\s*/).some((itemKey) => {
        const iss = issues[itemKey];
        const rep = repo[itemKey];

        return iss && !iss.done && rep?.complete;
      });
    }

    if (
      text.includes("ultimo ticket aperto nel piano sprint")
      || (text.includes("manca solo") && text.includes("per chiudere lo sprint nel piano"))
    ) {
      const match = text.match(/manca solo (JLO-\d+)/)
        ?? text.match(/\(([A-Z]+-\d+)\)/);
      const itemKey = match?.[1];

      return itemKey ? !issues[itemKey]?.done : true;
    }

    if ((text.includes("Prossimo nel piano:") || text.includes("Prossimo ticket nel piano:")) && key) {
      return snapshot.firstOpenKey === key;
    }

    if (text.includes("Export Excel") && text.includes("export/")) {
      return Boolean(snapshot.exportPending);
    }

    if (text.includes("test blocked") || text.includes("test restano blocked")) {
      return key ? !issues[key]?.done : true;
    }

    const epicCorrelatedOpen = /** @type {Record<string, string[]>} */ (snapshot.epicCorrelatedOpen ?? {});

    if (key && epicCorrelatedOpen[key]) {
      const correlated = epicCorrelatedOpen[key];
      const isEpicClosureInsight = text.includes("valuta chiusura epic")
        || text.includes("tutte le task correlate sono Fatto");

      if (!isEpicClosureInsight) {
        return false;
      }

      if (text.includes("attendi task correlate") || text.includes("task correlate ancora aperte")) {
        const match = text.match(/\(([^)]+)\)\s*$/);

        return match ? sameKeyList(match[1].split(/,\s*/), correlated) : correlated.length > 0;
      }

      if (text.includes("valuta chiusura epic") || text.includes("task correlate Fatto")) {
        return correlated.length === 0 && !issues[key]?.done;
      }
    }

    if (key && text.includes("tutte le task correlate sono Fatto")) {
      const correlated = epicCorrelatedOpen[key] ?? [];

      return correlated.length === 0 && !issues[key]?.done;
    }

    if (key && issues[key]) {
      const iss = issues[key];
      const rep = repo[key];

      if (text.includes("repo e Jira allineati")) {
        return iss.done && Boolean(rep?.complete ?? rep?.hasRefs);
      }

      if (
        text.includes("citata nel repo")
        || text.includes("citaz. nel codice")
        || text.includes("citazioni JLO nel codice")
        || text.includes("implementazione in repo")
        || text.includes("il lavoro sembra fatto in repo")
        || text.includes("repo ok")
        || text.includes("codice presente in repo")
      ) {
        const correlated = epicCorrelatedOpen[key];

        if (correlated?.length) {
          return text.includes("attendi task correlate")
            && sameKeyList(
              text.match(/\(([^)]+)\)\s*$/)?.[1]?.split(/,\s*/) ?? [],
              correlated,
            );
        }

        return !iss.done && Boolean(rep?.complete ?? rep?.hasRefs)
          && Boolean(iss.inActiveSprint);
      }

      if (text.includes("da implementare") && text.includes("sprint attivo")) {
        return Boolean(iss.inActiveSprint)
          && !iss.done
          && !Boolean(rep?.complete ?? rep?.hasRefs);
      }

      if (
        text.includes("valuta chiusura o aggiornamento ticket")
        || text.includes("valuta chiusura o aggiornamento")
      ) {
        return Boolean(iss.inActiveSprint)
          && !iss.done
          && Boolean(rep?.complete ?? rep?.hasRefs);
      }

      if (text.includes("Jira Fatto ma nessuna citazione")) {
        return iss.done && !Boolean(rep?.hasRefs ?? rep?.complete);
      }

      if (text.includes("mancano path attesi") || text.includes("mancano in repo")) {
        return iss.done && !Boolean(rep?.pathComplete ?? rep?.complete);
      }

      if (text.includes("repo parziale") || (text.includes("da implementare") && !text.includes("sprint attivo"))) {
        const partial = text.match(/(\d+)\/(\d+) path/);

        if (partial && rep) {
          return !iss.done
            && Number(partial[1]) === rep.found
            && Number(partial[2]) === rep.total
            && !rep.complete;
        }
      }

      const testFail = text.match(/Test ([\w./-]+): (\d+) falliti/)
        ?? text.match(/il test ([\w./-]+) ha (\d+) asserzioni fallite/);

      if (testFail) {
        const script = report.scripts[testFail[1]];

        return script ? !script.ok && script.failed === Number(testFail[2]) : false;
      }

      const testMissing = text.match(/Test ([\w./-]+) non presente/)
        ?? text.match(/il test ([\w./-]+) non risulta/);

      if (testMissing) {
        return !report.scripts[testMissing[1]];
      }
    }

    if (text.includes("Catena MVP")) {
      return true;
    }

    if (key && text.includes("tutte le") && text.includes("issue figlie sono Fatto")) {
      const pending = /** @type {string[]} */ (snapshot.parentsPendingClose ?? []);

      return pending.includes(key);
    }

    if (text.includes("Analisi fallita")) {
      return false;
    }

    return true;
  }

  /**
   * @param {Record<string, unknown>} item
   */
  function insightIdentity(item) {
    const key  = item?.key != null ? String(item.key) : "";
    const kind = item?.kind != null ? String(item.kind) : "";
    const text = item?.text != null ? String(item.text).trim() : "";

    return `${key}|${kind}|${text}`;
  }

  /**
   * Restituisce solo gli insight del batch non già presenti nel log (stesso key/kind/text).
   *
   * @param {Array<Record<string, unknown>>} existing
   * @param {Array<Record<string, unknown>>} batch
   */
  function filterNewInsights(existing, batch) {
    const seen = new Set(
      (Array.isArray(existing) ? existing : []).map((item) => insightIdentity(item))
    );
    const added = [];

    for (const item of Array.isArray(batch) ? batch : []) {
      const id = insightIdentity(item);

      if (seen.has(id)) {
        continue;
      }

      seen.add(id);
      added.push({ ...item, stale: false });
    }

    return added;
  }

  /**
   * @param {Array<Record<string, unknown>>} items
   * @param {Record<string, unknown>} snapshot
   */
  function applyStaleFlags(items, snapshot) {
    for (const item of items) {
      item.stale = !isInsightStillValid(item, snapshot);
    }

    return items;
  }

  global.JloInsightValidate = {
    isInsightStillValid,
    applyStaleFlags,
    filterNewInsights,
    insightIdentity,
  };
})(typeof window !== "undefined" ? window : globalThis);
