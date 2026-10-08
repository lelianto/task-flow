CREATE TABLE "Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'to_do' CHECK ("status" IN ('to_do','pending','in_progress','done')),
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "actor" TEXT NOT NULL CHECK ("actor" IN ('john.doe','jane.smith','alex.chen')),
    "fromStatus" TEXT NOT NULL CHECK ("fromStatus" IN ('to_do','pending','in_progress','done')),
    "toStatus" TEXT NOT NULL CHECK ("toStatus" IN ('to_do','pending','in_progress','done')),
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "WorkflowSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY CHECK ("id" = 1),
    "allowBackwardTransitions" BOOLEAN NOT NULL DEFAULT false,
    "allowStatusSkipping" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "AuditLog_taskId_createdAt_id_idx" ON "AuditLog"("taskId", "createdAt", "id");
INSERT INTO "WorkflowSettings" ("id", "allowBackwardTransitions", "allowStatusSkipping", "updatedAt") VALUES (1, false, false, CURRENT_TIMESTAMP);

CREATE TRIGGER "AuditLog_prevent_update"
BEFORE UPDATE ON "AuditLog"
BEGIN
  SELECT RAISE(ABORT, 'Audit logs are immutable');
END;

CREATE TRIGGER "AuditLog_prevent_delete"
BEFORE DELETE ON "AuditLog"
BEGIN
  SELECT RAISE(ABORT, 'Audit logs are immutable');
END;
