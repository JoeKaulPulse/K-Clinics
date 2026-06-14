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
  {
    courseSlug: L2,
    modules: [
      {
        title: 'Light, Lasers & How They Work',
        summary: 'The physics behind laser and IPL: wavelength, chromophores and selective photothermolysis — without the jargon.',
        lessons: [
          {
            title: 'What Is Light?',
            durationMin: 10,
            objectives: ['Describe light as waves with a wavelength', 'Tell a laser from IPL', 'Link wavelength to depth'],
            studyTips: ['Wavelength is in nanometres (nm) — examiners love a unit.'],
            examRefs: ['Light & laser science'],
            steps: [
              { kind: 'say', text: 'Let’s demystify the science — it’s simpler than it sounds.', mood: 'happy' },
              { kind: 'teach', title: 'Light is waves', text: 'Light is energy travelling in waves. The distance between waves is the wavelength, measured in nanometres (nm).', art: 'light-spectrum' },
              { kind: 'teach', title: 'Different jobs', text: 'Different wavelengths do different jobs. Lasers and IPL use specific wavelengths to target specific things in the skin.' },
              { kind: 'ask', prompt: 'Wavelength is measured in…', qtype: 'SINGLE', options: ['Nanometres (nm)', 'Litres', 'Degrees', 'Grams'], correct: [0], explanation: 'Nanometres — billionths of a metre.' },
              { kind: 'teach', title: 'Laser vs IPL', text: 'A laser produces one single wavelength. IPL produces a broad band of many wavelengths at once.' },
              { kind: 'ask', prompt: 'Which produces a single, focused wavelength?', qtype: 'SINGLE', options: ['Laser', 'IPL', 'A heat lamp', 'A torch'], correct: [0], explanation: '“Laser” light is one wavelength; IPL is a broad band.' },
              { kind: 'say', text: 'Nice — you’ve got the basics.', mood: 'cheer' },
              { kind: 'teach', title: 'Depth', text: 'Longer wavelengths reach deeper into the skin; shorter ones stay nearer the surface.', art: 'light-spectrum' },
              { kind: 'ask', prompt: 'Longer wavelengths travel ___ into the skin.', qtype: 'WORD', options: ['deeper', 'shallower', 'sideways'], correct: [0], explanation: 'Depth increases with wavelength, up to a point.' },
              { kind: 'say', text: 'That’s light sorted.', mood: 'cheer' },
            ],
          },
          {
            title: 'Chromophores — Turning Light into Heat',
            durationMin: 11,
            objectives: ['Name the three skin chromophores', 'Explain selective photothermolysis', 'Identify the hair-removal target'],
            studyTips: ['Photo (light) + thermo (heat) + lysis (destruction) = photothermolysis.'],
            examRefs: ['Chromophores & selective photothermolysis'],
            steps: [
              { kind: 'say', text: 'Now — what actually absorbs the light?', mood: 'happy' },
              { kind: 'teach', title: 'Targets', text: 'Light only works if something absorbs it. Those targets are called chromophores.' },
              { kind: 'teach', title: 'The big three', text: 'The three main skin chromophores are melanin (pigment), haemoglobin (blood), and water.' },
              { kind: 'ask', prompt: 'Which is NOT a main skin chromophore?', qtype: 'SINGLE', options: ['Melanin', 'Haemoglobin', 'Water', 'Keratin'], correct: [3], explanation: 'Melanin, haemoglobin and water absorb the energy; keratin isn’t a main target.' },
              { kind: 'teach', title: 'The key idea', text: 'When a chromophore absorbs the right wavelength, the energy becomes heat — destroying the target while sparing nearby tissue.' },
              { kind: 'ask', prompt: 'Targeting one chromophore while sparing the rest is called selective ___.', qtype: 'WORD', options: ['photothermolysis', 'hydration', 'exfoliation'], correct: [0], explanation: 'Selective photothermolysis — the principle behind it all.' },
              { kind: 'say', text: 'That’s the heart of laser science. Well done.', mood: 'cheer' },
              { kind: 'teach', title: 'Hair removal', text: 'For hair removal the target is the melanin in the hair and follicle — which is why dark hair responds best.' },
              { kind: 'ask', prompt: 'Laser hair removal targets melanin in the…', qtype: 'SINGLE', options: ['Hair and follicle', 'Sweat gland', 'Nail', 'Bone'], correct: [0], explanation: 'Melanin in the hair shaft and follicle absorbs the energy.', tip: 'Think about what gives hair its colour.' },
              { kind: 'say', text: 'Brilliant — you can explain how a laser actually works.', mood: 'cheer' },
            ],
          },
        ],
        quiz: {
          title: 'Light & Lasers Assessment', passMark: 70,
          questions: [
            { prompt: 'Wavelength is measured in nanometres (nm).', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'nm — billionths of a metre.' },
            { prompt: 'Which device emits a single wavelength?', type: 'SINGLE', options: ['Laser', 'IPL', 'Both equally', 'Neither'], correct: [0], explanation: 'IPL is a broad band; a laser is one wavelength.' },
            { prompt: 'The three main skin chromophores are melanin, haemoglobin and…', type: 'WORD', options: ['water', 'keratin', 'collagen'], correct: [0], explanation: 'Melanin, haemoglobin and water.' },
            { prompt: 'Selective photothermolysis means…', type: 'SINGLE', options: ['Heating a target while sparing nearby tissue', 'Cooling the whole face', 'Bleaching the skin', 'Exfoliating'], correct: [0], explanation: 'Targeted heat destruction via an absorbed wavelength.' },
            { prompt: 'Longer wavelengths generally reach…', type: 'SINGLE', options: ['Deeper into the skin', 'Only the surface', 'Nowhere', 'Outward'], correct: [0], explanation: 'Depth rises with wavelength, up to a point.' },
            { prompt: 'Dark hair responds best to laser because it contains more…', type: 'WORD', options: ['melanin', 'water', 'keratin'], correct: [0], explanation: 'More melanin means more energy absorbed at the follicle.' },
          ],
        },
      },
    ],
  },
  {
    courseSlug: 'level-3-laser-aesthetic-therapies',
    modules: [
      {
        title: 'Pigmentation & Vascular Treatments',
        summary: 'Treat pigmentation and visible vessels safely — the right target, the right caution, the right aftercare.',
        lessons: [
          {
            title: 'Treating Pigmentation Safely',
            durationMin: 11,
            objectives: ['Explain how light clears pigmentation', 'Apply Fitzpatrick caution', 'Refer suspicious lesions'],
            studyTips: ['“Refer anything suspicious” is always the safe answer.'],
            examRefs: ['Pigmentation treatments'],
            steps: [
              { kind: 'say', text: 'Pigmentation work is satisfying — and safety-critical. Let’s go.', mood: 'happy' },
              { kind: 'teach', title: 'The target', text: 'Pigmentation marks like sun spots are areas of excess melanin. Light targets that melanin to break it up.', art: 'fitzpatrick' },
              { kind: 'teach', title: 'Skin-type caution', text: 'Higher Fitzpatrick types have more melanin everywhere, so there’s more risk of burns and pigment changes — extra caution and lower settings.', art: 'fitzpatrick' },
              { kind: 'ask', prompt: 'Why are higher Fitzpatrick types higher-risk for pigmentation lasers?', qtype: 'SINGLE', options: ['More background melanin competes for the energy', 'Thinner skin', 'No blood supply', 'Faster healing'], correct: [0], explanation: 'Background melanin raises burn and pigment-change risk.' },
              { kind: 'teach', title: 'Rule out the sinister', text: 'Irregular, changing or bleeding lesions are not for a laser — they need a medical referral first.' },
              { kind: 'ask', prompt: 'Which need referral, not treatment?', qtype: 'MULTI', options: ['An irregular changing mole', 'A simple freckle', 'A bleeding lesion', 'A flat sun spot'], correct: [0, 2], explanation: 'Anything suspicious goes to a doctor first.' },
              { kind: 'say', text: 'Exactly — safety first, always.', mood: 'cheer' },
              { kind: 'teach', title: 'Aftercare', text: 'Treated pigment often darkens and flakes away over days — warn clients so they’re not alarmed.' },
              { kind: 'say', text: 'Great — you can treat pigment safely.', mood: 'cheer' },
            ],
          },
          {
            title: 'Vascular Lesions',
            durationMin: 10,
            objectives: ['Identify the vascular target chromophore', 'Explain how vessels clear', 'Check key contraindications'],
            studyTips: ['Vascular = blood = haemoglobin.'],
            examRefs: ['Vascular treatments'],
            steps: [
              { kind: 'say', text: 'Now for visible vessels — thread veins and the like.', mood: 'happy' },
              { kind: 'teach', title: 'The target', text: 'Vascular lesions like thread veins and spider naevi are visible blood vessels. The target chromophore is haemoglobin in the blood.' },
              { kind: 'ask', prompt: 'Which chromophore is targeted for thread veins?', qtype: 'SINGLE', options: ['Haemoglobin', 'Melanin', 'Water', 'Keratin'], correct: [0], explanation: 'Haemoglobin absorbs the energy, collapsing the vessel.' },
              { kind: 'teach', title: 'What happens', text: 'The vessel heats, coagulates and is gradually cleared by the body over weeks.' },
              { kind: 'ask', prompt: 'Vascular lasers target ___ in the blood.', qtype: 'WORD', options: ['haemoglobin', 'melanin', 'collagen'], correct: [0], explanation: 'Haemoglobin is the blood’s chromophore.' },
              { kind: 'teach', title: 'Contraindications', text: 'Check carefully: recent sun, photosensitising medication, and clotting issues can all rule treatment out.' },
              { kind: 'ask', prompt: 'Which are contraindications to check?', qtype: 'MULTI', options: ['Recent tanning', 'Blood-thinning issues', 'Wearing glasses', 'Photosensitising medication'], correct: [0, 1, 3], explanation: 'Glasses aren’t a contraindication; the others matter.' },
              { kind: 'say', text: 'Spot on — vessels need the same care as everything else.', mood: 'cheer' },
            ],
          },
        ],
        quiz: {
          title: 'Pigmentation & Vascular Assessment', passMark: 70,
          questions: [
            { prompt: 'Pigmentation treatments target which chromophore?', type: 'SINGLE', options: ['Melanin', 'Haemoglobin', 'Water', 'Keratin'], correct: [0], explanation: 'Excess melanin is the target.' },
            { prompt: 'Higher Fitzpatrick types need more caution because they have more…', type: 'WORD', options: ['melanin', 'water', 'collagen'], correct: [0], explanation: 'More background melanin raises risk.' },
            { prompt: 'An irregular, changing mole should be…', type: 'SINGLE', options: ['Referred to a doctor', 'Lasered immediately', 'Ignored', 'Frozen'], correct: [0], explanation: 'Refer anything suspicious.' },
            { prompt: 'Thread veins are treated by targeting…', type: 'SINGLE', options: ['Haemoglobin in the vessel', 'Melanin in hair', 'Water in skin', 'Keratin'], correct: [0], explanation: 'Haemoglobin absorbs the energy.' },
            { prompt: 'Which is a vascular-treatment contraindication?', type: 'MULTI', options: ['Recent tanning', 'Photosensitising medication', 'Wearing glasses', 'Clotting problems'], correct: [0, 1, 3], explanation: 'Glasses are fine; the rest matter.' },
            { prompt: 'After pigmentation treatment, marks often darken then flake away.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'Warn clients so they expect it.' },
          ],
        },
      },
    ],
  },
  {
    courseSlug: 'level-4-certificate-aesthetic-practice',
    modules: [
      {
        title: 'Complications & Emergency Management',
        summary: 'Spot complications early, manage them calmly, and recognise a true emergency.',
        lessons: [
          {
            title: 'Recognising & Managing Complications',
            durationMin: 12,
            objectives: ['Name common laser complications', 'Manage a burn or blister', 'Set honest expectations'],
            studyTips: ['Stop, cool, protect, document — in that order.'],
            examRefs: ['Complications management'],
            steps: [
              { kind: 'say', text: 'Even with great practice, things can go wrong. Let’s be ready.', mood: 'think' },
              { kind: 'teach', title: 'Know the risks', text: 'Common laser complications include burns and blisters, hyperpigmentation (darkening), hypopigmentation (lightening), and infection.', art: 'safety' },
              { kind: 'ask', prompt: 'Which are recognised laser complications?', qtype: 'MULTI', options: ['Blistering', 'Hyperpigmentation', 'Hypopigmentation', 'Improved mood'], correct: [0, 1, 2], explanation: 'The first three are genuine complications.' },
              { kind: 'teach', title: 'If skin blisters', text: 'Stop, cool the area, protect it, and document. Never pop a blister.' },
              { kind: 'ask', prompt: 'First step if the skin blisters during treatment?', qtype: 'SINGLE', options: ['Stop and cool the area', 'Increase the energy', 'Carry on', 'Pop the blister'], correct: [0], explanation: 'Stop, cool, protect, document.' },
              { kind: 'say', text: 'Calm and methodical — exactly right.', mood: 'cheer' },
              { kind: 'teach', title: 'Pigment changes', text: 'Hyperpigmentation often fades with time, SPF and gentle care; hypopigmentation can be slower. Be honest about timelines.' },
              { kind: 'say', text: 'You can handle the common ones now.', mood: 'cheer' },
            ],
          },
          {
            title: 'Anaphylaxis & When to Call 999',
            durationMin: 10,
            objectives: ['Recognise anaphylaxis', 'Act in the right order', 'Record and review'],
            studyTips: ['Emergency = call 999 first. Always a safe answer.'],
            examRefs: ['Emergency management'],
            steps: [
              { kind: 'say', text: 'This one’s rare but vital — a true emergency.', mood: 'think' },
              { kind: 'teach', title: 'Anaphylaxis', text: 'Rarely, a client may have a severe allergic reaction — anaphylaxis. It is a medical emergency.' },
              { kind: 'teach', title: 'The signs', text: 'Difficulty breathing, swelling of the face or throat, a widespread rash, and feeling faint.' },
              { kind: 'ask', prompt: 'Which are signs of anaphylaxis?', qtype: 'MULTI', options: ['Difficulty breathing', 'Throat/face swelling', 'A small bruise', 'Feeling faint with a rash'], correct: [0, 1, 3], explanation: 'Breathing trouble, swelling and collapse are red flags.' },
              { kind: 'teach', title: 'Act fast', text: 'Call 999. Use an adrenaline auto-injector if available and you’re trained, lie the person flat with legs raised, and stay with them.' },
              { kind: 'ask', prompt: 'For a suspected anaphylaxis, call ___ immediately.', qtype: 'WORD', options: ['999', 'the supplier', 'a friend'], correct: [0], explanation: 'It’s a medical emergency — emergency services first.' },
              { kind: 'say', text: 'Prompt, honest action is what counts.', mood: 'cheer' },
              { kind: 'teach', title: 'Afterwards', text: 'Record everything and review what happened, so the team learns from it.' },
              { kind: 'say', text: 'Serious stuff handled calmly — well done.', mood: 'cheer' },
            ],
          },
        ],
        quiz: {
          title: 'Complications & Emergencies Assessment', passMark: 70,
          questions: [
            { prompt: 'Which is NOT a laser complication?', type: 'SINGLE', options: ['Improved mood', 'Blistering', 'Hyperpigmentation', 'Infection'], correct: [0], explanation: 'The rest are genuine complications.' },
            { prompt: 'First action if the skin blisters during treatment?', type: 'SINGLE', options: ['Stop and cool the area', 'Increase energy', 'Carry on', 'Pop the blister'], correct: [0], explanation: 'Stop, cool, protect, document.' },
            { prompt: 'Darkening after treatment is called…', type: 'WORD', options: ['hyperpigmentation', 'hypopigmentation', 'erythema'], correct: [0], explanation: 'Hyper = more pigment.' },
            { prompt: 'Which are signs of anaphylaxis?', type: 'MULTI', options: ['Difficulty breathing', 'Throat swelling', 'A small bruise', 'Feeling faint'], correct: [0, 1, 3], explanation: 'A bruise alone is not.' },
            { prompt: 'For a suspected anaphylaxis you should first…', type: 'SINGLE', options: ['Call 999', 'Reassure and wait', 'Offer water', 'Carry on'], correct: [0], explanation: 'Emergency services immediately.' },
            { prompt: 'After any emergency, you should record events and review what happened.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'Documentation and learning protect everyone.' },
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
  { courseSlug: L2, topic: 'Light', prompt: 'A laser emits light of…', options: ['One wavelength', 'Many wavelengths', 'No wavelength', 'Random heat'], correct: [0], explanation: 'IPL is broad-band; a laser is a single wavelength.' },
  { courseSlug: L2, topic: 'Light', prompt: 'Selective photothermolysis spares nearby tissue while heating the…', type: 'WORD', options: ['target', 'whole face', 'air'], correct: [0], explanation: 'Only the absorbing chromophore is heated.' },
  { courseSlug: L2, topic: 'Light', prompt: 'Longer wavelengths generally penetrate…', options: ['Deeper', 'Shallower', 'Not at all', 'Sideways'], correct: [0], explanation: 'Depth increases with wavelength, up to a point.' },
  { courseSlug: L2, topic: 'Chromophores', prompt: 'Which is NOT a main skin chromophore?', options: ['Keratin', 'Melanin', 'Haemoglobin', 'Water'], correct: [0], explanation: 'Melanin, haemoglobin and water are the targets.' },
  { courseSlug: 'level-3-laser-aesthetic-therapies', topic: 'Pigmentation', prompt: 'Pigmentation lasers target…', options: ['Melanin', 'Haemoglobin', 'Water', 'Air'], correct: [0], explanation: 'Excess melanin is broken up.' },
  { courseSlug: 'level-3-laser-aesthetic-therapies', topic: 'Vascular', prompt: 'Thread veins are cleared by targeting haemoglobin, which then…', type: 'WORD', options: ['coagulates', 'evaporates', 'freezes'], correct: [0], explanation: 'The vessel coagulates and is cleared over weeks.' },
  { courseSlug: 'level-3-laser-aesthetic-therapies', topic: 'Safety', prompt: 'A suspicious, changing skin lesion should be…', options: ['Referred to a doctor', 'Treated at once', 'Ignored', 'Tattooed'], correct: [0], explanation: 'Refer anything suspicious before any treatment.' },
  { courseSlug: 'level-4-certificate-aesthetic-practice', topic: 'Complications', prompt: 'Lightening of the skin after treatment is called…', type: 'WORD', options: ['hypopigmentation', 'hyperpigmentation', 'erythema'], correct: [0], explanation: 'Hypo = less pigment.' },
  { courseSlug: 'level-4-certificate-aesthetic-practice', topic: 'Emergency', prompt: 'Signs that warrant calling 999 include…', type: 'MULTI', options: ['Difficulty breathing', 'Throat swelling', 'Mild brief redness', 'Collapse'], correct: [0, 1, 3], explanation: 'Brief mild redness is expected; the rest are emergencies.' },
  { courseSlug: 'level-4-certificate-aesthetic-practice', topic: 'Complications', prompt: 'You should never pop a treatment blister.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'Protect it intact to reduce infection risk.' },
  { courseSlug: 'advanced-aesthetics-level-5-7', topic: 'Governance', prompt: 'The duty of candour requires you to…', options: ['Be open and honest when something goes wrong', 'Hide mistakes', 'Blame the client', 'Delete records'], correct: [0], explanation: 'Be open, apologise, and put things right.' },
  { courseSlug: 'advanced-aesthetics-level-5-7', topic: 'Anatomy', prompt: 'Higher-risk facial “danger zones” matter most when working near…', options: ['Major vessels and nerves', 'The hairline only', 'The ears only', 'Nowhere'], correct: [0], explanation: 'Knowing the layered anatomy avoids serious harm.' },
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
