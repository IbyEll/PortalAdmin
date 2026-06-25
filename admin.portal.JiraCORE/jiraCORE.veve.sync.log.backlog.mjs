#!/usr/bin/env node
/**
 * Re-sync description veve (ADF) per backlog LOG — ADMIN-157…167.
 * Uso: node admin.portal.JiraCORE/jiraCORE.veve.sync.log.backlog.mjs [--dry-run]
 */

import { syncVeveDescriptionToJira } from "./jiraCORE.workflow.description.mjs";

await import("../admin.portal.lib/portal.load.env.mjs");

const dryRun = process.argv.includes("--dry-run");

/** @type {Array<{ key: string, kind: "story" | "subtask", ctx: object }>} */
const BACKLOG = [
  {
    key : "ADMIN-158"
  , kind: "story"
  , ctx : {
      objective: "Introdurre un modulo di logging condiviso (`admin.portal.lib/portal.log.mjs`) e un'API di lettura unificata, sostituendo i ring buffer duplicati oggi in cruscotto process e Cursor agent."
    , sprintNote: "Backlog [LOG] — backend prima della UI"
    , analysisDate: "2026-06-23"
    , repoAreas: [
        { area: "Modulo log", esito: "❌", note: "Solo `console.*` sparsi; nessun pino/winston" }
      , { area: "process-console", esito: "⚠️", note: "`pushLogLine` in `cruscotto.process.services.manager.mjs` (~3000 righe)" }
      , { area: "Cursor agent", esito: "⚠️", note: "Buffer duplicato in `portal.cursor.agent.manager.mjs`" }
      , { area: "HOME console", esito: "⚠️", note: "`portal-console-log` merge client-side di tail JSON (8KB)" }
      ]
    , responsibility: "Backend e API — non UI filtri né cattura stdio product (story sorella ADMIN-157)."
    , acceptanceCriteria: [
        { text: "`admin.portal.lib/portal.log.mjs` espone `createLogger(source)`, `log.info/warn/error/debug`, ring buffer configurabile", checked: false }
      , { text: "Schema riga unificato: `{ seq, at, source, stream, level, text }`", checked: false }
      , { text: "`PORTAL_LOG_LEVEL` in `.env.example` filtra livelli server-side", checked: false }
      , { text: "`GET /api/logs?cursor=&source=&level=` su cruscotto (e proxy HOME se serve)", checked: false }
      , { text: "Manager process e agent migrati al modulo condiviso", checked: false }
      ]
    , definitionOfDone: [
        { text: "Subtask ADMIN-159…162 completati e verificati in dev", checked: false }
      , { text: "Endpoint legacy `/api/repo/services/logs` e `/api/cursor/agent/logs` ancora funzionanti (wrapper)", checked: false }
      , { text: "Smoke portal senza regressioni su tab Process e Cursor Agent", checked: false }
      ]
    , subtasks: [
        { key: "ADMIN-159", summary: "[LOG] admin.portal.lib/portal.log.mjs — createLogger, livelli e ring buffer" }
      , { key: "ADMIN-160", summary: "[LOG] Migrazione process.services.manager al modulo log" }
      , { key: "ADMIN-161", summary: "[LOG] API GET /api/logs unificata e tail prepare/dashboard" }
      , { key: "ADMIN-162", summary: "[LOG] Migrazione cursor.agent.manager al modulo log" }
      ]
    , outOfScope: [
        "UI filtri e componenti HOME (story sorella ADMIN-157)"
      , "Cattura stdout stack product detached (subtask ADMIN-165)"
      , "Persistenza file rotante (subtask ADMIN-167)"
      ]
    , successor: "ADMIN-157 — [LOG] UI e visibilità log in PortalAdmin HOME e cruscotto"
    }
  }
, {
    key : "ADMIN-157"
  , kind: "story"
  , ctx : {
      objective: "Rendere i log runtime visibili e filtrabili dall'utente in HOME (:3990) e cruscotto (:3998), riusando lo stesso componente/stile della Process console."
    , sprintNote: "Backlog [LOG] — dopo ADMIN-158 (modulo + API)"
    , analysisDate: "2026-06-23"
    , repoAreas: [
        { area: "Process tab", esito: "✅", note: "Tab, stream colorati, poll 700ms" }
      , { area: "HOME prepare", esito: "⚠️", note: "`<pre>` singolo senza tab/stream" }
      , { area: "Product web/api/auth", esito: "❌", note: "`stdio: ignore` — output non in UI" }
      , { area: "Test run", esito: "❌", note: "Solo progress API, non stdout stream" }
      ]
    , responsibility: "Solo UI e visibilità — modulo backend e API unificata in ADMIN-158."
    , acceptanceCriteria: [
        { text: "HOME `portal-console-log` allineato a process-console (tab/stream o embed)", checked: false }
      , { text: "Filtro livello (debug/info/warn/error) e sorgente in UI", checked: false }
      , { text: "Log prepare/dashboard/home-server inclusi nello schema unificato", checked: false }
      , { text: "Stdout stack product dev visibile in process console (o documentato opt-out)", checked: false }
      , { text: "Stdout testscript streamabile durante run", checked: false }
      ]
    , definitionOfDone: [
        { text: "Subtask ADMIN-163…167 completati", checked: false }
      , { text: "Verifica manuale HOME + cruscotto con overlay AdminDashBoard", checked: false }
      , { text: "Pagina docs.portal/logging-centralizzato.html allineata se API/UI cambiano", checked: false }
      ]
    , subtasks: [
        { key: "ADMIN-163", summary: "[LOG] HOME portal-console allineata a process-console" }
      , { key: "ADMIN-164", summary: "[LOG] UI filtri livello e sorgente log" }
      , { key: "ADMIN-165", summary: "[LOG] Cattura stdout stack product dev in process console" }
      , { key: "ADMIN-166", summary: "[LOG] Stream stdout testscript in UI durante run" }
      , { key: "ADMIN-167", summary: "[LOG] Persistenza opzionale log file rotante (opt-in)" }
      ]
    , outOfScope: [
        "Export log verso Datadog/Sentry"
      , "Modulo backend `admin.portal.lib/portal.log.mjs` (story sorella ADMIN-158)"
      ]
    , successor: "—"
    }
  }
, {
    key : "ADMIN-159"
  , kind: "subtask"
  , ctx : {
      objective: "Creare `admin.portal.lib/portal.log.mjs` con `createLogger(source)`, livelli, ring buffer condiviso e filtro `PORTAL_LOG_LEVEL`."
    , parentKey: "ADMIN-158"
    , repoAreas: [{ area: "Modulo log", esito: "❌", note: "File assente" }]
    , acceptanceCriteria: [
        { text: "`createLogger(source)` espone `info`, `warn`, `error`, `debug`, `write`", checked: false }
      , { text: "Ring buffer condiviso con eviction FIFO configurabile", checked: false }
      , { text: "Schema riga `{ seq, at, source, stream, level, text }`", checked: false }
      , { text: "`PORTAL_LOG_LEVEL` da env documentato in `.env.example`", checked: false }
      ]
    , definitionOfDone: [
        { text: "Export testabile da smoke o unit minimo", checked: false }
      , { text: "Nessuna regressione su import esistenti", checked: false }
      ]
    , files: ["admin.portal.lib/portal.log.mjs", ".env.example"]
    , dependencies: "—"
    , order: { n: 1, total: 4 }
    }
  }
, {
    key : "ADMIN-160"
  , kind: "subtask"
  , ctx : {
      objective: "Sostituire `pushLogLine` locale con `portal.log` in `cruscotto.process.services.manager.mjs`."
    , parentKey: "ADMIN-158"
    , repoAreas: [{ area: "process-console", esito: "⚠️", note: "Buffer locale ~3000 righe" }]
    , acceptanceCriteria: [
        { text: "Tutte le righe process usano `createLogger(\"process\")`", checked: false }
      , { text: "`GET /api/repo/services/logs` resta compatibile (wrapper o stesso payload)", checked: false }
      ]
    , definitionOfDone: [
        { text: "Tab Process cruscotto mostra log come prima", checked: false }
      , { text: "Commit con messaggio `ADMIN-160 …`", checked: false }
      ]
    , files: ["cruscotto.frontend/cruscotto.process.services.manager.mjs"]
    , dependencies: "ADMIN-159"
    , order: { n: 2, total: 4 }
    }
  }
, {
    key : "ADMIN-161"
  , kind: "subtask"
  , ctx : {
      objective: "Esporre `GET /api/logs?cursor=&source=&level=` e ingest tail prepare/dashboard da `admin.portal.lib/portal.instance.mjs`."
    , parentKey: "ADMIN-158"
    , repoAreas: [{ area: "API logs", esito: "❌", note: "Solo endpoint separati process/agent" }]
    , acceptanceCriteria: [
        { text: "Handler su `cruscotto.server.mjs` con filtri query", checked: false }
      , { text: "Sorgenti `prepare` e `dashboard` nel bus unificato", checked: false }
      , { text: "Proxy opzionale su `portal.home.server.mjs`", checked: false }
      ]
    , definitionOfDone: [
        { text: "curl/fetch su `/api/logs` restituisce JSON con cursor", checked: false }
      ]
    , files: ["cruscotto.frontend/cruscotto.server.mjs", "admin.portal.lib/portal.instance.mjs", "admin.portal/portal.home.server.mjs"]
    , dependencies: "ADMIN-159"
    , order: { n: 3, total: 4 }
    }
  }
, {
    key : "ADMIN-162"
  , kind: "subtask"
  , ctx : {
      objective: "Sostituire buffer duplicato in `portal.cursor.agent.manager.mjs` con `portal.log`."
    , parentKey: "ADMIN-158"
    , repoAreas: [{ area: "Cursor agent", esito: "⚠️", note: "Buffer locale duplicato" }]
    , acceptanceCriteria: [
        { text: "Stream `workflow` e `assistant` restano nell'enum `stream`", checked: false }
      , { text: "`GET /api/cursor/agent/logs` compatibile", checked: false }
      ]
    , definitionOfDone: [
        { text: "Tab Cursor Agent invariata per l'utente", checked: false }
      ]
    , files: ["admin.portal/portal.cursor.agent.manager.mjs"]
    , dependencies: "ADMIN-159"
    , order: { n: 4, total: 4 }
    }
  }
, {
    key : "ADMIN-163"
  , kind: "subtask"
  , ctx : {
      objective: "Sostituire `#prepare-log` plain `<pre>` con componente allineato a process-console (tab stream, follow, clear)."
    , parentKey: "ADMIN-157"
    , repoAreas: [{ area: "HOME prepare", esito: "⚠️", note: "Merge testuale client-side" }]
    , acceptanceCriteria: [
        { text: "Poll `GET /api/logs` o tail unificato", checked: false }
      , { text: "Stile coerente con Process tab (colori stream)", checked: false }
      ]
    , definitionOfDone: [
        { text: "Verifica manuale su HOME :3990", checked: false }
      ]
    , files: ["admin.portal/portal.home.js", "admin.portal/portal.home.css", "admin.portal/portal.home.html"]
    , dependencies: "ADMIN-158"
    , order: { n: 1, total: 5 }
    }
  }
, {
    key : "ADMIN-164"
  , kind: "subtask"
  , ctx : {
      objective: "Toolbar filtri livello e sorgente in Process tab e Cursor Agent."
    , parentKey: "ADMIN-157"
    , repoAreas: [{ area: "UI filtri", esito: "❌", note: "Assenti" }]
    , acceptanceCriteria: [
        { text: "Filtro livello: debug / info / warn / error", checked: false }
      , { text: "Filtro sorgente: process / agent / prepare / dashboard / all", checked: false }
      , { text: "Filtro client-side + query param API dove supportato", checked: false }
      ]
    , definitionOfDone: [
        { text: "Filtri persistono durante sessione tab", checked: false }
      ]
    , files: ["cruscotto.frontend/cruscotto.home.js"]
    , dependencies: "ADMIN-163"
    , order: { n: 2, total: 5 }
    }
  }
, {
    key : "ADMIN-165"
  , kind: "subtask"
  , ctx : {
      objective: "Pipe stdout/stderr stack product dev nel ring buffer `portal.log` (oggi `stdio: ignore`)."
    , parentKey: "ADMIN-157"
    , repoAreas: [{ area: "Product web/api/auth", esito: "❌", note: "`stdio: ignore` in avvio stack" }]
    , acceptanceCriteria: [
        { text: "Output visibile in process console", checked: false }
      , { text: "Flag env opt-out se impatto performance", checked: false }
      ]
    , definitionOfDone: [
        { text: "Documentato in docs.portal/logging-centralizzato.html", checked: false }
      ]
    , files: ["cruscotto.frontend/cruscotto.process.services.manager.mjs", "admin.portal.lib/portal.launch.dashboard.mjs"]
    , dependencies: "ADMIN-160"
    , order: { n: 3, total: 5 }
    }
  }
, {
    key : "ADMIN-166"
  , kind: "subtask"
  , ctx : {
      objective: "Bufferizzare stdout testscript durante run ed esporre stream in UI."
    , parentKey: "ADMIN-157"
    , repoAreas: [{ area: "Test run", esito: "❌", note: "Solo progress API" }]
    , acceptanceCriteria: [
        { text: "`GET /api/run/logs?cursor=` o `source=test`", checked: false }
      , { text: "Stream visibile in tab Test o Process durante esecuzione", checked: false }
      ]
    , definitionOfDone: [
        { text: "Run test da cruscotto mostra output live", checked: false }
      ]
    , files: ["cruscotto.frontend/cruscotto.testscript.manager.mjs"]
    , dependencies: "ADMIN-161"
    , order: { n: 4, total: 5 }
    }
  }
, {
    key : "ADMIN-167"
  , kind: "subtask"
  , ctx : {
      objective: "Opt-in: append su file rotante `admin.portal/logs/portal-YYYY-MM-DD.log`."
    , parentKey: "ADMIN-157"
    , repoAreas: [{ area: "Persistenza disco", esito: "❌", note: "Solo ring buffer RAM" }]
    , acceptanceCriteria: [
        { text: "Attivazione via env (es. `PORTAL_LOG_FILE=1`)", checked: false }
      , { text: "Non sostituisce ring buffer per UI live", checked: false }
      ]
    , definitionOfDone: [
        { text: "Documentato in docs.portal", checked: false }
      ]
    , files: ["admin.portal.lib/portal.log.mjs"]
    , dependencies: "ADMIN-159"
    , order: { n: 5, total: 5 }
    }
  }
];

/** @type {Array<{ key: string, ok: boolean, dryRun?: boolean }>} */
const results = [];

for (const item of BACKLOG) {
  const out = await syncVeveDescriptionToJira(item.key, item.ctx, item.kind, { dryRun });
  results.push({ key: item.key, ok: true, dryRun: out.description.dryRun === true });
}

console.log(JSON.stringify({ ok: true, dryRun, updated: results }, null, 2));
