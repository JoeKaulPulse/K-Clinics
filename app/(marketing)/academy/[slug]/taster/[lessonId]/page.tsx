import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Markdown } from '@/components/academy/Markdown';
import { LessonMedia, Downloads } from '@/components/academy/LessonMedia';
import { pageMeta } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string; lessonId: string }> }): Promise<Metadata> {
  const { slug, lessonId } = await params;
  const { getTasterLesson } = await import('@/lib/lms');
  const t = await getTasterLesson(slug, lessonId).catch(() => null);
  return pageMeta({ title: t ? `${t.lesson.title} — free taster | K Academy` : 'Free taster — K Academy', description: t ? `A free taster lesson from ${t.courseTitle}.` : 'A free taster lesson from K Academy.', path: `/academy/${slug}/taster/${lessonId}` });
}

// BLD-532: public, pre-enrolment taster — renders a lesson flagged "preview".
export default async function TasterLessonPage({ params }: { params: Promise<{ slug: string; lessonId: string }> }) {
  const { slug, lessonId } = await params;
  const { getTasterLesson } = await import('@/lib/lms');
  const data = await getTasterLesson(slug, lessonId);
  if (!data) notFound();
  const { courseTitle, courseSlug, lesson } = data;

  return (
    <section className="container-lux py-[calc(var(--header-h,5.25rem)+2rem)]">
      <div className="mx-auto max-w-3xl">
        <Link href={`/academy/${courseSlug}`} className="text-sm text-[var(--color-stone)] hover:text-[var(--color-ink)]">← {courseTitle}</Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-[var(--color-gold)]/15 px-3 py-1 text-xs font-medium uppercase tracking-wide text-[var(--color-gold-deep)]">Free taster</span>
          {lesson.durationMin ? <span className="text-xs text-[var(--color-stone)]">{lesson.durationMin} min</span> : null}
        </div>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl md:text-4xl">{lesson.title}</h1>

        <LessonMedia lesson={lesson} />
        {lesson.imageUrl && !lesson.videoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={lesson.imageUrl} alt={lesson.title} className="mt-6 w-full rounded-[var(--radius-lg)] border border-[var(--color-line)]" />
        )}
        <div className="prose-lux mt-2"><Markdown text={lesson.body} /></div>

        {lesson.keyPoints.length > 0 && (
          <div className="mt-7 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bone)] p-5">
            <p className="eyebrow mb-3">Key points</p>
            <ul className="space-y-2">{lesson.keyPoints.map((p, i) => <li key={i} className="flex gap-2.5 text-sm text-[var(--color-ink-soft)]"><span className="mt-1 text-[var(--color-gold)]">✦</span>{p}</li>)}</ul>
          </div>
        )}
        <Downloads items={lesson.attachments} />

        {/* Convert: apply for the full course */}
        <div className="mt-10 flex flex-col items-center gap-3 rounded-[var(--radius-xl)] border border-[var(--color-gold)] bg-[var(--color-porcelain)] p-8 text-center">
          <p className="font-[family-name:var(--font-display)] text-2xl">Liked this?</p>
          <p className="max-w-md text-sm text-[var(--color-stone)]">This is one free taster from <strong>{courseTitle}</strong>. Enrol to unlock the full course — theory, assessments, practical days and your certificate.</p>
          <Link href={`/academy/${courseSlug}`} className="mt-1 rounded-full bg-[var(--color-ink)] px-7 py-3 text-sm font-medium text-[var(--color-porcelain)] hover:bg-[var(--color-espresso)]">View the course &amp; apply →</Link>
        </div>
      </div>
    </section>
  );
}
