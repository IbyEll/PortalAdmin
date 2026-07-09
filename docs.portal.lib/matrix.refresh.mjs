/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-26 08:40
 * ------------------------------------------------------------------------------------------------------------------------
 * creato il: 2026-06-26 08:40 by: IbyEll
 * modificato il: 2026-06-26 08:40 by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *         Merge incrementale pagine matrice docs — righe risolte, delta e stelline ★
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - RIGENERA e generatori matrice devono aggiornare tbody senza riscrivere l'HTML intero né
 *     perdere righe già marcate fatto o link Jira persistiti.
 *
 *   A cosa serve:
 *   - refreshMatrixPageHtml unisce tbody per sezione FINDINGS, aggiorna badge e metriche;
 *     stripAnalysisChecksBlocks rimuove card controlli automatici legacy.
 *
 * Generalizzazione:
 *   Si — sections MatrixSection[] e callback isFresh da docs.portal.refresh.mjs riusabili.
 *
 * Input (obbligatorio se Si; se No scrivere «Input: —»):
 *   - html — pagina matrice esistente
 *   - sections — sezioni live dal generator
 *   - prev — Map stati precedenti da parsePreviousAutoStates
 *   - verifiedAtIso — timestamp verifica per note risoluzione
 *   - isFresh — funzione confronto firma riga
 *
 * Consumatori:
 *   - docs.portal/matrix.portal.gap.analysis.mjs — refreshMatrixPageHtml dopo analisi
 *   - docs.portal/matrix.test.coverage.mjs — merge coverage matrix
 *   - docs.portal/matrix.repo.audit.ridondanze.gap.mjs — merge audit matrice
 *
 * Export principali:
 *   - refreshMatrixPageHtml — merge tbody e meta generazione
 *   - stripAnalysisChecksBlocks — pulizia sezioni checks automatici
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { loadFindingIssueLinks } from "./matrix.finding-issues.store.mjs";
import { normalizeJiraIssueKey } from "./matrix.finding.issues.mjs";
import { renderMatrixRow, renderMatrixSection, escHtml } from "./matrix.render.mjs";

/** @typedef {import("./matrix.render.mjs").MatrixRow} MatrixRow */
/** @typedef {import("./matrix.render.mjs").MatrixSection} MatrixSection */

/**
 * @param {string} status
 * @returns {boolean}
 */
function isMatrixRowClosed(status) {
  return status === "fatto" || status === "coperto" || status === "done";
}

/**
 * @param {string} status
 * @returns {boolean}
 */
function isMatrixRowActive(status) {
  return status === "open" || status === "gap" || status === "parziale" || status === "partial" || status === "blocked";
}

/**
 * @param {string} html
 * @returns {string}
 */
function stripTags(html) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * @param {string} tr
 * @returns {{ id: string, status: string, sig: string, voce: string, dettaglio: string, issueKey: string | null } | null}
 */
function parseMatrixRow(tr) {
  const id = tr.match(/data-finding-id="([^"]+)"/)?.[1];

  if (!id) {
    return null;
  }

  const status   = tr.match(/data-finding-status="([^"]+)"/)?.[1] ?? "";
  const sig      = tr.match(/data-finding-sig="([^"]+)"/)?.[1] ?? "";
  const tds      = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1]);
  const voce     = stripTags(tds[3] ?? "");
  const dettaglio = stripTags(tds[4] ?? "");
  const issueKey = normalizeJiraIssueKey(
    tr.match(/data-issue-key="([^"]+)"/)?.[1]
    ?? tr.match(/class="issue-ref"[^>]*>([A-Z]+-\d+)/)?.[1]
    ?? null
  );

  return { id, status, sig, voce, dettaglio, issueKey };
}

/**
 * @param {MatrixSection} section
 * @returns {Map<string, MatrixRow>}
 */
function liveActiveById(section) {
  /** @type {Map<string, MatrixRow>} */
  const map = new Map();

  for (const r of section.rows) {
    if (isMatrixRowActive(r.status === "gap" ? "open" : r.status) || r.status === "gap" || r.status === "parziale" || r.status === "blocked") {
      map.set(r.id, r);
    }
  }

  return map;
}

