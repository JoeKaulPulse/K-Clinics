-- BLD-1573: adds the TREATMENT_PREP email kind used by the Laser Hair Removal
-- pre-treatment prep reminder (sent 48h before the appointment).
-- AlterEnum
ALTER TYPE "EmailKind" ADD VALUE 'TREATMENT_PREP';
