/**
 * Meta test funzionali AdminDashboard — suite admin.portal.testscript/funzionali.
 */

import { buildFunzionaliMetaPayload } from "../lib/test.functional.meta.mjs";

export const FUNZIONALI_IMPLEMENTATION = {
  title         : "Test funzionali PortalAdmin"
, summary       : "Suite in admin.portal.testscript/funzionali/ — cruscotto, backlog gogo, Cursor agent UI."
, prerequisites : [
    "Cruscotto su PRJ_DASHBOARD_PORT (default :3998)"
  , "Per test Jira: credenziali Atlassian in .env"
  , "Per Cursor agent: CURSOR_API_KEY opzionale (test API skip avvio reale)"
  ]
, architecture  : [
    "admin.portal.testscript/lib — HTTP e contesto overlay"
  , "Discovery catalogo — suite funzionali in lib/test.catalog.mjs"
  ]
, runOrder      : [
    "funzionali/test.cruscotto.startup.mjs"
  , "funzionali/test.cruscotto.backlog.gogo.mjs"
  , "funzionali/test.cursor.agent.ui.mjs"
  ]
};

export async function getFunzionaliMetaPayload() {
  return buildFunzionaliMetaPayload({ implementation: FUNZIONALI_IMPLEMENTATION });
}
