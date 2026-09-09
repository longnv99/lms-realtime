-- AlterTable
ALTER TABLE "Question" ADD COLUMN "explanation" TEXT;

-- CreateTable
CREATE TABLE "LessonNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "positionSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonTranscriptCue" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "startSeconds" INTEGER NOT NULL,
    "endSeconds" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonTranscriptCue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LessonNote_userId_lessonId_positionSeconds_idx" ON "LessonNote"("userId", "lessonId", "positionSeconds");

-- CreateIndex
CREATE INDEX "LessonNote_lessonId_idx" ON "LessonNote"("lessonId");

-- CreateIndex
CREATE INDEX "LessonTranscriptCue_lessonId_startSeconds_idx" ON "LessonTranscriptCue"("lessonId", "startSeconds");

-- CreateIndex
CREATE UNIQUE INDEX "LessonTranscriptCue_lessonId_order_key" ON "LessonTranscriptCue"("lessonId", "order");

-- AddForeignKey
ALTER TABLE "LessonNote" ADD CONSTRAINT "LessonNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonNote" ADD CONSTRAINT "LessonNote_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonTranscriptCue" ADD CONSTRAINT "LessonTranscriptCue_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
