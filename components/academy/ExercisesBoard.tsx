'use client';

import { useState } from 'react';
import { Card, Pill, SectionTitle, EmptyState } from '@/components/academy/ui';
import { ExercisePlayer, type ExercisePlay } from '@/components/academy/ExercisePlayer';

// BLD-535: trainee interactive-exercises board — grouped by course, expand to play.
export type ExerciseGroup = { courseId: string; courseTitle: string; exercises: ExercisePlay[] };

const TYPE_LABEL: Record<string, string> = { HOTSPOT: 'Image hotspots', MATCH: 'Match pairs', ORDER: 'Order the steps', LABEL: 'Label the diagram', TYPEIN: 'Name on image' };

export function ExercisesBoard({ groups }: { groups: ExerciseGroup[] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (groups.length === 0) {
    return <EmptyState title="No exercises yet">Your tutors haven’t added interactive exercises to your courses yet. When they do, you’ll be able to practise hotspots, matching and ordering here.</EmptyState>;
  }
  return (
    <div className="space-y-8">
      {groups.map((g) => (
        <div key={g.courseId}>
          <SectionTitle>{g.courseTitle}</SectionTitle>
          <ul className="space-y-2.5">
            {g.exercises.map((ex) => (
              <li key={ex.id}>
                {open === ex.id ? (
                  <ExercisePlayer exercise={ex} />
                ) : (
                  <button onClick={() => setOpen(ex.id)} className="block w-full text-left">
                    <Card tone="white" className="transition-colors hover:border-[var(--color-gold)]">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <h3 className="font-[family-name:var(--font-display)] text-lg leading-snug">{ex.title}</h3>
                          <p className="mt-0.5 text-xs text-[var(--color-stone)]">{TYPE_LABEL[ex.type] ?? ex.type} · {ex.count} item{ex.count === 1 ? '' : 's'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {ex.best != null && <Pill tone={ex.best === 100 ? 'good' : 'neutral'}>Best {ex.best}%</Pill>}
                          <span className="text-sm text-[var(--color-gold-deep)]">Start →</span>
                        </div>
                      </div>
                    </Card>
                  </button>
                )}
                {open === ex.id && <button onClick={() => setOpen(null)} className="mt-1.5 text-xs text-[var(--color-stone)] hover:text-[var(--color-ink)]">↑ Close</button>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
