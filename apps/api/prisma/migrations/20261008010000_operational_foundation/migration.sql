ALTER TABLE "Task" ADD COLUMN "assignee" TEXT CHECK ("assignee" IS NULL OR "assignee" IN ('john.doe','jane.smith','alex.chen'));
ALTER TABLE "Task" ADD COLUMN "priority" TEXT NOT NULL DEFAULT 'normal' CHECK ("priority" IN ('low','normal','high','urgent'));
ALTER TABLE "Task" ADD COLUMN "dueAt" DATETIME;
ALTER TABLE "Task" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'manual' CHECK ("source" IN ('manual','whatsapp','email','webhook','automation'));
ALTER TABLE "Task" ADD COLUMN "requiresHumanAttention" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Task" ADD COLUMN "escalationReason" TEXT;

CREATE TABLE "ActivityEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "type" TEXT NOT NULL CHECK ("type" IN ('task.created','status.changed','task.updated','task.deleted','human.escalation_requested','human.escalation_resolved')),
    "actorType" TEXT NOT NULL CHECK ("actorType" IN ('human','system','integration')),
    "actorId" TEXT NOT NULL,
    "payload" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityEvent_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "ActivityEvent_taskId_createdAt_id_idx" ON "ActivityEvent"("taskId", "createdAt", "id");
CREATE INDEX "ActivityEvent_type_createdAt_idx" ON "ActivityEvent"("type", "createdAt");

CREATE TRIGGER "ActivityEvent_prevent_update"
BEFORE UPDATE ON "ActivityEvent"
BEGIN
  SELECT RAISE(ABORT, 'Activity events are immutable');
END;

CREATE TRIGGER "ActivityEvent_prevent_delete"
BEFORE DELETE ON "ActivityEvent"
BEGIN
  SELECT RAISE(ABORT, 'Activity events are immutable');
END;
