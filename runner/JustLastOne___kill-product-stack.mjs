/**
 * Re-export legacy — implementazione in cruscotto.frontend/cruscotto.process.stop.all.services.mjs
 */

export {
  PRODUCT_NEST_PORTS
, FRIEND_BOT_SCRIPT_REL
, buildProductNestStackKillFragments
, buildFriendBotKillFragments
, buildNestServiceKillFragments
, killFriendBotProcesses
, findFriendBotPids
, killProcessesByFragments
, killProductNestStack
, killProductNestService
} from "../cruscotto.frontend/cruscotto.process.stop.all.services.mjs";
