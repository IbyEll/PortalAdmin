/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-23 21:05
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-23 21:05   by: IbyEll
 * modificato il: 2026-06-23 21:05   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *         Meta test funzionali AdminDashBoard — suite admin.portal.testscript/funzionali.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Tab TestFunzionali cruscotto richiede overview e runOrder specifici PortalAdmin.
 *
 *   A cosa serve:
 *   - FUNZIONALI_IMPLEMENTATION e getFunzionaliMetaPayload per API meta funzionali.
 *
 * Generalizzazione:
 *   No — scenari e prerequisites dedicati overlay AdminDashBoard.
 *
 * Input:
 *   - —
 *
 * Consumatori:
 *   - admin.portal.lib/dashboard.project.mjs — import test.functional.meta.AdminDashBoard.mjs
 *   - cruscotto.frontend/cruscotto.server.mjs — GET meta test funzionali
 *
 * Export principali:
 *   - FUNZIONALI_IMPLEMENTATION — title, summary, prerequisites, runOrder
 *   - getFunzionaliMetaPayload — payload discovery + implementation
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { buildFunzionaliMetaPayload } from "../admin.portal.lib/test.functional.meta.mjs";

export const FUNZIONALI_IMPLEMENTATION = {
  title         : "Test funzionali PortalAdmin"
, summary       : "Suite in admin.portal.testscript/funzionali/ — cruscotto, issue UI, backlog gogo, Cursor agent UI."
, prerequisites : [
    "Cruscotto su PRJ_DASHBOARD_PORT (default :3998)"
  , "Per test Jira: credenziali Atlassian in .env"
  , "Per Cursor agent: CURSOR_API_KEY opzionale (test API skip avvio reale)"
  ]
, architecture  : [
    "admin.portal.testscript/lib — HTTP e contesto overlay"
  , "Discovery catalogo — suite funzionali in admin.portal.lib/test.catalog.mjs"
  ]
, runOrder      : [
    "funzionali/test.cruscotto.startup.mjs"
  , "funzionali/test.cruscotto.issue.ui.mjs"
  , "funzionali/test.cruscotto.backlog.gogo.mjs"
  , "funzionali/test.cursor.agent.ui.mjs"
  ]
};

export async function getFunzionaliMetaPayload() {
  return buildFunzionaliMetaPayload({ implementation: FUNZIONALI_IMPLEMENTATION });
}
