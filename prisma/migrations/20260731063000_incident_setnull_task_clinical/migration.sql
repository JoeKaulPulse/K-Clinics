-- BLD-1121: Incident.client was ON DELETE CASCADE, so a hard client-delete
-- wiped RIDDOR/H&S incident records outright despite their Art. 17(3)(b)
-- legal-retention basis. Now ON DELETE SET NULL; deleteClient() redacts the
-- encrypted narrative before the client row goes, so the anonymised safety
-- fact survives with the client link nulled instead of being deleted.
ALTER TABLE "Incident" DROP CONSTRAINT "Incident_clientId_fkey";
ALTER TABLE "Incident" ALTER COLUMN "clientId" DROP NOT NULL;
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- PRJ-1060.10: flags a Task whose `detail` embeds a client's post-treatment
-- health concern (lib/followup.ts) -- detail is then clinical-crypto
-- encrypted and the task is hidden from the board for staff without
-- clients.clinical.view. Additive, defaulted only.
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "clinical" BOOLEAN NOT NULL DEFAULT false;
