/**
 * Meta test funzionali JustLastOne — implementation e scenari statici su lib/test.functional.meta.mjs.
 */

import {
  buildFunzionaliMetaPayload
} from "../lib/test.functional.meta.mjs";

export const FUNZIONALI_IMPLEMENTATION = {
  title       : "Test funzionali multi-utente"
, summary     : "Suite API in testScript/funzionali/ — 12 giocatori verificati per run, flussi sociali e match end-to-end."
, prerequisites: [
    "API :4000 e auth :4001 avviati"
  , "DATABASE_URL → packages/database/prisma/JLO_DEV.db (cleanup + verify fallback)"
  , "Ideale in dev: SMTP disabilitato (no SMTP_HOST) oppure DEV_EXPOSE_VERIFY_LINK=true"
  , "Con SMTP attivo: se register risponde 500 (rate limit), recovery via login + verify DB"
  ]
, architecture: [
    "lib/functional-users.mjs — registra o riusa pool func-{runId}-u00…u11"
  , "lib/friend-bot-user.mjs — utente persistente jlo-friend-bot@justlastone.test"
  , "friend-bot.mjs — daemon dev accept + auto-reply chat (JLO_FRIEND_BOT=1)"
  , "lib/functional-fixtures.mjs — cleanup amicizie/match e helper POST /matches"
  , "run-funzionali.mjs — orchestratore con JLO_FUNC_RUN_ID condiviso"
  , "Report JSON in data/reports/latest.json (come TestTecnici)"
  ]
, runOrder: [
    "test-seed-utenti.mjs"
  , "test-friend-bot.mjs"
  , "test-amici-multiutente.mjs"
  , "test-match-multiutente.mjs"
  , "test-flusso-completo.mjs"
  , "friend-bot.mjs (daemon manuale, non in orchestratore)"
  ]
};

