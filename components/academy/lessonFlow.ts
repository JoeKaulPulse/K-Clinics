// Turns a lesson into a Duolingo-style sequence of bite-size micro-steps:
//  • teach — a short card (a sentence or two, optional title/illustration)
//  • say   — the K mascot speaks (encouragement, a segue, a tip)
//  • ask   — an inline multiple-choice check (graded client-side; formative)
//
// Authored flows live on Lesson.steps. When absent we auto-chunk the lesson body
// so EVERY lesson is bite-size immediately, without waiting on re-seeding.

export type TeachStep = { kind: 'teach'; title?: string; text: string; art?: string };
export type SayStep = { kind: 'say'; text: string; mood?: 'happy' | 'think' | 'cheer' };
export type AskStep = { kind: 'ask'; prompt: string; qtype?: 'SINGLE' | 'MULTI' | 'TRUEFALSE' | 'WORD'; options: string[]; correct?: number[]; explanation?: string; tip?: string; art?: string; quizId?: string; questionId?: string };
export type FlowStep = TeachStep | SayStep | AskStep;

export type FlowLesson = {
  title: string;
  body: string;
  objectives?: string[];
  studyTips?: string[];
  homework?: string | null;
  steps?: unknown;
};

// K's vernacular adapts to the learner's age band (from their profile): casual /
// slang for younger trainees, warmer and more measured for older ones.
export type Register = 'young' | 'mid' | 'mature';

const ENCOURAGEMENTS: Record<Register, string[]> = {
  young: ['Nice one!', 'Smashing it.', 'Big brain energy 🧠', 'Lowkey acing this.', 'Let’s gooo.', 'Too easy.', 'You’re on fire 🔥', 'Absolute scenes.', 'Vibes.', 'Chef’s kiss.'],
  mid: ['Nice work!', 'You’ve got this.', 'Spot on.', 'Great pace.', 'Love that.', 'Brilliant.', 'Keep it up — you’re flying.', 'On a roll!', 'Look at you go.'],
  mature: ['Well done.', 'Excellent.', 'That’s exactly right.', 'Very good indeed.', 'Nicely done.', 'Quite right.', 'Impressive.', 'A pleasure to see.'],
};
const SEGUES: Record<Register, string[]> = {
  young: ['Okay, next bit…', 'Right, check this out.', 'Now for a good one.', 'Stick with me…', 'This one’s class.'],
  mid: ['Right, next up…', 'Okay, here’s a good one.', 'Let’s build on that.', 'Now for something useful.', 'Stick with me…'],
  mature: ['Now, moving on…', 'Let’s turn to the next point.', 'Building on that…', 'Here’s an important one.', 'Onward.'],
};
const GREETING: Record<Register, string> = {
  young: 'Right, let’s get into it — bit by bit.',
  mid: 'Let’s get into it — one step at a time.',
  mature: 'Let’s begin — we’ll take this step by step.',
};
const CLOSING: Record<Register, string> = {
  young: 'And that’s a wrap — nicely done.',
  mid: 'That’s the lesson done — nicely paced.',
  mature: 'That completes the lesson — very good.',
};

/** Age (years) → vernacular register. */
export function registerForAge(age: number | null | undefined): Register {
  if (age == null) return 'mid';
  if (age < 25) return 'young';
  if (age >= 45) return 'mature';
  return 'mid';
}

/** Validate/coerce an authored steps array from JSON into FlowStep[]. */
export function coerceSteps(raw: unknown): FlowStep[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: FlowStep[] = [];
  for (const r of raw as Record<string, unknown>[]) {
    const kind = r?.kind;
    if (kind === 'teach' && typeof r.text === 'string') out.push({ kind: 'teach', title: typeof r.title === 'string' ? r.title : undefined, text: r.text, art: typeof r.art === 'string' ? r.art : undefined });
    else if (kind === 'say' && typeof r.text === 'string') out.push({ kind: 'say', text: r.text, mood: (['happy', 'think', 'cheer'].includes(r.mood as string) ? r.mood : undefined) as SayStep['mood'] });
    else if (kind === 'ask' && typeof r.prompt === 'string' && Array.isArray(r.options) && Array.isArray(r.correct)) {
      out.push({ kind: 'ask', prompt: r.prompt, qtype: (['SINGLE', 'MULTI', 'TRUEFALSE', 'WORD'].includes(r.qtype as string) ? r.qtype : 'SINGLE') as AskStep['qtype'], options: (r.options as unknown[]).map(String), correct: (r.correct as unknown[]).map(Number).filter((n) => Number.isInteger(n)), explanation: typeof r.explanation === 'string' ? r.explanation : undefined, tip: typeof r.tip === 'string' ? r.tip : undefined, art: typeof r.art === 'string' ? r.art : undefined });
    }
  }
  return out.length ? out : null;
}

