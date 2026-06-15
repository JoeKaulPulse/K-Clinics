'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CoursePlayer } from '@/components/academy/CoursePlayer';
import { ImmersiveCourse } from '@/components/academy/ImmersiveCourse';
import type { Register } from '@/components/academy/lessonFlow';
import type { CourseLearning } from '@/lib/lms';

/** Trainee course page: an outline (CoursePlayer) plus a prominent launch into
 *  the full-screen, step-by-step immersive experience. On exit we refresh so the
 *  outline reflects any lessons/quizzes just completed. */
export function CourseExperience({ learning, slug, xp = 0, register = 'mid' }: { learning: CourseLearning; slug: string; xp?: number; register?: Register }) {
  const router = useRouter();
  const [immersive, setImmersive] = useState(false);
  const started = learning.progressPct > 0;
  return (
    <>
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-5 sm:p-6">
        <div>
          <p className="font-[family-name:var(--font-display)] text-lg">{started ? `Resume — you’re ${learning.progressPct}% through` : 'Ready to begin?'}</p>
          <p className="mt-0.5 text-sm text-[var(--color-stone)]">Full-screen, one step at a time. We’ll keep your place and track your progress.</p>
        </div>
        <button onClick={() => setImmersive(true)} className="shrink-0 rounded-full bg-[var(--color-ink)] px-7 py-3 text-sm font-medium text-[var(--color-porcelain)] transition-colors hover:bg-[var(--color-espresso)]">
          ▶ {started ? 'Resume course' : 'Start course'}
        </button>
      </div>

      <CoursePlayer learning={learning} slug={slug} />

      {immersive && <ImmersiveCourse learning={learning} slug={slug} xp={xp} register={register} mode="learn" onExit={() => { setImmersive(false); router.refresh(); }} />}
    </>
  );
}
