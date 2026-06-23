/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-23 20:42
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-23 20:42   by: IbyEll
 * modificato il: 2026-06-23 20:42   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *              Facade fixture Prisma test — overlay dinamico con fallback PROJECT_Base.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Setup DATABASE_URL e reset stato DB seed dipendono dal product; run-all importa un modulo
 *     generico senza hardcode del nome overlay.
 *
 *   A cosa serve:
 *   - Re-export dinamico di reset e setup da PROJECT_{overlay}/ o PROJECT_Base/ via import ESM.
 *
 * Generalizzazione:
 *   Si — path fixture da PRJ_NAME (resolveProjectOverlayName) e resolveProjectOverlayFilePath.
 *
 * Input:
 *   - PRJ_NAME — overlay attivo in env (project.config)
 *   - path relativo test.custom.match-fixtures.{overlay}.mjs o test.custom.match-fixtures.mjs
 *
 * Consumatori:
 *   - lib/test.run.all.mjs — setupDefaultDatabaseUrl, resetHostTestState prima dei test
 *
 * Export principali:
 *   - setupDefaultDatabaseUrl — imposta o risolve root product per DATABASE_URL
 *   - resetHostTestState — pulizia stato host/DB prima della suite
 *   - clearHostRecruitingMatches — cancella match recruiting in corso (no-op se assente)
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { pathToFileURL } from "node:url";

import { resolveProjectOverlayName } from "./project.config.mjs";
import { resolveProjectOverlayFilePath } from "./overlay/project.overlay.paths.mjs";

// 1. Overlay attivo — nome da PRJ_NAME in env
const overlayName = resolveProjectOverlayName();

// 2. Risoluzione path — overlay specifico poi PROJECT_Base
const fixturesPath = resolveProjectOverlayFilePath(
  overlayName
, `test.custom.match-fixtures.${overlayName}.mjs`
)
  ?? resolveProjectOverlayFilePath(overlayName, "test.custom.match-fixtures.mjs");

if (!fixturesPath) {
  throw new Error(
    `Fixture test mancanti per overlay ${overlayName}: `
    + `PROJECT_${overlayName}/test.custom.match-fixtures.${overlayName}.mjs `
    + `o PROJECT_Base/test.custom.match-fixtures.mjs`
  );
}

// 3. Import dinamico e re-export simboli attesi da run-all
const fixtures = await import(pathToFileURL(fixturesPath).href);

export const {
  clearHostRecruitingMatches
, resetHostTestState
, setupDefaultDatabaseUrl
} = fixtures;
