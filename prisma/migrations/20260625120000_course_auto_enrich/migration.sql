-- BLD-641: Course.autoEnrich — once staff manually curate the curriculum
-- (delete a seeded module/lesson) this flips false so the daily authored-content
-- enrichment stops re-creating the modules they removed.
ALTER TABLE "Course" ADD COLUMN     "autoEnrich" BOOLEAN NOT NULL DEFAULT true;
