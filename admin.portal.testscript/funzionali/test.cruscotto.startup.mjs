#!/usr/bin/env node
/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** SCRIPT ENTRYPOINT ** -- commentato il: 2026-06-18 16:10
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-18 16:10   by: IbyEll
 * modificato il: 2026-06-18 16:10   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *                           Smoke avvio cruscotto HTTP — spawn server, attesa health e API base
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - CI e dev richiedono smoke end-to-end: avvio cruscotto per overlay e verifica contratto API minimo.
 *
 *   A cosa serve:
 *   - Spawn opzionale cruscotto.server.mjs, attesa dashboard, probe /api/health, project e scripts.
 *
 * Generalizzazione:
 *   Si — overlay, porta, product repo e timeout da argv; env PRJ_NAME e DASHBOARD_PORT al child.
 *
 * Input:
 *   - --overlay       — overlay obbligatorio (es. JustLastOne, AdminDashBoard)
 *   - --port          — porta dashboard alternativa
 *   - --product-repo  — override PRODUCT_REPO_PATH
 *   - --no-spawn      — usa cruscotto già avviato; fail se down
 *   - --keep          — non terminare child spawnato a fine test
 *   - --timeout       — ms attesa dashboard (default 45000)
 *
 * Uso:
 *   - node admin.portal.testscript/funzionali/test.cruscotto.startup.mjs --overlay JustLastOne
 *   - npm run test:cruscotto-startup -- --overlay AdminDashBoard
 *
 * Flag CLI:
 *   --help, -h        riepilogo ed exit 0
 *   --overlay         overlay da istanziare (obbligatorio)
 *   --port              porta dashboard
 *   --product-repo      path product repo
 *   --no-spawn          nessun spawn; richiede cruscotto già up
 *   --keep              lascia processo server attivo
 *   --timeout           timeout attesa ms
 *
 * Variabili d'ambiente:
 *   ereditate dal parent al child spawn — PRJ_NAME, DASHBOARD_PORT, PRODUCT_REPO_PATH
 *
 * npm:
 *   npm run test:cruscotto-startup
 *
 * Prerequisiti:
 *   - PROJECT overlay presente; product repo path esistente
 *   - cruscotto.frontend/cruscotto.server.mjs raggiungibile da PORTAL_ROOT
 *
 * Exit code:
 *   0 — health, project e scripts OK; messaggio OK cruscotto startup
 *   1 — overlay mancante, timeout, HTTP errore o exit anticipato child
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

import {
  loadOverlayConfig
, resolveOverlayDashboardPort
} from "../../admin.portal.lib/portal.instance.mjs";
import { isFullDashboardUp } from "../../admin.portal.lib/portal.launch.dashboard.mjs";
import { portalFetch } from "../lib/http.mjs";
import { resolveProductRepoPathForOverlay } from "../lib/portal-context.mjs";

const PORTAL_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SERVER_REL  = "cruscotto.frontend/cruscotto.server.mjs";

/**
 * @typedef {{
 *   overlay      : string | null
 * , port         : number | null
 * , productRepo  : string | null
 * , noSpawn      : boolean
 * , keep         : boolean
 * , timeoutMs    : number
 * , help         : boolean
 * }} StartupCli
 */

/**
 * Parse argv smoke startup — overlay obbligatorio salvo help.
 *
 * @param {string[]} argv
 * @returns {StartupCli}
 */
function parseStartupCli(argv) {
  /** @type {StartupCli} */
  const out = {
    overlay     : null
  , port        : null
  , productRepo : null
  , noSpawn     : false
  , keep        : false
  , timeoutMs   : 45_000
  , help        : false
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--help" || arg === "-h") {
      out.help = true;
      continue;
    }

    if (arg === "--no-spawn") {
      out.noSpawn = true;
      continue;
    }

    if (arg === "--keep") {
      out.keep = true;
      continue;
    }

    if (arg === "--overlay" || arg === "--project") {
      out.overlay = argv[++i]?.trim() ?? null;
      continue;
    }

    if (arg === "--port") {
      const n = Number(argv[++i]);
      out.port = Number.isFinite(n) && n > 0 ? n : null;
      continue;
    }

    if (arg === "--product-repo") {
      out.productRepo = argv[++i]?.trim() ?? null;
      continue;
    }

    if (arg === "--timeout") {
      const n = Number(argv[++i]);
      out.timeoutMs = Number.isFinite(n) && n > 0 ? n : out.timeoutMs;
      continue;
    }

    throw new Error(`Argomento sconosciuto: ${arg}`);
  }

  return out;
}