// BLD-449: keep written content continuous — a normal paragraph reads as one
// card; only a genuinely long paragraph is split (on sentence boundaries) so the
// scrollable card stays readable, instead of fragmenting every 1–2 sentences.
const CARD_MAX = 900;

function splitSentences(p: string): string[] {
  return p.split(/(?<=[.!?])\s+(?=[A-Z(])/).map((s) => s.trim()).filter(Boolean);
}

/** Group a paragraph's sentences into short cards (≤ ~2 sentences / CARD_MAX chars). */
function paragraphCards(p: string): string[] {
  // BLD-449: a whole paragraph is one card so written content reads continuously;
  // only split a paragraph that's longer than a full card, on sentence boundaries.
  if (p.length <= CARD_MAX) return [p];
  const cards: string[] = [];
  let cur = '';
  for (const s of splitSentences(p)) {
    const next = cur ? `${cur} ${s}` : s;
    if (cur && next.length > CARD_MAX) { cards.push(cur); cur = s; }
    else cur = next;
  }
  if (cur) cards.push(cur);
  return cards;
}

type Block = { heading?: string; kind: 'p' | 'list'; text: string; items?: string[] };

/** Parse the markdown-ish body into heading-tagged blocks. */
function parseBlocks(body: string): Block[] {
  const lines = body.replace(/\r/g, '').split('\n');
  const blocks: Block[] = [];
  let heading: string | undefined;
  let para: string[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (para.length) { blocks.push({ heading, kind: 'p', text: para.join(' ').trim() }); heading = undefined; para = []; }
    if (bullets.length) { blocks.push({ heading, kind: 'list', text: '', items: bullets.slice() }); heading = undefined; bullets = []; }
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    const h = line.match(/^#{2,3}\s+(.*)$/);
    if (h) { flush(); heading = h[1].trim(); continue; }
    const b = line.match(/^[-*]\s+(.*)$/);
    if (b) { if (para.length) flush(); bullets.push(b[1].trim()); continue; }
    if (bullets.length) flush();
    para.push(line);
  }
  flush();
  return blocks;
}

/** Build the full micro-step flow for a lesson. `register` tunes K's vernacular. */
export function buildLessonFlow(lesson: FlowLesson, register: Register = 'mid'): FlowStep[] {
  const authored = coerceSteps(lesson.steps);
  if (authored) return authored;
  const encs = ENCOURAGEMENTS[register], segs = SEGUES[register];

  const flow: FlowStep[] = [];
  flow.push({ kind: 'say', text: GREETING[register], mood: 'happy' });
  if (lesson.objectives && lesson.objectives.length) {
    flow.push({ kind: 'teach', title: 'Here’s the plan', text: lesson.objectives.slice(0, 4).map((o) => `• ${o}`).join('\n') });
  }

  const blocks = parseBlocks(lesson.body);
  let sinceSay = 0;
  let encIdx = 0, segIdx = 0;
  let lastHeading: string | undefined;
  for (const block of blocks) {
    if (block.heading && block.heading !== lastHeading) {
      lastHeading = block.heading;
      if (flow.length > 2) { flow.push({ kind: 'say', text: segs[segIdx++ % segs.length], mood: 'think' }); sinceSay = 0; }
    }
    if (block.kind === 'list' && block.items) {
      // One short bullet per card pairs up; a long bullet gets its own card —
      // so a slide never overflows the screen.
      const groups: string[][] = [];
      let g: string[] = [], glen = 0;
      for (const it of block.items) {
        if (g.length && (glen + it.length > 150 || g.length >= 2 || it.length > 90)) { groups.push(g); g = []; glen = 0; }
        g.push(it); glen += it.length;
      }
      if (g.length) groups.push(g);
      groups.forEach((items, i) => flow.push({ kind: 'teach', title: i === 0 ? block.heading : undefined, text: items.map((x) => `• ${x}`).join('\n') }));
      sinceSay += groups.length;
    } else {
      const cards = paragraphCards(block.text);
      cards.forEach((text, i) => { flow.push({ kind: 'teach', title: i === 0 ? block.heading : undefined, text }); sinceSay++; });
    }
    if (sinceSay >= 3) { flow.push({ kind: 'say', text: encs[encIdx++ % encs.length], mood: 'cheer' }); sinceSay = 0; }
  }

  if (lesson.studyTips && lesson.studyTips.length) {
    flow.push({ kind: 'say', text: `Quick tip: ${lesson.studyTips[0]}`, mood: 'think' });
  }
  if (lesson.homework) {
    flow.push({ kind: 'say', text: 'One thing to take away and practise:', mood: 'think' });
    flow.push({ kind: 'teach', title: 'Homework', text: lesson.homework });
  }
  flow.push({ kind: 'say', text: CLOSING[register], mood: 'cheer' });
  return flow;
}
