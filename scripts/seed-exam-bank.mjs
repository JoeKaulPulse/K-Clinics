// Bootstrap the exam practice bank from each course's existing module quizzes,
// and seed a specimen past paper per course. Idempotent and progress-safe: a
// course's bank is only bootstrapped while it is empty, so re-runs never
// duplicate. Runs after seed-lms (which creates the quizzes it copies from).
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

function pickDirectUrl() {
  return [process.env.POSTGRES_URL_NON_POOLING, process.env.DATABASE_URL_UNPOOLED, process.env.POSTGRES_PRISMA_URL, process.env.DATABASE_URL, process.env.POSTGRES_URL]
    .filter(Boolean).find((u) => /^postgres(ql)?:\/\//.test(u)) || null;
}

async function main() {
  if (process.env.GHPAGES === 'true' || !pickDirectUrl()) { console.log('[seed-exam-bank] skipped (no DB).'); return; }

  const courses = await db.course.findMany({ select: { id: true, title: true, accreditations: true } });
  let q = 0, p = 0;
  for (const c of courses) {
    const board = Array.isArray(c.accreditations) && c.accreditations.length ? c.accreditations[0] : null;

    // Bootstrap the question bank from this course's quizzes (only while empty).
    if ((await db.examQuestion.count({ where: { courseId: c.id } })) === 0) {
      const modules = await db.courseModule.findMany({
        where: { courseId: c.id },
        select: { title: true, quiz: { select: { questions: { select: { prompt: true, type: true, options: true, correct: true, explanation: true, tip: true } } } } },
      });
      for (const m of modules) {
        for (const qq of m.quiz?.questions ?? []) {
          await db.examQuestion.create({
            data: { courseId: c.id, topic: m.title, difficulty: 'STANDARD', examBoard: board, prompt: qq.prompt, type: qq.type, options: qq.options ?? [], correct: qq.correct ?? [], explanation: qq.explanation ?? null, tip: qq.tip ?? null },
          });
          q++;
        }
      }
    }

    // Seed a specimen paper so the practice page is never empty (no file link —
    // staff attach the real paper in the CRM).
    if ((await db.pastPaper.count({ where: { courseId: c.id } })) === 0) {
      await db.pastPaper.create({
        data: {
          courseId: c.id, title: `${c.title} — specimen exam paper`, examBoard: board, order: 0,
          description: 'A specimen paper showing the style, length and command words to expect. Use it to practise timing and exam technique. Your tutor will attach the official paper link here.',
        },
      });
      p++;
    }
  }
  console.log(`[seed-exam-bank] seeded ${q} bank question(s) and ${p} specimen paper(s).`);
}

main().catch((e) => console.error('[seed-exam-bank] failed (non-fatal):', e?.message || e)).finally(() => db.$disconnect());
