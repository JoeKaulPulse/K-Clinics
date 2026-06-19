-- CreateEnum
CREATE TYPE "TeamChannelKind" AS ENUM ('DM', 'GROUP');

-- CreateEnum
CREATE TYPE "TeamMemberRole" AS ENUM ('OWNER', 'MEMBER');

-- CreateEnum
CREATE TYPE "TaskAutomationTrigger" AS ENUM ('SCHEDULE', 'ON_TASK_COMPLETED');

-- CreateTable
CREATE TABLE "TeamChannel" (
    "id" TEXT NOT NULL,
    "kind" "TeamChannelKind" NOT NULL DEFAULT 'DM',
    "dmKey" TEXT,
    "name" TEXT,
    "topic" TEXT,
    "avatarUrl" TEXT,
    "createdById" TEXT,
    "archivedAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamChannelMember" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "TeamMemberRole" NOT NULL DEFAULT 'MEMBER',
    "lastReadAt" TIMESTAMP(3),
    "muted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamChannelMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMessage" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "authorId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'TEXT',
    "body" TEXT NOT NULL,
    "mentionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mentionsAll" BOOLEAN NOT NULL DEFAULT false,
    "replyToId" TEXT,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMessageAttachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT,
    "mime" TEXT,
    "size" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMessageAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMessageReaction" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMessageReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskComment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "authorId" TEXT,
    "authorEmail" TEXT,
    "body" TEXT NOT NULL,
    "mentionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskAutomation" (
    "id" TEXT NOT NULL,
    "seq" SERIAL NOT NULL,
    "ref" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "trigger" "TaskAutomationTrigger" NOT NULL DEFAULT 'SCHEDULE',
    "freq" TEXT NOT NULL DEFAULT 'WEEKLY',
    "interval" INTEGER NOT NULL DEFAULT 1,
    "daysOfWeek" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "dayOfMonth" INTEGER,
    "timeOfDay" TEXT NOT NULL DEFAULT '09:00',
    "startsOn" TIMESTAMP(3),
    "endsOn" TIMESTAMP(3),
    "matchText" TEXT,
    "titleTemplate" TEXT NOT NULL,
    "detailTemplate" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "dueInDays" INTEGER,
    "assignMode" TEXT NOT NULL DEFAULT 'FIXED',
    "assigneeIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "roundRobinIdx" INTEGER NOT NULL DEFAULT 0,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskAutomation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskAutomationRun" (
    "id" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "occurrenceKey" TEXT NOT NULL,
    "createdTaskIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskAutomationRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamChannel_dmKey_key" ON "TeamChannel"("dmKey");

-- CreateIndex
CREATE INDEX "TeamChannel_kind_idx" ON "TeamChannel"("kind");

-- CreateIndex
CREATE INDEX "TeamChannel_lastMessageAt_idx" ON "TeamChannel"("lastMessageAt");

-- CreateIndex
CREATE INDEX "TeamChannelMember_userId_idx" ON "TeamChannelMember"("userId");

-- CreateIndex
CREATE INDEX "TeamChannelMember_channelId_idx" ON "TeamChannelMember"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamChannelMember_channelId_userId_key" ON "TeamChannelMember"("channelId", "userId");

-- CreateIndex
CREATE INDEX "TeamMessage_channelId_createdAt_idx" ON "TeamMessage"("channelId", "createdAt");

-- CreateIndex
CREATE INDEX "TeamMessage_authorId_idx" ON "TeamMessage"("authorId");

-- CreateIndex
CREATE INDEX "TeamMessageAttachment_messageId_idx" ON "TeamMessageAttachment"("messageId");

-- CreateIndex
CREATE INDEX "TeamMessageReaction_messageId_idx" ON "TeamMessageReaction"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMessageReaction_messageId_userId_emoji_key" ON "TeamMessageReaction"("messageId", "userId", "emoji");

-- CreateIndex
CREATE INDEX "TaskComment_taskId_createdAt_idx" ON "TaskComment"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "TaskAutomation_enabled_trigger_idx" ON "TaskAutomation"("enabled", "trigger");

-- CreateIndex
CREATE INDEX "TaskAutomation_nextRunAt_idx" ON "TaskAutomation"("nextRunAt");

-- CreateIndex
CREATE INDEX "TaskAutomationRun_automationId_createdAt_idx" ON "TaskAutomationRun"("automationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TaskAutomationRun_automationId_occurrenceKey_key" ON "TaskAutomationRun"("automationId", "occurrenceKey");

-- AddForeignKey
ALTER TABLE "TeamChannelMember" ADD CONSTRAINT "TeamChannelMember_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "TeamChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamChannelMember" ADD CONSTRAINT "TeamChannelMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMessage" ADD CONSTRAINT "TeamMessage_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "TeamChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMessage" ADD CONSTRAINT "TeamMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMessageAttachment" ADD CONSTRAINT "TeamMessageAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "TeamMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMessageReaction" ADD CONSTRAINT "TeamMessageReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "TeamMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAutomationRun" ADD CONSTRAINT "TaskAutomationRun_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "TaskAutomation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
