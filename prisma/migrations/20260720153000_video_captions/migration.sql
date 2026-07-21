-- BLD-904: WebVTT caption support for academy videos — additive columns only.
ALTER TABLE "Lesson" ADD COLUMN IF NOT EXISTS "captionsUrl" TEXT;
ALTER TABLE "DemoVideo" ADD COLUMN IF NOT EXISTS "captionsUrl" TEXT;
