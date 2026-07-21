-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "preview" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "CourseBundle" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "description" TEXT,
    "heroImage" TEXT,
    "pricePence" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseBundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseBundleItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CourseBundleItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseBundle_tenantId_idx" ON "CourseBundle"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseBundle_tenantId_slug_key" ON "CourseBundle"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "CourseBundleItem_bundleId_order_idx" ON "CourseBundleItem"("bundleId", "order");

-- CreateIndex
CREATE INDEX "CourseBundleItem_tenantId_idx" ON "CourseBundleItem"("tenantId");

-- AddForeignKey
ALTER TABLE "CourseBundleItem" ADD CONSTRAINT "CourseBundleItem_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "CourseBundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseBundleItem" ADD CONSTRAINT "CourseBundleItem_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

