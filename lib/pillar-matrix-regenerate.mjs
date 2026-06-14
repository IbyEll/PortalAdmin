/**
 * Rigenera matrice pilastri — solo portal cruscotto (HTML locale).
 * Equivalente CLI: node scripts/generate-pillar-matrix-portal.mjs
 */

import { generatePillarMatrixHtml } from "../scripts/generate-confluence-pillar-matrix.mjs";
import { writePillarMatrixPortalFromBundle } from "../scripts/generate-pillar-matrix-portal.mjs";

const REGENERATE_COMMAND = "node scripts/generate-pillar-matrix-portal.mjs";

/**
 * Scarica Jira + repo e aggiorna cruscotto/pillar-matrix/ (senza Confluence).
 */
export async function regeneratePillarMatrix() {
  const startedAt = new Date();
  const bundle    = await generatePillarMatrixHtml();
  const portal    = writePillarMatrixPortalFromBundle(bundle);

  return {
    regeneratedAt : startedAt.toISOString()
  , fetchedAt     : bundle.fetchedAt
  , backlogTotal  : bundle.backlog
  , pages         : portal.pages
  , command       : REGENERATE_COMMAND
  };
}

export { REGENERATE_COMMAND };