/**
 * @param {MatrixRow[]} rows
 * @returns {Map<string, MatrixRow>}
 */
function rowsByVoce(rows) {
  return new Map(rows.map((r) => [r.voce, r]));
}

/**
 * @param {{ voce: string, dettaglio: string, issueKey: string | null }} parsed
 * @param {string} legacyId
 * @param {string} note
 * @param {boolean} fresh
 * @param {MatrixRow | null} archived
 * @returns {string}
 */
function renderLegacyFattoMatrixRow(parsed, legacyId, note, fresh, archived = null) {
  const persisted = loadFindingIssueLinks().get(legacyId);
  const issueKey  = normalizeJiraIssueKey(archived?.issueKey)
    ?? normalizeJiraIssueKey(parsed.issueKey)
    ?? normalizeJiraIssueKey(persisted?.key)
    ?? null;

  return renderMatrixRow({
    id           : legacyId
  , sev          : archived?.sev ?? "P2"
  , status       : "fatto"
  , project      : archived?.project ?? "PortalAdmin"
  , voce         : parsed.voce
  , dettaglio    : parsed.dettaglio
  , paths        : archived?.paths ?? []
  , issueKey
  , issueType    : archived?.issueType ?? persisted?.issueType ?? null
  , issueSummary : archived?.issueSummary ?? null
  , category     : archived?.category ?? null
  , resolvedNote : note
  }, { fresh });
}

/**
 * @param {string} tbodyHtml
 * @param {MatrixSection} section
 * @param {string} verifiedAt
 * @param {Map<string, string>} prev
 * @param {(key: string, sig: string, prev: Map<string, string>) => boolean} isFresh
 * @returns {string}
 */
function mergeMatrixSectionTbody(tbodyHtml, section, verifiedAt, prev, isFresh) {
  const rows        = [...tbodyHtml.matchAll(/<tr[\s\S]*?<\/tr>/g)].map((m) => m[0]);
  const liveById    = liveActiveById(section);
  const liveByVoce  = rowsByVoce(section.rows);
  const allByVoce   = rowsByVoce(section.rows);
  /** @type {Set<string>} */
  const seenIds     = new Set();
  /** @type {string[]} */
  const out         = [];

  for (const tr of rows) {
    const parsed = parseMatrixRow(tr);

    if (!parsed) {
      out.push(tr);
      continue;
    }

    if (isMatrixRowClosed(parsed.status)) {
      seenIds.add(parsed.id);
      out.push(tr);
      continue;
    }

    if (!isMatrixRowActive(parsed.status)) {
      out.push(tr);
      continue;
    }

    const live = liveById.get(parsed.id) ?? liveByVoce.get(parsed.voce);

    if (live) {
      seenIds.add(live.id);
      const findingStatus = live.status === "gap" ? "open" : live.status;
      const sig           = `${findingStatus}|${live.dettaglio}`;
      const fresh         = isFresh(`finding:${live.id}`, sig, prev);

      out.push(renderMatrixRow(live, { fresh }));
      continue;
    }

    const archived  = allByVoce.get(parsed.voce) ?? null;
    const resolvedId = parsed.id || archived?.id || `legacy-${parsed.voce.slice(0, 40).replace(/\W+/g, "-")}`;
    const note      = `✅ ${verifiedAt} — non più rilevato dall'analisi repo`;
    const fresh     = isFresh(`finding:${resolvedId}`, `fatto|${note}`, prev);

    seenIds.add(resolvedId);
    out.push(renderLegacyFattoMatrixRow(parsed, resolvedId, note, fresh, archived));
  }

  for (const r of liveById.values()) {
    if (!seenIds.has(r.id)) {
      out.push(renderMatrixRow(r, { fresh: true }));
    }
  }

  return out.join("");
}

/**
 * @param {string} html
 * @param {string} sectionId
 * @param {string} badge
 * @returns {string}
 */
function syncMatrixCardBadge(html, sectionId, badge) {
  const re = new RegExp(
    `(data-adv-section="${sectionId}"[\\s\\S]*?<span class="adv-card__badge">)([^<]*)(</span>)`
  );

  return html.replace(re, `$1${escHtml(badge)}$3`);
}

