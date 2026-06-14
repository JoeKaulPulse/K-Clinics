import 'server-only';
import { db } from '@/lib/db';

// Content-growth engine. New modules/lessons/quizzes and exam-bank questions are
// declared here and applied to the live courses idempotently (create-only, matched
// by title/prompt) — so the catalogue grows toward the full course over successive
// passes without ever overwriting existing content or trainee progress. Extend the
// arrays below and the daily cron picks the additions up.

type Step = Record<string, unknown>;
type LessonDef = { title: string; durationMin?: number; objectives?: string[]; studyTips?: string[]; examRefs?: string[]; steps: Step[] };
type QuizDef = { title?: string; passMark?: number; questions: { prompt: string; type?: string; options: string[]; correct: number[]; explanation?: string; tip?: string }[] };
type ModuleDef = { title: string; summary?: string; lessons: LessonDef[]; quiz?: QuizDef };
type CourseContentDef = { courseSlug: string; modules: ModuleDef[] };
type ExamQDef = { courseSlug: string; topic?: string; difficulty?: string; examBoard?: string; prompt: string; type?: string; options: string[]; correct: number[]; explanation?: string; tip?: string };

const L2 = 'level-2-foundation-skin-laser';

export const NEW_MODULES: CourseContentDef[] = [
  {
    courseSlug: L2,
    modules: [
      {
        title: 'Consultation, Patch Testing & Aftercare',
        summary: 'Assess suitability, gain informed consent, patch test safely, and manage aftercare and complications.',
        lessons: [
          {
            title: 'The Consultation & Informed Consent',
            durationMin: 12,
            objectives: ['Run a thorough client consultation', 'Take a relevant medical history', 'Gain valid informed consent'],
            studyTips: ['Examiners want “informed” consent — the client understands risks AND aftercare, not just signs a form.'],
            examRefs: ['Consultation & consent'],
            steps: [
              { kind: 'say', text: 'Every client starts here — the consultation. Let’s walk it through.', mood: 'happy' },
              { kind: 'teach', title: 'Why we consult', text: 'It’s where you assess suitability, set expectations and gain informed consent before anything else happens.' },
              { kind: 'teach', title: 'Medical history', text: 'Take a full history: medications, medical conditions, recent sun exposure, and any previous reactions.' },
              { kind: 'ask', prompt: 'What must you obtain before any treatment?', qtype: 'SINGLE', options: ['Informed consent', 'A deposit', 'A selfie', 'A review'], correct: [0], explanation: 'Informed consent — the client understands and agrees to the treatment, its risks and the aftercare.' },
              { kind: 'say', text: 'Spot on.', mood: 'cheer' },
              { kind: 'teach', title: 'Patch test', text: 'For laser or IPL, a patch test before the first full treatment checks how that client’s skin reacts.' },
              { kind: 'ask', prompt: 'A patch test is done ___ hours before the first treatment.', qtype: 'WORD', options: ['24–48', '1', '168'], correct: [0], explanation: '24–48 hours gives time for any delayed reaction to show.' },
              { kind: 'teach', title: 'Expectations', text: 'Be realistic: most laser courses need several sessions spaced weeks apart — explain this up front.' },
              { kind: 'ask', prompt: 'Laser hair removal usually needs…', qtype: 'SINGLE', options: ['One session', 'Multiple sessions', 'No sessions'], correct: [1], explanation: 'Hair grows in cycles, so several sessions catch follicles in the active (anagen) phase.', tip: 'Think about the hair growth cycle.' },
              { kind: 'say', text: 'That’s the consultation nailed.', mood: 'cheer' },
            ],
          },
          {
            title: 'Aftercare & Recognising Complications',
            durationMin: 12,
            objectives: ['Give correct aftercare advice', 'Tell normal reactions from warning signs', 'Keep proper records'],
            studyTips: ['“Refer if in doubt” is always a safe exam answer for a worrying reaction.'],
            examRefs: ['Aftercare & complications'],
            steps: [
              { kind: 'say', text: 'Treatment’s done — now the aftercare, which is just as important.', mood: 'happy' },
              { kind: 'teach', title: 'Aftercare', text: 'Advise cooling, daily SPF, and avoiding heat (saunas, hot showers) and sun for 24–48 hours.' },
              { kind: 'ask', prompt: 'Which is essential aftercare advice?', qtype: 'SINGLE', options: ['Daily SPF', 'A hot sauna', 'Sunbathing', 'Scrubbing the area'], correct: [0], explanation: 'Treated skin is sun-sensitive — daily SPF protects it.' },
              { kind: 'teach', title: 'Normal vs not', text: 'Mild redness and warmth are normal and settle quickly. Blistering, lasting pain or signs of infection are not.' },
              { kind: 'ask', prompt: 'Which signs mean you should refer or escalate?', qtype: 'MULTI', options: ['Blistering', 'Brief mild redness', 'Spreading infection', 'Prolonged severe pain'], correct: [0, 2, 3], explanation: 'Blistering, infection and severe lasting pain need review; brief mild redness is expected.' },
              { kind: 'say', text: 'Exactly — when in doubt, refer.', mood: 'cheer' },
              { kind: 'teach', title: 'Records', text: 'Record everything: settings used, the client’s reaction, and the advice given. Good records protect the client and you.' },
              { kind: 'teach', title: 'If a patch test reacts', text: 'If a patch test reacts badly, do not proceed — adjust or decline, and note it on the record.' },
              { kind: 'say', text: 'Brilliant — you can keep a client safe before, during and after.', mood: 'cheer' },
            ],
          },
        ],
        quiz: {
          title: 'Consultation & Aftercare Assessment',
          passMark: 70,
          questions: [
            { prompt: 'Informed consent means the client has…', type: 'SINGLE', options: ['Understood and agreed to the treatment, risks and aftercare', 'Paid a deposit', 'Left a review', 'Booked online'], correct: [0], explanation: 'It’s about understanding and agreement, not payment.' },
            { prompt: 'How long before the first laser treatment should a patch test be done?', type: 'SINGLE', options: ['Immediately before', '24–48 hours before', 'A month before', 'It isn’t needed'], correct: [1], explanation: '24–48 hours allows any delayed reaction to appear.' },
            { prompt: 'Daily SPF is important aftercare because treated skin is…', type: 'WORD', options: ['sun-sensitive', 'waterproof', 'thicker'], correct: [0], explanation: 'Treatment makes skin more sensitive to UV.' },
            { prompt: 'Which are red-flag reactions needing referral?', type: 'MULTI', options: ['Blistering', 'Brief mild redness', 'Signs of infection', 'Severe prolonged pain'], correct: [0, 2, 3], explanation: 'Brief mild redness is normal; the others are not.' },
            { prompt: 'Laser hair removal needs multiple sessions because hair grows in…', type: 'SINGLE', options: ['Cycles', 'Straight lines', 'One go', 'Winter only'], correct: [0], explanation: 'Only follicles in the active anagen phase respond, so repeat sessions are needed.' },
            { prompt: 'Good treatment records should include the settings used, the reaction, and the advice given.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'Thorough records protect both client and practitioner.' },
          ],
        },
      },
    ],
  },
];

export const NEW_EXAM_QUESTIONS: ExamQDef[] = [
  { courseSlug: L2, topic: 'Consultation', prompt: 'The main purpose of a patch test is to…', options: ['Check skin reaction before a full treatment', 'Speed up results', 'Replace consent', 'Warm the skin'], correct: [0], explanation: 'It flags adverse reactions before committing to a full treatment.' },
  { courseSlug: L2, topic: 'Aftercare', prompt: 'For 24–48 hours after laser, clients should avoid…', type: 'MULTI', options: ['Saunas and hot showers', 'Direct sun', 'Daily SPF', 'Heat near the area'], correct: [0, 1, 3], explanation: 'Heat and sun are out; SPF is encouraged.' },
  { courseSlug: L2, topic: 'Skin', prompt: 'The acid mantle keeps skin slightly…', type: 'WORD', options: ['acidic', 'alkaline', 'oily'], correct: [0], explanation: 'pH ~4.5–5.5 inhibits microbes.' },
  { courseSlug: L2, topic: 'Hair', prompt: 'Laser targets follicles best during which phase?', options: ['Anagen', 'Catagen', 'Telogen', 'Any phase'], correct: [0], explanation: 'Anagen (active growth) — the follicle is pigmented and connected.' },
  { courseSlug: 'level-3-laser-aesthetic-therapies', topic: 'Physics', prompt: 'Selective photothermolysis depends on matching the wavelength to a…', options: ['Chromophore', 'Cooling gel', 'Room temperature', 'Brand'], correct: [0], explanation: 'Energy is absorbed by a target chromophore (melanin, haemoglobin, water).' },
  { courseSlug: 'level-3-laser-aesthetic-therapies', topic: 'Safety', prompt: 'During laser use, correct eyewear must be worn by…', type: 'MULTI', options: ['The practitioner', 'The client', 'Anyone in the room', 'Nobody'], correct: [0, 1, 2], explanation: 'Everyone present needs wavelength-specific protection.' },
  { courseSlug: 'level-4-certificate-aesthetic-practice', topic: 'Ethics', prompt: 'Suspecting Body Dysmorphic Disorder, the right step is to…', options: ['Decline and signpost to support', 'Offer a discount', 'Treat immediately', 'Ignore it'], correct: [0], explanation: 'Cosmetic treatment doesn’t resolve BDD; refer appropriately.' },
  { courseSlug: 'level-4-certificate-aesthetic-practice', topic: 'Governance', prompt: 'Health data under UK GDPR is classed as…', type: 'WORD', options: ['special category', 'public', 'optional'], correct: [0], explanation: 'It needs extra protection as special category data.' },
  { courseSlug: 'advanced-aesthetics-level-5-7', topic: 'Complications', prompt: 'First action if an unexpected, excessive reaction occurs mid-procedure?', options: ['Stop the procedure', 'Increase the energy', 'Carry on', 'Leave the room'], correct: [0], explanation: 'Stop immediately, assess, and manage/escalate.' },
  { courseSlug: 'advanced-aesthetics-level-5-7', topic: 'Scope', prompt: 'Working “within scope of practice” means…', options: ['Only doing what you’re trained, insured and competent for', 'Doing whatever a client asks', 'Copying a colleague', 'Avoiding records'], correct: [0], explanation: 'Scope is defined by training, insurance and competence.' },
];

function bodyFromSteps(steps: Step[]): string {
  return steps.filter((s) => s.kind === 'teach' && typeof s.text === 'string' && s.text).map((s) => String(s.text)).join('\n\n');
}

/** Create any declared modules/lessons/quizzes/questions that don't yet exist
 *  (matched by title/prompt). Idempotent; safe to run from the daily cron. */
export async function enrichCourseContentIfNeeded(): Promise<{ modules: number; lessons: number; questions: number }> {
  let modules = 0, lessons = 0, questions = 0;

  for (const cc of NEW_MODULES) {
    const course = await db.course.findUnique({ where: { slug: cc.courseSlug }, select: { id: true } }).catch(() => null);
    if (!course) continue;
    for (const m of cc.modules) {
      let mod = await db.courseModule.findFirst({ where: { courseId: course.id, title: m.title }, select: { id: true } });
      if (!mod) {
        const order = await db.courseModule.count({ where: { courseId: course.id } });
        mod = await db.courseModule.create({ data: { courseId: course.id, title: m.title, summary: m.summary ?? null, order }, select: { id: true } });
        modules++;
      }
      for (let li = 0; li < m.lessons.length; li++) {
        const l = m.lessons[li];
        const exists = await db.lesson.findFirst({ where: { moduleId: mod.id, title: l.title }, select: { id: true } });
        if (exists) continue;
        await db.lesson.create({ data: { moduleId: mod.id, title: l.title, order: li, durationMin: l.durationMin ?? null, body: bodyFromSteps(l.steps), objectives: l.objectives ?? [], studyTips: l.studyTips ?? [], examRefs: l.examRefs ?? [], steps: l.steps as object } });
        lessons++;
      }
      if (m.quiz && m.quiz.questions.length) {
        let quiz = await db.quiz.findUnique({ where: { moduleId: mod.id }, select: { id: true } });
        if (!quiz) quiz = await db.quiz.create({ data: { moduleId: mod.id, title: m.quiz.title ?? `${m.title} assessment`, passMark: m.quiz.passMark ?? 70 }, select: { id: true } });
        const existing = new Set((await db.quizQuestion.findMany({ where: { quizId: quiz.id }, select: { prompt: true } })).map((q) => q.prompt));
        let order = existing.size;
        for (const q of m.quiz.questions) {
          if (existing.has(q.prompt)) continue;
          await db.quizQuestion.create({ data: { quizId: quiz.id, order: order++, prompt: q.prompt, type: q.type ?? 'SINGLE', options: q.options as object, correct: q.correct as object, explanation: q.explanation ?? null, tip: q.tip ?? null } });
          questions++;
        }
      }
    }
  }

  for (const slug of [...new Set(NEW_EXAM_QUESTIONS.map((q) => q.courseSlug))]) {
    const course = await db.course.findUnique({ where: { slug }, select: { id: true, accreditations: true } }).catch(() => null);
    if (!course) continue;
    const board = Array.isArray(course.accreditations) && course.accreditations.length ? course.accreditations[0] : null;
    const existing = new Set((await db.examQuestion.findMany({ where: { courseId: course.id }, select: { prompt: true } })).map((q) => q.prompt));
    for (const q of NEW_EXAM_QUESTIONS.filter((x) => x.courseSlug === slug)) {
      if (existing.has(q.prompt)) continue;
      await db.examQuestion.create({ data: { courseId: course.id, topic: q.topic ?? null, difficulty: q.difficulty ?? 'STANDARD', examBoard: q.examBoard ?? board, prompt: q.prompt, type: q.type ?? 'SINGLE', options: q.options as object, correct: q.correct as object, explanation: q.explanation ?? null, tip: q.tip ?? null } });
      existing.add(q.prompt); questions++;
    }
  }

  return { modules, lessons, questions };
}
