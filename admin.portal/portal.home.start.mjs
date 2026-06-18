#!/usr/bin/env node
/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** SCRIPT ENTRYPOINT ** -- commentato il: 2026-06-18 03:59
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-18 03:53   by: IbyEll
 * modificato il: 2026-06-18 03:59   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *                           Avvio PortalAdmin — spawn runner portal.home.server (modalità HOME).
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Entrypoint alternativo che delega a portal.home.server senza passare da npm run admin:home.
 *   - Mantiene cwd PortalAdmin e stdio ereditato per log unificati in terminale.
 *
 *   A cosa serve:
 *   - Spawn node su admin.portal/portal.home.server.mjs con env corrente; exit code propagato al parent.
 *
 * Generalizzazione:
 *   No — avvio fisso del server HOME sulla root PortalAdmin.
 *
 * Input:
 *   - Input: —
 *
 * Uso:
 *   - node admin.portal/portal.home.start.mjs
 *
 * Flag CLI:
 *   - nessuno
 *
 * Variabili d'ambiente:
 *   - PORTAL_HOME_PORT — inoltrata al child (default 3990 in portal.home.server)
 *
 * npm (se applicabile):
 *   - npm run admin:home — preferito (invoca direttamente portal.home.server.mjs)
 *
 * Prerequisiti:
 *   - admin.portal/portal.home.server.mjs presente
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PORTAL_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const serverPath  = join(PORTAL_ROOT, "admin.portal", "portal.home.server.mjs");

// 1. Spawn server HOME — stdio inherit, cwd repo root
const child = spawn(process.execPath, [serverPath], {
  cwd       : PORTAL_ROOT
, env       : process.env
, stdio     : "inherit"
});

child.on("exit", (code) => {
  // 2. Propaga exit code child al processo parent
  process.exit(code ?? 0);
});
