-- CreateTable
CREATE TABLE "jira_issue_wip" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jira_key" TEXT NOT NULL,
    "issue_type" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "status_category" TEXT,
    "parent_jira_key" TEXT,
    "jira_updated_at" DATETIME,
    "tier" TEXT NOT NULL,
    "is_story_like" BOOLEAN NOT NULL DEFAULT false,
    "is_done" BOOLEAN NOT NULL DEFAULT false,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "has_children" BOOLEAN NOT NULL DEFAULT false,
    "dev_order" TEXT,
    "dev_sprint" INTEGER,
    "dev_sprint_name" TEXT,
    "dev_sort" INTEGER,
    "is_sprint6_obsolete" BOOLEAN NOT NULL DEFAULT false,
    "related_keys" TEXT,
    "raw_fields" TEXT,
    "sync_run_id" TEXT NOT NULL,
    "synced_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "jira_issue_wip_sync_run_id_fkey" FOREIGN KEY ("sync_run_id") REFERENCES "sync_run" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "jira_issue_wip_jira_key_key" ON "jira_issue_wip"("jira_key");

-- CreateIndex
CREATE INDEX "jira_issue_wip_sync_run_id_idx" ON "jira_issue_wip"("sync_run_id");

-- CreateIndex
CREATE INDEX "jira_issue_wip_parent_jira_key_idx" ON "jira_issue_wip"("parent_jira_key");
