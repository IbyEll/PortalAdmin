/**
 * Re-export backward compat — implementazione in discovery-services-repo.mjs.
 *
 * Descrizione funzionale:
 *   Perché esiste: consumer legacy importano ancora repo-service-discovery.mjs.
 *   A cosa serve: alias verso discovery-services-repo senza cambiare import path.
 *
 * @see ./discovery-services-repo.mjs — documentazione ponte ADMIN ↔ REPO (*! in testata)
 * @see ./discovery-config.mjs — parametri per progetto product
 */

export {
  discoverRepoServices
, formatStartPlan
, resolveServiceStartUnit
, REPO_EXTRAS_ALL
, PRODUCT_REPO_EXTRAS
, PRODUCT_STACK_COMPLETE_EXTRAS
, PRODUCT_REPO_LABEL
, FRIEND_BOT_PROCESS_FRAGMENT
} from "./discovery-services-repo.mjs";
