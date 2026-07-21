'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CoursePlayer } from '@/components/academy/CoursePlayer';
import { ImmersiveCourse } from '@/components/academy/ImmersiveCourse';
import { CourseReviewPrompt } from '@/components/academy/CourseReviewPrompt';
import { Card, AButton, Eyebrow } from '@/components/academy/ui';
import type { Register } from '@/components/academy/lessonFlow';
import type { CourseLearning, ReviewView } from '@/lib/lms';

/** Trainee course page. Two views of the SAME content, made explicit so it isn't
 *  confusing: "Guided study" is the full-screen, step-by-step mode; the course
 *  outline below lets you jump to any lesson or quiz. On exit from guided study we
 *  refresh so the outline reflects anything just completed. */
export function CourseExperience({ learning, slug, xp = 0, register = 'mid', myReview = null }: { learning: CourseLearning; slug: string; xp?: number; register?: Register; myReview?: ReviewView }) {
  const router = useRouter();
  const [immersive, setImmersive] = useState(false);
  const started = learning.progressPct > 0;
  return (
    <>
      <Card accent tone="porcelain" className="mb-7 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="min-w-0">
          <Eyebrow>Guided study</Eyebrow>
          <p className="mt-1 font-[family-name:var(--font-display)] text-lg">{started ? `You’re ${learning.progressPct}% through` : 'Ready to begin?'}</p>
          <p className="mt-0.5 text-sm text-[var(--color-stone)]">Full-screen, one step at a time — we keep your place. Or jump to any lesson in the outline below.</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          {started && <CourseReviewPrompt courseId={learning.course.id} courseTitle={learning.course.title} myReview={myReview} />}
          <AButton variant="ink" onClick={() => setImmersive(true)} className="px-7 py-3">▶ {started ? 'Resume guided study' : 'Start guided study'}</AButton>
        </div>
      </Card>

      <div className="mb-3 flex flex-wrap items-baseline gap-x-3">
        <Eyebrow>Course outline</Eyebrow>
        <span className="text-xs text-[var(--color-stone)]">Jump to any lesson or quiz, take notes and ask questions.</span>
      </div>
      <CoursePlayer learning={learning} slug={slug} />

      {immersive && <ImmersiveCourse learning={learning} slug={slug} xp={xp} register={register} mode="learn" onExit={() => { setImmersive(false); router.refresh(); }} />}
    </>
  );
}