/**
 * @param {string} html
 * @param {{ label: string, value: string | number, meta?: string }[]} metrics
 * @param {string} [badge]
 * @returns {string}
 */
function updateMatrixMetrics(html, metrics, badge = "") {
  let out = html;

  for (const m of metrics) {
    const metaEsc = escHtml(m.meta ?? m.label).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const valEsc  = escHtml(String(m.value)).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    out = out.replace(
      new RegExp(`(<div class="metric"><strong>)[^<]+(</strong><span class="meta">${metaEsc}</span></div>)`)
    , `$1${valEsc}$2`
    );
  }

  if (badge) {
    out = out.replace(
      /(data-adv-section="metrics"[\s\S]*?<span class="adv-card__badge">)([^<]*)(<\/span>)/
    , `$1${escHtml(badge)}$3`
    );
  }

  return out;
}

/**
 * Rimuove card/sezioni controlli docs.portal.analysis da pagine matrice o avanzamento.
 *
 * @param {string} html
 * @returns {string}
 */
export function stripAnalysisChecksBlocks(html) {
  let out = html;

  out = out.replace(
    /<details class="adv-card"[^>]*data-adv-section="checks(?:-fail)?"[\s\S]*?<\/details>\s*/g
  , ""
  );
  out = out.replace(
    /<div class="metric"><strong>[^<]*<\/strong><span class="meta">Controlli automatici<\/span><\/div>\s*/g
  , ""
  );

  return out;
}

/**
 * @param {string} html
 * @param {string} iso
 * @returns {string}
 */
function updateGeneratedMeta(html, iso) {
  const date = iso.slice(0, 19).replace("T", " ");

  return html.replace(
    /(Gap analysis repo · )\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/
  , `$1${date}`
  ).replace(
    /(Generato: )\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?/
  , `$1${date.slice(0, 16)}`
  ).replace(
    /(Feature → test → gap · )\d{4}-\d{2}-\d{2}/
  , `$1${iso.slice(0, 10)}`
  );
}

/**
 * @param {string} html
 * @param {MatrixSection[]} sections
 * @param {Map<string, string>} prev
 * @param {string} verifiedAtIso
 * @param {(key: string, sig: string, prev: Map<string, string>) => boolean} isFresh
 * @param {{ metrics?: { label: string, value: string | number, meta?: string }[], metricsBadge?: string }} [opts]
 * @returns {string}
 */
export function refreshMatrixPageHtml(html, sections, prev, verifiedAtIso, isFresh, opts = {}) {
  const verifiedAt = verifiedAtIso.slice(0, 16).replace("T", " ");
  let out          = stripAnalysisChecksBlocks(html);

  for (const section of sections) {
    const blockRe = new RegExp(
      `(<!-- FINDINGS:${section.id} -->\\s*<table>[\\s\\S]*?<tbody>)([\\s\\S]*?)(</tbody>[\\s\\S]*?</table>\\s*<!-- /FINDINGS:${section.id} -->)`
    );

    if (blockRe.test(out)) {
      out = out.replace(blockRe, (full, head, tbody, tail) => {
        const merged = mergeMatrixSectionTbody(tbody, section, verifiedAt, prev, isFresh);

        if (merged === tbody) {
          return full;
        }

        return `${head}${merged}${tail}`;
      });

      if (section.badge) {
        out = syncMatrixCardBadge(out, section.id, section.badge);
      }

      continue;
    }

    if (!out.includes(`data-adv-section="${section.id}"`)) {
      const sectionHtml = renderMatrixSection(section);
      const anchor      = out.includes('<p class="meta">Artefatti:')
        ? '<p class="meta">Artefatti:'
        : "</div>\n  <script";

      out = out.replace(anchor, `${sectionHtml}\n    ${anchor}`);
    }
  }

  if (opts.metrics?.length) {
    out = updateMatrixMetrics(out, opts.metrics, opts.metricsBadge);
  }

  return updateGeneratedMeta(out, verifiedAtIso);
}
