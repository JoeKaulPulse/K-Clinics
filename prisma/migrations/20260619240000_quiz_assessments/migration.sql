-- AlterTable
ALTER TABLE "Quiz" ADD COLUMN     "isSurvey" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maxAttempts" INTEGER,
ADD COLUMN     "poolSize" INTEGER,
ADD COLUMN     "shuffleOptions" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "shuffleQuestions" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "timeLimitMin" INTEGER;

-- AlterTable
ALTER TABLE "QuizQuestion" ADD COLUMN     "acceptedAnswers" TEXT[] DEFAULT ARRAY[]::TEXT[];

