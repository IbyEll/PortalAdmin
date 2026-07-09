-- CreateTable
CREATE TABLE "matrix_run" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matrix_kind" TEXT NOT NULL,
    "generated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,
    "metrics_json" TEXT,
    "sync_run_id" TEXT,
    CONSTRAINT "matrix_run_sync_run_id_fkey" FOREIGN KEY ("sync_run_id") REFERENCES "sync_run" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "matrix_catalog" (
    "finding_id" TEXT NOT NULL PRIMARY KEY,
    "matrix_kind" TEXT NOT NULL,
    "section_id" TEXT NOT NULL,
    "default_voce" TEXT,
    "scan_ids_json" TEXT,
    "audit_entry_json" TEXT
);

-- CreateTable
CREATE TABLE "matrix_row" (
    "finding_id" TEXT NOT NULL,
    "matrix_kind" TEXT NOT NULL,
    "matrix_run_id" TEXT NOT NULL,
    "section_id" TEXT,
    "status" TEXT NOT NULL,
    "sev" TEXT,
    "project" TEXT,
    "voce" TEXT,
    "dettaglio" TEXT,
    "paths_json" TEXT,
    "resolved_note" TEXT,
    "content_sig" TEXT,
    "first_seen_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("finding_id", "matrix_kind"),
    CONSTRAINT "matrix_row_matrix_run_id_fkey" FOREIGN KEY ("matrix_run_id") REFERENCES "matrix_run" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "matrix_row_event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "finding_id" TEXT NOT NULL,
    "matrix_kind" TEXT NOT NULL,
    "matrix_run_id" TEXT NOT NULL,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "event_type" TEXT NOT NULL,
    "old_status" TEXT,
    "new_status" TEXT,
    "note" TEXT,
    CONSTRAINT "matrix_row_event_matrix_run_id_fkey" FOREIGN KEY ("matrix_run_id") REFERENCES "matrix_run" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "matrix_row_event_finding_id_matrix_kind_fkey" FOREIGN KEY ("finding_id", "matrix_kind") REFERENCES "matrix_row" ("finding_id", "matrix_kind") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "matrix_finding_issue" (
    "finding_id" TEXT NOT NULL,
    "matrix_kind" TEXT NOT NULL,
    "jira_key" TEXT NOT NULL,
    "issue_type" TEXT,
    "linked_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "linked_source" TEXT,
    PRIMARY KEY ("finding_id", "matrix_kind"),
    CONSTRAINT "matrix_finding_issue_finding_id_matrix_kind_fkey" FOREIGN KEY ("finding_id", "matrix_kind") REFERENCES "matrix_row" ("finding_id", "matrix_kind") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "matrix_run_matrix_kind_idx" ON "matrix_run"("matrix_kind");

-- CreateIndex
CREATE INDEX "matrix_run_sync_run_id_idx" ON "matrix_run"("sync_run_id");

-- CreateIndex
CREATE INDEX "matrix_catalog_matrix_kind_idx" ON "matrix_catalog"("matrix_kind");

-- CreateIndex
CREATE INDEX "matrix_catalog_section_id_idx" ON "matrix_catalog"("section_id");

-- CreateIndex
CREATE INDEX "matrix_row_matrix_run_id_idx" ON "matrix_row"("matrix_run_id");

-- CreateIndex
CREATE INDEX "matrix_row_status_idx" ON "matrix_row"("status");

-- CreateIndex
CREATE INDEX "matrix_row_event_finding_id_matrix_kind_idx" ON "matrix_row_event"("finding_id", "matrix_kind");

-- CreateIndex
CREATE INDEX "matrix_row_event_matrix_run_id_idx" ON "matrix_row_event"("matrix_run_id");

-- CreateIndex
CREATE UNIQUE INDEX "matrix_finding_issue_jira_key_key" ON "matrix_finding_issue"("jira_key");
