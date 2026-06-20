-- CreateTable
CREATE TABLE "DemoVideo" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "courseId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "videoUrl" TEXT NOT NULL,
    "durationSec" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemoVideo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemoMistake" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "atSec" DOUBLE PRECISION NOT NULL,
    "windowSec" DOUBLE PRECISION NOT NULL DEFAULT 3,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemoMistake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemoAttempt" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "spotted" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "falsePositives" INTEGER NOT NULL DEFAULT 0,
    "scorePct" INTEGER NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemoAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DemoVideo_courseId_order_idx" ON "DemoVideo"("courseId", "order");

-- CreateIndex
CREATE INDEX "DemoVideo_tenantId_idx" ON "DemoVideo"("tenantId");

-- CreateIndex
CREATE INDEX "DemoMistake_videoId_idx" ON "DemoMistake"("videoId");

-- CreateIndex
CREATE INDEX "DemoMistake_tenantId_idx" ON "DemoMistake"("tenantId");

-- CreateIndex
CREATE INDEX "DemoAttempt_tenantId_idx" ON "DemoAttempt"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "DemoAttempt_studentId_videoId_key" ON "DemoAttempt"("studentId", "videoId");

-- AddForeignKey
ALTER TABLE "DemoVideo" ADD CONSTRAINT "DemoVideo_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemoMistake" ADD CONSTRAINT "DemoMistake_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "DemoVideo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemoAttempt" ADD CONSTRAINT "DemoAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "AcademyStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemoAttempt" ADD CONSTRAINT "DemoAttempt_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "DemoVideo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

