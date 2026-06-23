/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-23 20:42
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-23 20:42   by: IbyEll
 * modificato il: 2026-06-23 20:42   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *              Helper HTTP e spawn condivisi PortalAdmin (sostituisce testScript/lib/http).
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Utility comuni (URL, exit code Windows, spawn) non devono vivere nel product repo JLO.
 *
 *   A cosa serve:
 *   - Normalizza URL, documenta exit code UV su Windows e policy shell:false per child_process.
 *
 * Generalizzazione:
 *   Si — riusabile da lib/project.config, runner e test host senza dipendenza overlay.
 *
 * Input:
 *   - —
 *
 * Consumatori:
 *   - lib/project.config.mjs — stripTrailingSlash in resolveDevStackProbeUrls
 *   - runner e testscript host — spawnShellOption, WINDOWS_UV_CRASH_EXIT
 *
 * Export principali:
 *   - stripTrailingSlash — rimuove slash finale da base URL
 *   - WINDOWS_UV_CRASH_EXIT — exit code noto dopo process.exit su Windows
 *   - spawnShellOption — ritorna false (evita DEP0190 con npm.cmd/taskkill)
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

/**
 * Rimuove lo slash finale da una base URL (health probe, API base).
 *
 * @param {string} url
 * @returns {string}
 */
export function stripTrailingSlash(url) {
  return url.replace(/\/$/, "");
}

/** Exit code Node su Windows quando fetch/Prisma chiudono handle dopo process.exit(). */
export const WINDOWS_UV_CRASH_EXIT = 3221226505;

/**
 * Opzione shell per child_process.spawn/spawnSync.
 * Su Windows usare shell:false con npm.cmd / taskkill / netstat in argv (evita DEP0190).
 *
 * @param {string} _cmd
 * @returns {false}
 */
export function spawnShellOption(_cmd) {
  return false;
}
