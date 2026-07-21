'use client';

import { useState } from 'react';
import { ImmersiveCourse } from '@/components/academy/ImmersiveCourse';
import type { CourseLearning } from '@/lib/lms';

/** Admin "Preview course" — opens the exact trainee immersive player against the
 *  course content, in preview mode: answer keys are graded client-side and nothing
 *  is recorded. Lets staff walk the course and confirm it works before trainees do. */
export function CoursePreviewButton({ preview }: { preview: CourseLearning | null }) {
  const [open, setOpen] = useState(false);
  if (!preview || preview.modules.length === 0) return null;
  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-full border border-[var(--color-line)] bg-white px-4 py-2 text-sm font-medium transition-colors hover:border-[var(--color-gold)] hover:text-[var(--color-gold-deep)]">
        ▶ Preview course
      </button>
      {open && <ImmersiveCourse learning={preview} mode="preview" onExit={() => setOpen(false)} />}
    </>
  );
}
