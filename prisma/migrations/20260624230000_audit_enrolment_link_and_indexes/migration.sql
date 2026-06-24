-- BLD-626: Enrolment studentId indexes — full table scan on every portal load
CREATE INDEX "Enrolment_studentId_idx" ON "Enrolment"("studentId");
CREATE INDEX "Enrolment_studentId_status_idx" ON "Enrolment"("studentId", "status");

-- BLD-631: AuditEvent enrolmentId FK — financial audit trail for academy payments
ALTER TABLE "AuditEvent" ADD COLUMN "enrolmentId" TEXT;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_enrolmentId_fkey" FOREIGN KEY ("enrolmentId") REFERENCES "Enrolment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "AuditEvent_enrolmentId_createdAt_idx" ON "AuditEvent"("enrolmentId", "createdAt");
