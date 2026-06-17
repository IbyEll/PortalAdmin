/**
 * Fixture Prisma test — facade overlay `test.custom.match-fixtures.{PRJ_NAME}.mjs`.
 *
 * Descrizione funzionale:
 *   Perché esiste: setup DATABASE_URL e reset stato DB seed sono specifici del product;
 *     run-all importa un modulo generico indipendente dal nome progetto.
 *   A cosa serve: re-export reset/setup dal overlay in PROJECT_{PRJ_NAME}/.
 *
 * Consumatori: runner/run-all.mjs
 *
 * Export principali:
 *   setupDefaultDatabaseUrl, resetHostTestState, clearHostRecruitingMatches
 */

import { resolveProjectOverlayName } from "./admin/config.project.mjs";

const overlayName = resolveProjectOverlayName();

const fixtures = await import(
  `../PROJECT_${overlayName}/test.custom.match-fixtures.${overlayName}.mjs`
);

export const {
  clearHostRecruitingMatches
, resetHostTestState
, setupDefaultDatabaseUrl
} = fixtures;
