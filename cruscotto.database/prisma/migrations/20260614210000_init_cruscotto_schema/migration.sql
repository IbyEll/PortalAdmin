-- CreateTable
CREATE TABLE "sync_run" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" DATETIME,
    "source" TEXT NOT NULL DEFAULT 'jira-api',
    "issue_count" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "jira_issue" (
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
    CONSTRAINT "jira_issue_sync_run_id_fkey" FOREIGN KEY ("sync_run_id") REFERENCES "sync_run" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "jira_sprint" (
    "id" INTEGER NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "start_date" DATETIME,
    "end_date" DATETIME
);

-- CreateTable
CREATE TABLE "jira_issue_sprint" (
    "issue_id" TEXT NOT NULL,
    "sprint_id" INTEGER NOT NULL,
    PRIMARY KEY ("issue_id", "sprint_id"),
    CONSTRAINT "jira_issue_sprint_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "jira_issue" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "jira_issue_sprint_sprint_id_fkey" FOREIGN KEY ("sprint_id") REFERENCES "jira_sprint" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "jira_issue_link" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "from_issue_id" TEXT NOT NULL,
    "to_issue_id" TEXT NOT NULL,
    "link_type" TEXT NOT NULL,
    CONSTRAINT "jira_issue_link_from_issue_id_fkey" FOREIGN KEY ("from_issue_id") REFERENCES "jira_issue" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "jira_issue_link_to_issue_id_fkey" FOREIGN KEY ("to_issue_id") REFERENCES "jira_issue" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "working_plan_sprint_keys" (
    "plan_sprint_name" TEXT NOT NULL PRIMARY KEY,
    "issue_keys" TEXT NOT NULL,
    "sync_run_id" TEXT NOT NULL,
    CONSTRAINT "working_plan_sprint_keys_sync_run_id_fkey" FOREIGN KEY ("sync_run_id") REFERENCES "sync_run" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "jira_issue_jira_key_key" ON "jira_issue"("jira_key");

-- CreateIndex
CREATE INDEX "jira_issue_sync_run_id_idx" ON "jira_issue"("sync_run_id");

-- CreateIndex
CREATE INDEX "jira_issue_parent_jira_key_idx" ON "jira_issue"("parent_jira_key");

-- CreateIndex
CREATE INDEX "jira_issue_link_from_issue_id_idx" ON "jira_issue_link"("from_issue_id");

-- CreateIndex
CREATE INDEX "jira_issue_link_to_issue_id_idx" ON "jira_issue_link"("to_issue_id");
