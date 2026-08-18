-- CreateTable
CREATE TABLE "GbpPost" (
    "googleName" TEXT NOT NULL,
    "summary" TEXT,
    "topicType" TEXT,
    "state" TEXT,
    "mediaUrl" TEXT,
    "ctaUrl" TEXT,
    "ctaType" TEXT,
    "searchUrl" TEXT,
    "createTime" TIMESTAMP(3),
    "updateTime" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GbpPost_pkey" PRIMARY KEY ("googleName")
);

-- CreateIndex
CREATE INDEX "GbpPost_createTime_idx" ON "GbpPost"("createTime");

