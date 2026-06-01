// Seed the native LMS content (modules → lessons + quizzes) for each course,
// plus a couple of example live (Google Meet) classes. Idempotent and
// progress-safe: a course is only seeded if it has no modules yet, so re-runs
// on deploy never wipe trainee progress.
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

function pickDirectUrl() {
  return [process.env.POSTGRES_URL_NON_POOLING, process.env.DATABASE_URL_UNPOOLED, process.env.POSTGRES_PRISMA_URL, process.env.DATABASE_URL, process.env.POSTGRES_URL]
    .filter(Boolean).find((u) => /^postgres(ql)?:\/\//.test(u)) || null;
}

const videoUrlFor = (q) => (q ? `https://www.youtube.com/results?search_query=${encodeURIComponent(q + ' aesthetics training')}` : null);

async function main() {
  if (process.env.GHPAGES === 'true' || !pickDirectUrl()) { console.log('[seed-lms] skipped (no DB).'); return; }

  let lmsCourses;
  try {
    ({ lmsCourses } = await import('./lms-content.mjs'));
  } catch (e) {
    console.log('[seed-lms] no content file yet — skipped.', e?.message || '');
    return;
  }
  if (!Array.isArray(lmsCourses)) { console.log('[seed-lms] content file malformed — skipped.'); return; }

  let created = 0;
  for (const cc of lmsCourses) {
    const course = await db.course.findUnique({ where: { slug: cc.courseSlug }, select: { id: true } });
    if (!course) { console.log(`[seed-lms] course not found: ${cc.courseSlug}`); continue; }
    if ((await db.courseModule.count({ where: { courseId: course.id } })) > 0) continue; // seed once

    for (let mi = 0; mi < (cc.modules ?? []).length; mi++) {
      const m = cc.modules[mi];
      const mod = await db.courseModule.create({ data: { courseId: course.id, title: m.title, summary: m.summary ?? null, order: mi } });

      for (let li = 0; li < (m.lessons ?? []).length; li++) {
        const l = m.lessons[li];
        await db.lesson.create({
          data: {
            moduleId: mod.id, title: l.title, order: li,
            durationMin: Number.isFinite(l.durationMin) ? l.durationMin : null,
            videoUrl: videoUrlFor(l.videoQuery),
            body: String(l.body ?? ''),
            keyPoints: Array.isArray(l.keyPoints) ? l.keyPoints : [],
            citations: Array.isArray(l.citations) ? l.citations : [],
            resources: Array.isArray(l.resources) ? l.resources : [],
          },
        });
      }

      if (m.quiz && Array.isArray(m.quiz.questions) && m.quiz.questions.length) {
        const quiz = await db.quiz.create({ data: { moduleId: mod.id, title: m.quiz.title ?? `Module ${mi + 1} assessment`, passMark: Number.isFinite(m.quiz.passMark) ? m.quiz.passMark : 70 } });
        for (let qi = 0; qi < m.quiz.questions.length; qi++) {
          const q = m.quiz.questions[qi];
          const type = ['SINGLE', 'MULTI', 'TRUEFALSE'].includes(q.type) ? q.type : 'SINGLE';
          await db.quizQuestion.create({
            data: {
              quizId: quiz.id, order: qi, prompt: String(q.prompt ?? ''), type,
              options: Array.isArray(q.options) ? q.options : [],
              correct: Array.isArray(q.correct) ? q.correct : [],
              explanation: q.explanation ?? null,
            },
          });
        }
      }
    }
    created++;

    // Example live (Google Meet) classes so the trainee calendar is populated.
    // joinUrl is left null — staff add the real Meet link in the CRM.
    if ((await db.liveClass.count({ where: { courseId: course.id } })) === 0) {
      for (const [days, title] of [[10, 'Live theory Q&A'], [24, 'Pre-assessment review']]) {
        const start = new Date(); start.setDate(start.getDate() + days); start.setHours(18, 0, 0, 0);
        const end = new Date(start); end.setHours(19, 30, 0, 0);
        await db.liveClass.create({ data: { courseId: course.id, title, startAt: start, endAt: end, trainer: 'K Academy', description: 'Online session — join link added nearer the time.' } });
      }
    }
  }
  console.log(`[seed-lms] seeded LMS content for ${created} course(s).`);
}

main().catch((e) => console.error('[seed-lms] failed (non-fatal):', e?.message || e)).finally(() => db.$disconnect());
