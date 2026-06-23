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
 *              Avvio singolo servizio product dev — auth, api, web (CLI generico).
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Process tab start-one deve avviare un solo servizio senza rialzare tutto lo stack.
 *
 *   A cosa serve:
 *   - Delega a runDevServiceStartCli con id servizio da runner.config devStack overlay.
 *
 * Generalizzazione:
 *   Si — servizi disponibili da devStack in runner.config.{overlay}.mjs.
 *
 * Input:
 *   - argv posizionale o --service — id servizio (auth, api, web, …)
 *   - flag --no-build, --cleanup, --help
 *
 * Uso:
 *   - node cruscotto.frontend/cruscotto.process.start.service.mjs auth
 *
 * Exit code:
 *   0 — servizio avviato o --help
 *   1 — servizio sconosciuto o errore spawn
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { runDevServiceStartCli } from "./cruscotto.runner.stack.mjs";

runDevServiceStartCli(process.argv.slice(2));
