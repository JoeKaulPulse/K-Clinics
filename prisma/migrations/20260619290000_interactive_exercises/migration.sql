-- CreateTable
CREATE TABLE "InteractiveExercise" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "instructions" TEXT,
    "imageUrl" TEXT,
    "config" JSONB NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InteractiveExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseAttempt" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "scorePct" INTEGER NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExerciseAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InteractiveExercise_courseId_order_idx" ON "InteractiveExercise"("courseId", "order");

-- CreateIndex
CREATE INDEX "InteractiveExercise_tenantId_idx" ON "InteractiveExercise"("tenantId");

-- CreateIndex
CREATE INDEX "ExerciseAttempt_tenantId_idx" ON "ExerciseAttempt"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseAttempt_studentId_exerciseId_key" ON "ExerciseAttempt"("studentId", "exerciseId");

-- AddForeignKey
ALTER TABLE "InteractiveExercise" ADD CONSTRAINT "InteractiveExercise_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseAttempt" ADD CONSTRAINT "ExerciseAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "AcademyStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseAttempt" ADD CONSTRAINT "ExerciseAttempt_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "InteractiveExercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

