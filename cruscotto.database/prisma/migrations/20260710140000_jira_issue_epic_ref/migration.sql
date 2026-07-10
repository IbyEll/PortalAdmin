-- Epic di riferimento manuale per story orphan nel Working Plan
CREATE TABLE "jira_issue_epic_ref" (
    "jira_key" TEXT NOT NULL PRIMARY KEY,
    "epic_jira_key" TEXT NOT NULL,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "jira_issue_epic_ref_epic_jira_key_idx" ON "jira_issue_epic_ref"("epic_jira_key");
