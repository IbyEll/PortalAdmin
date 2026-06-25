#!/usr/bin/env node
/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** SCRIPT ENTRYPOINT ** -- commentato il: 2026-06-23 21:30
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-23 21:30   by: IbyEll
 * modificato il: 2026-06-23 21:30   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *              Worker Cursor Agent — Agent.create/resume in processo figlio SDK @cursor/sdk.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - SDK Cursor può bloccare o crashare il processo; isolamento in child da portal.cursor.agent.manager.
 *
 *   A cosa serve:
 *   - Legge job JSON, esegue agent, emette eventi log/meta/done su stdout una riga JSON.
 *
 * Generalizzazione:
 *   No — invocazione interna con --job path; non entrypoint utente diretto.
 *
 * Input:
 *   - argv --job — path file JSON job spawnato dal manager
 *   - CURSOR_API_KEY — env nel child
 *
 * Uso:
 *   - spawn interno da portal.cursor.agent.manager.mjs
 *
 * Exit code:
 *   0 — job completato
 *   1 — errore SDK o job file invalido
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { readFile, unlink } from "node:fs/promises";

/**
 * @param {Record<string, unknown>} payload
 */
function emit(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

/**
 * @param {import("@cursor/sdk").SDKMessage} message
 * @returns {string}
 */
function extractAssistantText(message) {
  if (message.type !== "assistant") {
    return "";
  }

  /** @type {string[]} */
  const parts = [];

  for (const block of message.message.content) {
    if (block.type === "text" && typeof block.text === "string") {
      parts.push(block.text);
    }
  }

  return parts.join("");
}

/**
 * @param {string[]} argv
 * @returns {string | null}
 */
function parseJobPath(argv) {
  const idx = argv.indexOf("--job");

  if (idx === -1) {
    return null;
  }

  return argv[idx + 1]?.trim() ?? null;
}

/**
 * @typedef {{
 *   runtime: "local" | "cloud"
 *   prompt: string
 *   apiKey: string
 *   model: { id: string }
 *   localCwd?: string
 *   cloudRepos?: Array<{ url: string, startingRef?: string }>
 *   autoCreatePR?: boolean
 *   resumeAgentId?: string | null
 *   name?: string
 * }} CursorAgentJob
 */

async function main() {
  const jobPath = parseJobPath(process.argv.slice(2));

  if (!jobPath) {
    emit({ type: "log", stream: "stderr", text: "Uso: admin.portal/cursor.agent.worker.mjs --job <path.json>" });
    process.exit(1);
    return;
  }

  /** @type {CursorAgentJob} */
  let job;

  try {
    job = JSON.parse(await readFile(jobPath, "utf8"));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    emit({ type: "log", stream: "stderr", text: `Job non leggibile: ${message}` });
    process.exit(1);
    return;
  } finally {
    try {
      await unlink(jobPath);
    } catch {
      // job temporaneo già rimosso
    }
  }

  if (!job.apiKey || !job.prompt?.trim()) {
    emit({ type: "log", stream: "stderr", text: "Job incompleto: apiKey e prompt obbligatori" });
    process.exit(1);
    return;
  }

  const { Agent, CursorAgentError } = await import("@cursor/sdk");

  /** @type {import("@cursor/sdk").SDKAgent | null} */
  let agent = null;

  try {
    emit({
      type   : "log"
    , stream : "system"
    , text   : `=== Cursor agent ${job.runtime} — avvio ===`
    });

    const baseOpts = {
      apiKey : job.apiKey
    , model  : job.model ?? { id: "composer-2.5" }
    , name   : job.name ?? `PortalAdmin ${job.runtime}`
    };

    if (job.resumeAgentId) {
      agent = await Agent.resume(job.resumeAgentId, baseOpts);
      emit({
        type   : "log"
      , stream : "system"
      , text   : `Resume agent ${job.resumeAgentId}`
      });
    } else if (job.runtime === "cloud") {
      agent = await Agent.create({
        ...baseOpts
      , cloud: {
          repos        : job.cloudRepos ?? []
        , autoCreatePR : job.autoCreatePR !== false
        , skipReviewerRequest: true
        }
      });
    } else {
      agent = await Agent.create({
        ...baseOpts
      , local: {
          cwd            : job.localCwd ?? process.cwd()
        , settingSources : []
        }
      });
    }

    emit({
      type    : "meta"
    , runtime : job.runtime
    , agentId : agent.agentId
    });

    const run = await agent.send(job.prompt.trim());

    emit({
      type  : "meta"
    , runId : run.id
    });

    /** @type {string[]} */
    const assistantChunks = [];

    for await (const event of run.stream()) {
      if (event.type === "assistant") {
        const text = extractAssistantText(event);

        if (text) {
          assistantChunks.push(text);
          emit({ type: "log", stream: "assistant", text });
        }
      } else if (event.type === "tool_use") {
        const name = event.message?.name ?? "tool";
        emit({ type: "log", stream: "system", text: `[tool] ${name}` });
      }
    }

    const result = await run.wait();

    if (result.status === "error") {
      const detail = typeof result.result === "string" && result.result.trim()
        ? result.result.trim()
        : assistantChunks.join("").trim();

      emit({
        type   : "log"
      , stream : "stderr"
      , text   : detail
        ? `Run terminato con errore (runId=${run.id}): ${detail.slice(0, 2000)}`
        : `Run terminato con errore (runId=${run.id}) — nessun messaggio assistant nel run`
      });
      emit({
        type   : "done"
      , status : "error"
      , runId  : run.id
      , agentId: agent.agentId
      , error  : detail ? detail.slice(0, 500) : null
      });
      process.exit(2);
      return;
    }

    emit({
      type   : "log"
    , stream : "system"
    , text   : `=== Completato — status ${result.status} ===`
    });
    emit({
      type    : "done"
    , status  : "finished"
    , runId   : run.id
    , agentId : agent.agentId
    });
    process.exit(0);
  } catch (err) {
    if (CursorAgentError && err instanceof CursorAgentError) {
      emit({
        type   : "log"
      , stream : "stderr"
      , text   : `CursorAgentError: ${err.message} (retryable=${String(err.isRetryable)})`
      });
    } else {
      const message = err instanceof Error ? err.message : String(err);
      emit({ type: "log", stream: "stderr", text: message });
    }

    emit({ type: "done", status: "error" });
    process.exit(1);
  } finally {
    if (agent) {
      try {
        await agent[Symbol.asyncDispose]?.();
      } catch {
        try {
          agent.close();
        } catch {
          // ignore dispose errors
        }
      }
    }
  }
}

main();