/**
 * Attende cruscotto full dashboard su porta — polling isFullDashboardUp.
 *
 * @param {number} port
 * @param {number} timeoutMs
 * @param {() => void} [onPoll]
 */
async function waitForDashboard(port, timeoutMs, onPoll) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    onPoll?.();

    if (await isFullDashboardUp(port)) {
      return;
    }

    await delay(400);
  }

  throw new Error(`Cruscotto non raggiungibile su :${port} entro ${timeoutMs}ms`);
}

async function main() {
  // 1. Help / parse argv — esci 0 senza spawn
  const cli = parseStartupCli(process.argv);

  if (cli.help) {
    console.log("Uso: node admin.portal.testscript/funzionali/test.cruscotto.startup.mjs --overlay JustLastOne");
    return;
  }

  // 2. Validazione overlay obbligatorio — exit 1 via catch se mancante
  if (!cli.overlay) {
    throw new Error("Specificare --overlay (es. JustLastOne, AdminDashBoard)");
  }

  const overlay = cli.overlay;
  const config  = await loadOverlayConfig(overlay);

  if (!config) {
    throw new Error(`Overlay "${overlay}" non trovato`);
  }

  // 3. Setup contesto — porta, product repo, base URL
  const port            = cli.port ?? await resolveOverlayDashboardPort(overlay, config);
  const productRepoPath = resolveProductRepoPathForOverlay(config, cli.productRepo);
  const base            = `http://127.0.0.1:${port}`;

  if (!existsSync(productRepoPath)) {
    throw new Error(`Product repo non trovato: ${productRepoPath}`);
  }

  /** @type {import("node:child_process").ChildProcess | null} */
  let child = null;
  const alreadyUp = await isFullDashboardUp(port);
  const spawned   = !cli.noSpawn && !alreadyUp;

  // 4. Spawn opzionale — --no-spawn richiede dashboard già up
  if (cli.noSpawn && !alreadyUp) {
    throw new Error(`--no-spawn: nessun cruscotto su :${port}`);
  }

  if (spawned) {
    /** @type {Buffer[]} */
    const stderrChunks = [];

    child = spawn(process.execPath, [SERVER_REL], {
      cwd   : PORTAL_ROOT
    , env   : {
        ...process.env
      , PRJ_NAME          : overlay
      , DASHBOARD_PORT    : String(port)
      , PRODUCT_REPO_PATH : productRepoPath.replace(/\\/g, "/")
      }
    , stdio : ["ignore", "pipe", "pipe"]
    });

    child.stderr?.on("data", (buf) => stderrChunks.push(buf));

    await waitForDashboard(port, cli.timeoutMs, () => {
      if (child?.exitCode == null) {
        return;
      }

      const errText = Buffer.concat(stderrChunks).toString("utf8").trim();
      throw new Error(`cruscotto.server exit ${child.exitCode}${errText ? `: ${errText.slice(0, 480)}` : ""}`);
    });
  } else if (!alreadyUp) {
    await waitForDashboard(port, cli.timeoutMs);
  }

  // 5. Probe API base — health, project, scripts
  const health = await portalFetch(base, "/api/health");
  if (!health.res.ok) {
    throw new Error(`/api/health HTTP ${health.res.status}`);
  }

  const project = await portalFetch(base, "/api/cruscotto/project");
  if (!project.res.ok) {
    throw new Error(`/api/cruscotto/project HTTP ${project.res.status}`);
  }

  const pdata = /** @type {Record<string, unknown>} */ (project.body);
  if (pdata.overlayName !== overlay) {
    throw new Error("overlayName mismatch");
  }

  const scripts = await portalFetch(base, "/api/scripts");
  if (!scripts.res.ok || !Array.isArray(/** @type {Record<string, unknown>} */ (scripts.body).scripts)) {
    throw new Error("/api/scripts invalido");
  }

  // 6. Report OK — cleanup child salvo --keep
  console.log(`OK cruscotto startup overlay=${overlay} port=${port}`);

  if (child && !cli.keep) {
    child.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error("FAIL cruscotto startup:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