/** @type {Array<{ script: string, topic?: string, topicLabel?: string, title: string, cases: Array<{ name: string, description: string }> }>} */
export const FUNZIONALI_SCENARIOS = [
  {
    script     : "funzionali/run-funzionali.mjs"
  , topic      : "orchestrazione"
  , topicLabel : "Orchestrazione"
  , title      : "Orchestratore suite completa"
  , cases      : [
      { name: "preflight health auth + API", description: "Step 1 — Verifica auth e API prima degli script figli" }
    , { name: "sequenza seed → amici → match → flusso", description: "Step 2 — Stesso JLO_FUNC_RUN_ID per tutti gli script figli" }
    , { name: "merge report latest.json", description: "Step 3 — Aggiorna latest.json per il cruscotto" }
    ]
  }
, {
    script     : "funzionali/test-seed-utenti.mjs"
  , topic      : "seed"
  , topicLabel : "Seed pool utenti"
  , title      : "Seed 12 utenti verificati"
  , cases      : [
      { name: "cleanup previous functional run state", description: "Step 1 — Cleanup Prisma run precedente" }
    , { name: "register and verify 12 functional users", description: "Step 2 — Pool func-{runId}-u00…u11 verificati" }
    , { name: "all users have distinct userId", description: "Step 3 — Nessun userId duplicato" }
    , { name: "export run id for sibling scripts", description: "Step 4 — JLO_FUNC_RUN_ID condiviso in log" }
    ]
  }
, {
    script     : "funzionali/test-friend-bot.mjs"
  , topic      : "bot"
  , topicLabel : "Friend Bot dev"
  , title      : "Bot persistente — amici + chat"
  , cases      : [
      { name: "ensure friend bot user", description: "Step 1 — jlo-friend-bot@justlastone.test verificato" }
    , { name: "setup actor functional user", description: "Step 2 — Utente func per interazione" }
    , { name: "search finds JLO Friend Bot", description: "Step 3 — GET /social/users/search?q=friend" }
    , { name: "actor sends friend request to bot", description: "Step 4 — POST /social/friends/requests" }
    , { name: "bot accepts incoming friend request", description: "Step 5 — Accept via token bot (daemon logic)" }
    , { name: "actor lists bot as friend", description: "Step 6 — Lista amici coerente" }
    , { name: "open direct conversation with bot", description: "Step 7 — POST /chat/conversations/direct" }
    , { name: "actor sends DM to bot", description: "Step 8 — Messaggio outbound" }
    , { name: "bot replies to DM", description: "Step 9 — Echo risposta bot" }
    , { name: "actor reads bot echo in chronology", description: "Step 10 — GET messages con risposta" }
    ]
  }
, {
    script     : "funzionali/friend-bot.mjs"
  , topic      : "bot"
  , topicLabel : "Friend Bot dev"
  , title      : "Daemon polling (test manuale browser)"
  , cases      : [
      { name: "ensureFriendBot on startup", description: "Registra/riusa bot persistente" }
    , { name: "poll accept incoming requests", description: "Loop GET/POST friends" }
    , { name: "poll reply DM echo", description: "Loop chat conversations/messages" }
    ]
  }
, {
    script     : "funzionali/test-amici-multiutente.mjs"
  , topic      : "amicizie"
  , topicLabel : "Amicizie multi-utente"
  , title      : "Rete amicizie tra ≥10 giocatori"
  , cases      : [
      { name: "setup user pool", description: "Step 1 — Pool 12 utenti verificati" }
    , { name: "star — hub sends 5 friend requests", description: "Step 2 — u0 → u1…u5 pending" }
    , { name: "star — recipients accept hub requests", description: "Step 3 — 5 accettazioni destinatari" }
    , { name: "star — hub lists 5 accepted friends", description: "Step 4 — Lista friends coerente" }
    , { name: "chain — u6→u7→u8 accepted sequentially", description: "Step 5 — Catena lineare accettata" }
    , { name: "mutual pending — u9→u10 then u10→u9 auto-accepts", description: "Step 6 — Richiesta incrociata auto-accept" }
    , { name: "duplicate outgoing request → 409", description: "Step 7 — Conflict richiesta duplicata" }
    , { name: "already friends → 409", description: "Step 8 — Conflict già amici" }
    , { name: "friend request to self → 400", description: "Step 9 — Bad request verso sé stessi" }
    , { name: "accept by non-recipient → 403", description: "Step 10 — Forbidden accettazione errata" }
    , { name: "pending incoming visible until accepted", description: "Step 11 — u11→u0 chiusura pending" }
    ]
  }
, {
    script     : "funzionali/test-match-multiutente.mjs"
  , topic      : "match"
  , topicLabel : "Match multi-utente"
  , title      : "Match — join multipli, ready, capienza"
  , cases      : [
      { name: "setup user pool", description: "Step 1 — Pool utenti condiviso" }
    , { name: "host creates match maxMembers=4 minMembers=3", description: "Step 2 — Host u0 crea squad max 4" }
    , { name: "sequential join — u1…u3 fill roster to 4/4", description: "Step 3 — Join sequenziali fino al pieno" }
    , { name: "full match — u4 rejected with 409", description: "Step 4 — Match pieno → 409" }
    , { name: "double join — u1 already member 409", description: "Step 5 — Already a member" }
    , { name: "all members toggle ready — readyCount reaches 4", description: "Step 6 — Ready su tutti i membri" }
    , { name: "leave — u3 exits, slots freed", description: "Step 7 — Leave libera uno slot" }
    , { name: "re-join after leave — u4 fills freed slot", description: "Step 8 — Re-join riempie roster" }
    , { name: "partial roster — second match with 3 joins", description: "Step 9 — Secondo match 3/4" }
    ]
  }
, {
    script     : "funzionali/test-flusso-completo.mjs"
  , topic      : "e2e"
  , topicLabel : "Flusso E2E"
  , title      : "E2E amici + match"
  , cases      : [
      { name: "phase 1 — register 10+ verified users", description: "Step 1 — Pool minimo 10 utenti" }
    , { name: "phase 2 — organizer befriends u1…u4", description: "Step 2 — Stella amicizie host" }
    , { name: "phase 2b — side pairs u5↔u6 and u7↔u8", description: "Step 3 — Coppie laterali" }
    , { name: "phase 3 — organizer creates squad match (max 4)", description: "Step 4 — Creazione match squad" }
    , { name: "phase 4 — friends u1…u2 join the match", description: "Step 5 — Amici iscritti (3/4)" }
    , { name: "phase 5 — organizer + u1…u2 mark ready", description: "Step 6 — Ready multi-utente" }
    , { name: "phase 6 — u3 (friend, not joined) fills last open slot", description: "Step 7 — Ultimo slot 4/4" }
    , { name: "phase 7 — GET /matches lists E2E match in recruiting", description: "Step 8 — Visibilità lista recruiting" }
    ]
  }
];

/**
 * @returns {Promise<Record<string, unknown>>}
 */
export async function getFunzionaliMetaPayload() {
  return buildFunzionaliMetaPayload({
    implementation : FUNZIONALI_IMPLEMENTATION
  , scenarios      : FUNZIONALI_SCENARIOS
  });
}
