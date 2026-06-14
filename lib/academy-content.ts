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
  {
    courseSlug: L2,
    modules: [
      {
        title: 'Hygiene & Infection Control',
        summary: 'Protect clients and yourself — hand hygiene, single-use sharps, clean surfaces and correct waste.',
        lessons: [
          {
            title: 'Stopping the Spread',
            durationMin: 10,
            objectives: ['Apply hand hygiene', 'Use single-use items correctly', 'Dispose of sharps safely'],
            studyTips: ['“Single-use means single-use” — never reuse cartridges or needles.'],
            examRefs: ['Health & safety / infection control'],
            steps: [
              { kind: 'say', text: 'Infection control keeps everyone safe — let’s nail the basics.', mood: 'happy' },
              { kind: 'teach', title: 'Clean hands', text: 'It starts with your hands — wash or sanitise before and after every single client.', art: 'safety' },
              { kind: 'ask', prompt: 'When should you sanitise your hands?', qtype: 'SINGLE', options: ['Before and after every client', 'Once a day', 'Only if visibly dirty', 'Never'], correct: [0], explanation: 'Before AND after each client is the foundation.' },
              { kind: 'teach', title: 'Single-use', text: 'Needles and cartridges are used once and binned. Reusable tools are cleaned and sterilised between clients.' },
              { kind: 'ask', prompt: 'A microneedling cartridge is…', qtype: 'SINGLE', options: ['Single-use', 'Reusable if wiped', 'Used all day', 'Optional'], correct: [0], explanation: 'Single-use — never reuse between clients.' },
              { kind: 'say', text: 'Exactly. Safety over shortcuts.', mood: 'cheer' },
              { kind: 'teach', title: 'Sharps', text: 'Used needles go straight into a sharps bin — never a normal bin. This prevents needlestick injuries.' },
              { kind: 'ask', prompt: 'Used needles go into a ___ bin.', qtype: 'WORD', options: ['sharps', 'recycling', 'general'], correct: [0], explanation: 'A sharps bin prevents injury and disease spread.' },
              { kind: 'say', text: 'Clean and safe — well done.', mood: 'cheer' },
            ],
          },
          {
            title: 'A Safe, Clean Workspace',
            durationMin: 9,
            objectives: ['Disinfect between clients', 'Use PPE correctly', 'Separate waste streams'],
            examRefs: ['Health & safety / infection control'],
            steps: [
              { kind: 'say', text: 'Now the workspace itself.', mood: 'happy' },
              { kind: 'teach', title: 'Surfaces', text: 'Surfaces and equipment are wiped with appropriate disinfectant between clients, and couch roll is changed every time.' },
              { kind: 'ask', prompt: 'Couch roll should be changed…', qtype: 'SINGLE', options: ['Between every client', 'Weekly', 'Never', 'Monthly'], correct: [0], explanation: 'Fresh couch roll for every client.' },
              { kind: 'teach', title: 'PPE', text: 'Gloves and eye protection are worn as needed and changed between clients.', art: 'safety' },
              { kind: 'ask', prompt: 'Which are infection-control basics?', qtype: 'MULTI', options: ['Hand hygiene', 'Single-use sharps', 'Sharing tools unwashed', 'Surface disinfection'], correct: [0, 1, 3], explanation: 'Sharing unwashed tools is exactly what to avoid.' },
              { kind: 'teach', title: 'Waste', text: 'Separate waste correctly: clinical waste, sharps, and general — each in its right stream.' },
              { kind: 'say', text: 'A clean clinic is a safe clinic. Brilliant.', mood: 'cheer' },
            ],
          },
        ],
        quiz: {
          title: 'Hygiene & Infection Control Assessment', passMark: 70,
          questions: [
            { prompt: 'Hands should be sanitised before and after every client.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'The foundation of infection control.' },
            { prompt: 'Microneedling cartridges are…', type: 'SINGLE', options: ['Single-use', 'Reusable', 'All-day', 'Optional'], correct: [0], explanation: 'Used once, then binned.' },
            { prompt: 'Used needles go into a ___ bin.', type: 'WORD', options: ['sharps', 'general', 'recycling'], correct: [0], explanation: 'Sharps bin only.' },
            { prompt: 'Couch roll is changed…', type: 'SINGLE', options: ['Between every client', 'Weekly', 'Monthly', 'Never'], correct: [0], explanation: 'Fresh per client.' },
            { prompt: 'Which are infection-control basics?', type: 'MULTI', options: ['Hand hygiene', 'Surface disinfection', 'Reusing sharps', 'Single-use items'], correct: [0, 1, 3], explanation: 'Reusing sharps is unsafe.' },
            { prompt: 'PPE such as gloves should be changed between clients.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'Fresh PPE per client.' },
          ],
        },
      },
    ],
  },
  {
    courseSlug: 'level-3-laser-aesthetic-therapies',
    modules: [
      {
        title: 'Skin Rejuvenation & Photofacials',
        summary: 'Stimulate fresh collagen, even out tone, and plan settings safely.',
        lessons: [
          {
            title: 'How Rejuvenation Works',
            durationMin: 11,
            objectives: ['Explain neocollagenesis', 'Describe what photofacials treat', 'Set realistic expectations'],
            studyTips: ['Neo = new, collagenesis = collagen-making.'],
            examRefs: ['Skin rejuvenation'],
            steps: [
              { kind: 'say', text: 'Rejuvenation is satisfying work — here’s how it actually works.', mood: 'happy' },
              { kind: 'teach', title: 'Controlled injury', text: 'Rejuvenation creates controlled micro-injury, prompting the skin to make fresh collagen as it heals — firmer, smoother skin over weeks.', art: 'collagen' },
              { kind: 'ask', prompt: 'Rejuvenation works mainly by stimulating…', qtype: 'SINGLE', options: ['New collagen', 'Melanin', 'Sweat', 'Hair'], correct: [0], explanation: 'Neocollagenesis — new collagen.' },
              { kind: 'teach', title: 'Photofacials', text: 'Photofacials (IPL) also target redness and brown spots, evening out tone in the same session.' },
              { kind: 'ask', prompt: 'IPL photofacials can help with…', qtype: 'MULTI', options: ['Redness', 'Brown spots', 'Uneven tone', 'Deep wrinkles alone'], correct: [0, 1, 2], explanation: 'Tone, redness and pigment; deep wrinkles need more.' },
              { kind: 'say', text: 'Lovely. Manage expectations and you’re golden.', mood: 'cheer' },
              { kind: 'ask', prompt: 'New collagen formation is called neo___.', qtype: 'WORD', options: ['collagenesis', 'plasia', 'natal'], correct: [0], explanation: 'Neocollagenesis.' },
              { kind: 'say', text: 'That’s rejuvenation in a nutshell.', mood: 'cheer' },
            ],
          },
          {
            title: 'Planning a Safe Treatment',
            durationMin: 10,
            objectives: ['Match settings to the client', 'Understand fluence', 'Document the plan'],
            studyTips: ['Fluence = energy density (J/cm²).'],
            examRefs: ['Treatment planning'],
            steps: [
              { kind: 'say', text: 'Now — getting the settings right.', mood: 'think' },
              { kind: 'teach', title: 'Match the client', text: 'Match settings to the client: skin type, the target, and a patch test guide your fluence and pulse.' },
              { kind: 'ask', prompt: 'Higher Fitzpatrick types generally need…', qtype: 'SINGLE', options: ['Lower, more cautious settings', 'Maximum energy', 'No patch test', 'Faster pulses'], correct: [0], explanation: 'More melanin means more caution.' },
              { kind: 'teach', title: 'Fluence', text: 'Fluence is the energy delivered. Too low won’t work; too high risks burns — build up cautiously.' },
              { kind: 'ask', prompt: 'The energy a laser delivers is called its ___.', qtype: 'WORD', options: ['fluence', 'colour', 'volume'], correct: [0], explanation: 'Fluence — joules per cm².' },
              { kind: 'teach', title: 'Document', text: 'Record the plan and settings, and review results before the next session.' },
              { kind: 'say', text: 'Careful planning, safe results. Great.', mood: 'cheer' },
            ],
          },
        ],
        quiz: {
          title: 'Rejuvenation & Planning Assessment', passMark: 70,
          questions: [
            { prompt: 'Rejuvenation mainly stimulates…', type: 'SINGLE', options: ['New collagen', 'Melanin', 'Hair', 'Sweat'], correct: [0], explanation: 'Neocollagenesis.' },
            { prompt: 'IPL photofacials help with redness, brown spots and uneven tone.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'They even out tone.' },
            { prompt: 'The energy density a laser delivers is its ___.', type: 'WORD', options: ['fluence', 'wavelength', 'pulse'], correct: [0], explanation: 'Fluence (J/cm²).' },
            { prompt: 'Higher Fitzpatrick types usually need…', type: 'SINGLE', options: ['Lower, cautious settings', 'Maximum energy', 'No consultation', 'No SPF'], correct: [0], explanation: 'More caution for more melanin.' },
            { prompt: 'Too-high fluence risks…', type: 'SINGLE', options: ['Burns', 'Nothing', 'Better results always', 'Faster healing'], correct: [0], explanation: 'Build up cautiously.' },
            { prompt: 'Treatment plans and settings should be documented.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'Records guide the next session.' },
          ],
        },
      },
    ],
  },
  {
    courseSlug: 'advanced-aesthetics-level-5-7',
    modules: [
      {
        title: 'Advanced Practice & Reflection',
        summary: 'Audit your outcomes, lead on safety, and keep your practice current.',
        lessons: [
          {
            title: 'Reflective Practice',
            durationMin: 10,
            objectives: ['Reflect on real outcomes', 'Audit your results', 'Improve from data'],
            examRefs: ['Reflective practice'],
            steps: [
              { kind: 'say', text: 'Advanced practice is as much about reflection as technique.', mood: 'think' },
              { kind: 'teach', title: 'Reflect honestly', text: 'Reflective practice means honestly analysing outcomes — what worked, what didn’t, and why.' },
              { kind: 'ask', prompt: 'Reflective practice helps you…', qtype: 'SINGLE', options: ['Improve from real outcomes', 'Avoid records', 'Work faster only', 'Skip training'], correct: [0], explanation: 'Learning from your results raises standards.' },
              { kind: 'teach', title: 'Audit', text: 'Track your complication rates, client satisfaction and re-treatment rates to spot patterns over time.' },
              { kind: 'ask', prompt: 'Useful things to audit include…', qtype: 'MULTI', options: ['Complication rates', 'Client satisfaction', 'Re-treatment rates', 'Lunch breaks'], correct: [0, 1, 2], explanation: 'Clinical and outcome metrics, not breaks.' },
              { kind: 'say', text: 'Measure, reflect, improve. Spot on.', mood: 'cheer' },
            ],
          },
          {
            title: 'Leading on Safety',
            durationMin: 9,
            objectives: ['Set clear protocols', 'Build a safety culture', 'Stay current'],
            studyTips: ['JCCP = Joint Council for Cosmetic Practitioners.'],
            examRefs: ['Governance & leadership'],
            steps: [
              { kind: 'say', text: 'Senior practitioners set the tone for everyone.', mood: 'happy' },
              { kind: 'teach', title: 'Set the standard', text: 'Clear protocols, good records, and a culture where raising concerns is welcomed — that’s leadership.' },
              { kind: 'ask', prompt: 'A strong safety culture means…', qtype: 'SINGLE', options: ['Concerns can be raised freely', 'Hiding mistakes', 'Blame', 'Skipping consent'], correct: [0], explanation: 'Openness and learning, not blame.' },
              { kind: 'teach', title: 'Stay current', text: 'Guidance from the JCCP, Save Face and your insurer changes — keep up to date.' },
              { kind: 'ask', prompt: 'The register and standards body for the sector is the ___.', qtype: 'WORD', options: ['JCCP', 'NHS', 'RAC'], correct: [0], explanation: 'Joint Council for Cosmetic Practitioners.' },
              { kind: 'say', text: 'Leading safely — that’s the mark of an expert.', mood: 'cheer' },
            ],
          },
        ],
        quiz: {
          title: 'Advanced Practice Assessment', passMark: 70,
          questions: [
            { prompt: 'Reflective practice is about…', type: 'SINGLE', options: ['Learning from real outcomes', 'Avoiding records', 'Working faster only', 'Skipping CPD'], correct: [0], explanation: 'Honest analysis improves standards.' },
            { prompt: 'Which are worth auditing?', type: 'MULTI', options: ['Complication rates', 'Client satisfaction', 'Re-treatment rates', 'Break times'], correct: [0, 1, 2], explanation: 'Clinical/outcome metrics.' },
            { prompt: 'A strong safety culture welcomes raised concerns.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'Openness over blame.' },
            { prompt: 'The sector’s standards/register body is the ___.', type: 'WORD', options: ['JCCP', 'NHS', 'DVLA'], correct: [0], explanation: 'Joint Council for Cosmetic Practitioners.' },
            { prompt: 'Keeping up to date with guidance and insurance is part of advanced practice.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'Standards change; stay current.' },
            { prompt: 'The duty of candour means being open and honest when something goes wrong.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'Be open, apologise, put it right.' },
          ],
        },
      },
    ],
  },
  {
    courseSlug: L2,
    modules: [
      {
        title: 'Fitzpatrick Skin Typing',
        summary: 'Place a client on the six-type scale and use it to keep treatments safe.',
        lessons: [
          {
            title: 'The Fitzpatrick Scale',
            durationMin: 10,
            objectives: ['Describe the six skin types', 'Link type to sun response', 'Connect type to risk'],
            studyTips: ['Type I always burns, never tans; Type VI rarely burns.'],
            examRefs: ['Fitzpatrick skin typing'],
            steps: [
              { kind: 'say', text: 'Skin typing underpins safe treatment — let’s get it clear.', mood: 'happy' },
              { kind: 'teach', title: 'Six types', text: 'The Fitzpatrick scale sorts skin into six types by how it reacts to sun — Type I always burns and never tans, through to Type VI which is deeply pigmented and rarely burns.', art: 'fitzpatrick' },
              { kind: 'ask', prompt: 'Type I skin…', qtype: 'SINGLE', options: ['Always burns, never tans', 'Never burns', 'Tans deeply', 'Is green'], correct: [0], explanation: 'Type I is the fairest, most sun-sensitive.' },
              { kind: 'teach', title: 'Based on response', text: 'It’s based on genetics and how skin responds to UV — not just colour at a glance.' },
              { kind: 'ask', prompt: 'The Fitzpatrick scale has ___ types.', qtype: 'WORD', options: ['six', 'three', 'ten'], correct: [0], explanation: 'Types I–VI.' },
              { kind: 'say', text: 'Got it. Now why it matters.', mood: 'cheer' },
              { kind: 'teach', title: 'Type and risk', text: 'Higher types have more melanin throughout, so they’re more prone to pigment changes from heat and light.', art: 'fitzpatrick' },
              { kind: 'ask', prompt: 'Higher Fitzpatrick types are MORE at risk of…', qtype: 'SINGLE', options: ['Pigment changes', 'Sunburn only', 'Nothing', 'Tanning safely faster'], correct: [0], explanation: 'More background melanin raises pigment-change risk.' },
              { kind: 'say', text: 'That’s the scale sorted.', mood: 'cheer' },
            ],
          },
          {
            title: 'Typing in Practice',
            durationMin: 9,
            objectives: ['Assess type at consultation', 'Use type to set caution', 'Default to caution when unsure'],
            examRefs: ['Fitzpatrick skin typing'],
            steps: [
              { kind: 'say', text: 'Now to place a real client on the scale.', mood: 'happy' },
              { kind: 'teach', title: 'Ask the right things', text: 'At consultation, ask about burning, tanning, ethnicity and family background to place the client on the scale.' },
              { kind: 'ask', prompt: 'Which help you assess skin type?', qtype: 'MULTI', options: ['How easily they burn', 'How they tan', 'Family background', 'Their star sign'], correct: [0, 1, 2], explanation: 'Burning/tanning history and background; not astrology.' },
              { kind: 'teach', title: 'Type drives settings', text: 'Skin type drives your settings and your patch test — get it right before any energy device.' },
              { kind: 'ask', prompt: 'Why does skin type matter for laser?', qtype: 'SINGLE', options: ['It guides safe settings', 'It sets the price', 'It’s irrelevant', 'It picks the music'], correct: [0], explanation: 'Type guides fluence and caution.' },
              { kind: 'teach', title: 'When unsure', text: 'When unsure between two types, choose the more cautious, lower-energy option.' },
              { kind: 'say', text: 'Cautious and correct — exactly right.', mood: 'cheer' },
            ],
          },
        ],
        quiz: {
          title: 'Fitzpatrick Assessment', passMark: 70,
          questions: [
            { prompt: 'How many Fitzpatrick skin types are there?', type: 'WORD', options: ['six', 'three', 'ten'], correct: [0], explanation: 'Types I–VI.' },
            { prompt: 'Type I skin…', type: 'SINGLE', options: ['Always burns, never tans', 'Never burns', 'Tans deeply', 'Is unaffected by sun'], correct: [0], explanation: 'Fairest and most sun-sensitive.' },
            { prompt: 'Higher Fitzpatrick types are more at risk of pigment changes.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'More background melanin.' },
            { prompt: 'Which help assess skin type at consultation?', type: 'MULTI', options: ['Burning history', 'Tanning history', 'Family background', 'Star sign'], correct: [0, 1, 2], explanation: 'Not astrology.' },
            { prompt: 'Unsure between two types, you should pick the…', type: 'SINGLE', options: ['More cautious, lower-energy option', 'Higher-energy option', 'Random one', 'Most expensive option'], correct: [0], explanation: 'Default to caution.' },
            { prompt: 'Skin type guides laser settings and the patch test.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'It drives safe parameters.' },
          ],
        },
      },
    ],
  },
  {
    courseSlug: 'level-4-certificate-aesthetic-practice',
    modules: [
      {
        title: 'Facial Anatomy & Danger Zones',
        summary: 'Know the layers and high-risk areas of the face to treat safely.',
        lessons: [
          {
            title: 'Layers of the Face',
            durationMin: 10,
            objectives: ['Name the facial layers', 'Locate the SMAS', 'Understand danger zones'],
            studyTips: ['SMAS = the muscular/fibrous layer.'],
            examRefs: ['Facial anatomy'],
            steps: [
              { kind: 'say', text: 'Safe practice starts with anatomy. Let’s map the face.', mood: 'think' },
              { kind: 'teach', title: 'The layers', text: 'The face has layers: skin, fat, muscle (the SMAS), and beneath them vessels and nerves. Knowing them keeps treatments safe.' },
              { kind: 'ask', prompt: 'Which is the muscular/fibrous layer of the face?', qtype: 'SINGLE', options: ['SMAS', 'Epidermis', 'Bone', 'Hair'], correct: [0], explanation: 'The SMAS is the muscular/fibrous layer.' },
              { kind: 'teach', title: 'Predictable paths', text: 'Major vessels and nerves run in predictable places — the “danger zones” where extra care is needed.' },
              { kind: 'ask', prompt: 'High-risk facial areas are called danger ___.', qtype: 'WORD', options: ['zones', 'lines', 'hours'], correct: [0], explanation: 'Danger zones.' },
              { kind: 'say', text: 'Knowing where to be careful is half the battle.', mood: 'cheer' },
              { kind: 'teach', title: 'Why it matters', text: 'Knowing depth and location helps you avoid bruising, nerve injury or worse.' },
              { kind: 'say', text: 'Solid foundation laid.', mood: 'cheer' },
            ],
          },
          {
            title: 'Working Safely Near Risk Areas',
            durationMin: 9,
            objectives: ['Identify higher-risk areas', 'Slow down and adjust', 'Refer when unsure'],
            studyTips: ['Unsure of the anatomy? Don’t proceed.'],
            examRefs: ['Facial anatomy / safe practice'],
            steps: [
              { kind: 'say', text: 'Now — handling the tricky areas.', mood: 'think' },
              { kind: 'teach', title: 'Close to the surface', text: 'Around the eyes, nose and temples, vessels and nerves sit close to the surface — slow down and use conservative settings.' },
              { kind: 'ask', prompt: 'Higher-risk areas to treat carefully include…', qtype: 'MULTI', options: ['Around the eyes', 'The temples', 'The nose area', 'The earlobe only'], correct: [0, 1, 2], explanation: 'Eyes, temples and nasal area are higher-risk.' },
              { kind: 'teach', title: 'When unsure', text: 'If you’re ever unsure of the anatomy, don’t proceed — refer or seek senior input.' },
              { kind: 'ask', prompt: 'Unsure about the anatomy in an area? You should…', qtype: 'SINGLE', options: ['Pause and seek advice', 'Press on', 'Increase energy', 'Guess'], correct: [0], explanation: 'Safety first — pause and check.' },
              { kind: 'teach', title: 'Document', text: 'Document the areas treated and any client feedback during the session.' },
              { kind: 'say', text: 'Careful, considered, safe. Excellent.', mood: 'cheer' },
            ],
          },
        ],
        quiz: {
          title: 'Facial Anatomy Assessment', passMark: 70,
          questions: [
            { prompt: 'The muscular/fibrous facial layer is the…', type: 'WORD', options: ['SMAS', 'dermis', 'bone'], correct: [0], explanation: 'SMAS.' },
            { prompt: 'High-risk facial areas are called…', type: 'SINGLE', options: ['Danger zones', 'Safe zones', 'Hot zones', 'No zones'], correct: [0], explanation: 'Where vessels/nerves run close.' },
            { prompt: 'Which areas need extra care?', type: 'MULTI', options: ['Around the eyes', 'Temples', 'Nose area', 'Earlobe only'], correct: [0, 1, 2], explanation: 'Eyes, temples, nose area.' },
            { prompt: 'Unsure of the anatomy, you should pause and seek advice.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'Never guess.' },
            { prompt: 'Knowing facial anatomy helps avoid…', type: 'MULTI', options: ['Bruising', 'Nerve injury', 'Better outcomes', 'Serious harm'], correct: [0, 1, 3], explanation: 'It reduces harm (a positive outcome isn’t something to “avoid”).' },
            { prompt: 'Treated areas and client feedback should be documented.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'Records protect everyone.' },
          ],
        },
      },
    ],
  },
  {
    courseSlug: 'level-3-laser-aesthetic-therapies',
    modules: [
      {
        title: 'Laser Hair Removal in Practice',
        summary: 'Choose the right candidate and manage a full course of treatments.',
        lessons: [
          {
            title: 'Candidate Selection',
            durationMin: 10,
            objectives: ['Identify ideal candidates', 'Explain why hair colour matters', 'Set honest expectations'],
            studyTips: ['Dark hair, lighter skin = the classic ideal — but devices have widened this.'],
            examRefs: ['Laser hair removal'],
            steps: [
              { kind: 'say', text: 'Who is laser hair removal best for? Let’s see.', mood: 'happy' },
              { kind: 'teach', title: 'The target', text: 'Laser hair removal works best on dark hair, because the laser targets the melanin in the hair.' },
              { kind: 'ask', prompt: 'Laser hair removal works best on…', qtype: 'SINGLE', options: ['Dark hair', 'Grey hair', 'White hair', 'Red hair'], correct: [0], explanation: 'Dark hair has the melanin the laser targets.' },
              { kind: 'teach', title: 'Poor responders', text: 'Very fair, grey or white hair has little melanin, so it responds poorly — set expectations honestly.' },
              { kind: 'ask', prompt: 'Laser hair removal targets ___ in the hair.', qtype: 'WORD', options: ['melanin', 'water', 'keratin'], correct: [0], explanation: 'Melanin is the target.' },
              { kind: 'say', text: 'Honesty up front saves disappointment later.', mood: 'cheer' },
              { kind: 'teach', title: 'Darker skin', text: 'Higher Fitzpatrick types can be treated with the right device and caution — adjust settings, never assume it’s off-limits.' },
              { kind: 'say', text: 'Good candidate sense — nice.', mood: 'cheer' },
            ],
          },
          {
            title: 'Managing a Course',
            durationMin: 9,
            objectives: ['Explain why multiple sessions', 'Space sessions correctly', 'Track and adjust'],
            studyTips: ['Anagen = active growth = the responsive phase.'],
            examRefs: ['Laser hair removal'],
            steps: [
              { kind: 'say', text: 'Now — running a full course.', mood: 'happy' },
              { kind: 'teach', title: 'Hair cycles', text: 'Because hair grows in cycles, only follicles in the active (anagen) phase respond — that’s why a course of sessions is needed.', art: 'hair-cycle' },
              { kind: 'ask', prompt: 'Why does hair removal need several sessions?', qtype: 'SINGLE', options: ['Hair grows in cycles', 'To charge more', 'For fun', 'No reason'], correct: [0], explanation: 'Only anagen follicles respond, so repeats catch more.' },
              { kind: 'teach', title: 'Spacing', text: 'Sessions are spaced a few weeks apart to catch new hairs entering the active phase.' },
              { kind: 'ask', prompt: 'Sessions are spaced a few ___ apart.', qtype: 'WORD', options: ['weeks', 'hours', 'years'], correct: [0], explanation: 'Typically 4–8 weeks.' },
              { kind: 'teach', title: 'Track and adjust', text: 'Track progress with photos and notes; reduce energy if reactions are strong.' },
              { kind: 'say', text: 'You can run a safe, effective course now. Brilliant.', mood: 'cheer' },
            ],
          },
        ],
        quiz: {
          title: 'Laser Hair Removal Assessment', passMark: 70,
          questions: [
            { prompt: 'Laser hair removal works best on…', type: 'SINGLE', options: ['Dark hair', 'White hair', 'Grey hair', 'No hair'], correct: [0], explanation: 'Dark hair holds the melanin target.' },
            { prompt: 'The target chromophore in the hair is…', type: 'WORD', options: ['melanin', 'water', 'keratin'], correct: [0], explanation: 'Melanin.' },
            { prompt: 'Multiple sessions are needed because hair grows in…', type: 'SINGLE', options: ['Cycles', 'Straight lines', 'One go', 'Winter only'], correct: [0], explanation: 'Only anagen follicles respond.' },
            { prompt: 'Sessions are usually spaced a few weeks apart.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'To catch new active hairs.' },
            { prompt: 'Higher Fitzpatrick types can never be treated.', type: 'TRUEFALSE', options: ['False', 'True'], correct: [0], explanation: 'They can, with the right device and caution.' },
            { prompt: 'Progress should be tracked with…', type: 'MULTI', options: ['Photos', 'Notes', 'Guesswork only', 'Settings used'], correct: [0, 1, 3], explanation: 'Record objectively.' },
          ],
        },
      },
    ],
  },
  {
    courseSlug: L2,
    modules: [
      {
        title: 'Skin Structure & Function',
        summary: 'Know the skin’s layers and what each one does — the base every treatment builds on.',
        lessons: [
          {
            title: 'The Skin’s Layers',
            durationMin: 10,
            objectives: ['Name the three main skin layers', 'Place the epidermis and dermis', 'Say what sits in each'],
            studyTips: ['Epidermis = top barrier; dermis = the “working” layer with collagen and vessels.'],
            examRefs: ['Skin structure'],
            steps: [
              { kind: 'say', text: 'Everything we do happens in the skin — so let’s open it up.', mood: 'happy' },
              { kind: 'teach', title: 'Three layers', text: 'Skin has three main layers: the epidermis on top, the dermis beneath it, and the fatty hypodermis below that.', art: 'skin-layers' },
              { kind: 'ask', prompt: 'The top layer of skin is the…', qtype: 'WORD', options: ['epidermis', 'dermis', 'hypodermis'], correct: [0], explanation: 'Epidermis = the outer barrier.' },
              { kind: 'teach', title: 'The barrier', text: 'The epidermis is the protective barrier — it holds the melanin that gives skin its colour and shields against UV.' },
              { kind: 'ask', prompt: 'Melanin, which gives skin colour, sits mainly in the…', qtype: 'SINGLE', options: ['Epidermis', 'Hypodermis', 'Bone', 'Hair shaft only'], correct: [0], explanation: 'Melanocytes live in the epidermis.' },
              { kind: 'say', text: 'Now the busy layer underneath.', mood: 'cheer' },
              { kind: 'teach', title: 'The working layer', text: 'The dermis holds collagen, elastin, blood vessels, nerves and glands — it’s where most treatments do their real work.', art: 'skin-layers' },
              { kind: 'ask', prompt: 'Collagen and blood vessels sit mainly in the…', qtype: 'SINGLE', options: ['Dermis', 'Epidermis', 'Air', 'Nail'], correct: [0], explanation: 'The dermis is the structural, vascular layer.' },
              { kind: 'say', text: 'Layers sorted — strong foundation.', mood: 'cheer' },
            ],
          },
          {
            title: 'What Skin Does',
            durationMin: 9,
            objectives: ['List skin’s main jobs', 'Link structure to function', 'See why healthy skin matters for treatment'],
            examRefs: ['Skin function'],
            steps: [
              { kind: 'say', text: 'Skin isn’t just a wrapper — it’s working hard. Let’s see how.', mood: 'happy' },
              { kind: 'teach', title: 'Many jobs', text: 'Skin protects against germs and injury, senses touch and temperature, controls heat, and helps make vitamin D.' },
              { kind: 'ask', prompt: 'Which are real jobs of the skin?', qtype: 'MULTI', options: ['Protection', 'Sensation', 'Temperature control', 'Digesting food'], correct: [0, 1, 2], explanation: 'Digestion isn’t one of them.' },
              { kind: 'teach', title: 'Cools and warms', text: 'Sweat glands and surface vessels let skin cool you down or hold heat in — that’s why a treated area can look flushed.' },
              { kind: 'ask', prompt: 'Skin helps control body…', qtype: 'WORD', options: ['temperature', 'weight', 'eyesight'], correct: [0], explanation: 'Thermoregulation.' },
              { kind: 'teach', title: 'Why it matters', text: 'Healthy, intact skin heals better and reacts more predictably — broken or compromised skin is a reason to pause.' },
              { kind: 'say', text: 'You now read skin like a pro. Lovely.', mood: 'cheer' },
            ],
          },
        ],
        quiz: {
          title: 'Skin Structure Assessment', passMark: 70,
          questions: [
            { prompt: 'The skin’s three main layers, top to bottom, are…', type: 'SINGLE', options: ['Epidermis, dermis, hypodermis', 'Dermis, epidermis, bone', 'Hypodermis, dermis, epidermis', 'Epidermis, bone, fat'], correct: [0], explanation: 'Epidermis → dermis → hypodermis.' },
            { prompt: 'The outer barrier layer is the…', type: 'WORD', options: ['epidermis', 'dermis', 'hypodermis'], correct: [0], explanation: 'The epidermis.' },
            { prompt: 'Collagen, vessels and nerves sit mainly in the…', type: 'SINGLE', options: ['Dermis', 'Epidermis', 'Hair', 'Nail'], correct: [0], explanation: 'The dermis is the working layer.' },
            { prompt: 'Which are real functions of skin?', type: 'MULTI', options: ['Protection', 'Sensation', 'Temperature control', 'Pumping blood'], correct: [0, 1, 2], explanation: 'The heart pumps blood, not skin.' },
            { prompt: 'Melanin is produced mainly in the epidermis.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'Melanocytes live there.' },
            { prompt: 'Broken or compromised skin is a reason to pause a treatment.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'Intact skin heals and reacts more predictably.' },
          ],
        },
      },
    ],
  },
  {
    courseSlug: 'level-3-laser-aesthetic-therapies',
    modules: [
      {
        title: 'Laser & Light Devices',
        summary: 'Tell the main devices apart and match the right one to each job.',
        lessons: [
          {
            title: 'Types of Device',
            durationMin: 10,
            objectives: ['Distinguish IPL from laser', 'Name common laser types', 'Link each to a typical use'],
            studyTips: ['IPL = many wavelengths (broad-band); a laser = one wavelength.'],
            examRefs: ['Laser & light devices'],
            steps: [
              { kind: 'say', text: 'Lots of machines, one set of rules. Let’s line them up.', mood: 'happy' },
              { kind: 'teach', title: 'IPL vs laser', text: 'IPL sends out many wavelengths at once (broad-band light); a laser sends a single, precise wavelength.', art: 'light-spectrum' },
              { kind: 'ask', prompt: 'A laser emits…', qtype: 'SINGLE', options: ['One wavelength', 'Many wavelengths', 'No light', 'Only heat'], correct: [0], explanation: 'Single wavelength — IPL is the broad-band one.' },
              { kind: 'teach', title: 'The common lasers', text: 'Common types are Diode and Alexandrite (often hair removal) and Nd:YAG, which goes deeper and suits darker skin and vascular work.', art: 'light-spectrum' },
              { kind: 'ask', prompt: 'Which laser penetrates deepest and suits darker skin?', qtype: 'SINGLE', options: ['Nd:YAG', 'Alexandrite', 'Diode', 'IPL'], correct: [0], explanation: 'Longer wavelength = deeper, safer in higher skin types.' },
              { kind: 'say', text: 'Names down — now what they’re for.', mood: 'cheer' },
              { kind: 'teach', title: 'Right tool, right job', text: 'No single device does everything — the skill is matching the machine to the target and the skin type.' },
              { kind: 'ask', prompt: 'One device can safely do every job on every skin.', qtype: 'TRUEFALSE', options: ['False', 'True'], correct: [0], explanation: 'You match device to target and skin type.' },
              { kind: 'say', text: 'Device sense unlocked. Nice work.', mood: 'cheer' },
            ],
          },
          {
            title: 'Matching Device to Job',
            durationMin: 9,
            objectives: ['Connect wavelength to depth', 'Pick by chromophore', 'Factor in skin type'],
            studyTips: ['Longer wavelength → deeper penetration.'],
            examRefs: ['Laser & light devices'],
            steps: [
              { kind: 'say', text: 'Now let’s choose wisely for a real client.', mood: 'think' },
              { kind: 'teach', title: 'Wavelength and depth', text: 'Longer wavelengths reach deeper. So the target’s depth helps decide which device and setting you reach for.' },
              { kind: 'ask', prompt: 'A longer wavelength generally reaches…', qtype: 'WORD', options: ['deeper', 'shallower', 'nowhere'], correct: [0], explanation: 'Depth rises with wavelength.' },
              { kind: 'teach', title: 'Follow the chromophore', text: 'Match the device to the chromophore — melanin for hair and pigment, haemoglobin for vessels.' },
              { kind: 'ask', prompt: 'For thread veins, the target chromophore is…', qtype: 'WORD', options: ['haemoglobin', 'melanin', 'water'], correct: [0], explanation: 'Vascular work targets haemoglobin.' },
              { kind: 'teach', title: 'Skin type guards safety', text: 'Higher Fitzpatrick types favour longer wavelengths (like Nd:YAG) and gentler settings to protect surface melanin.' },
              { kind: 'say', text: 'You can pick the right machine now. Brilliant.', mood: 'cheer' },
            ],
          },
        ],
        quiz: {
          title: 'Devices Assessment', passMark: 70,
          questions: [
            { prompt: 'IPL differs from a laser because it emits…', type: 'SINGLE', options: ['Many wavelengths', 'One wavelength', 'No light', 'Sound'], correct: [0], explanation: 'IPL is broad-band; a laser is single-wavelength.' },
            { prompt: 'Which laser penetrates deepest and is safer in darker skin?', type: 'SINGLE', options: ['Nd:YAG', 'Alexandrite', 'Diode', 'IPL'], correct: [0], explanation: 'Longer wavelength, deeper, gentler on surface melanin.' },
            { prompt: 'A longer wavelength reaches deeper into the skin.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'Depth rises with wavelength.' },
            { prompt: 'For vascular (thread vein) work the target is…', type: 'WORD', options: ['haemoglobin', 'melanin', 'water'], correct: [0], explanation: 'Haemoglobin.' },
            { prompt: 'Which factors guide device choice?', type: 'MULTI', options: ['Target depth', 'Chromophore', 'Skin type', 'The client’s star sign'], correct: [0, 1, 2], explanation: 'Depth, chromophore and skin type — not astrology.' },
            { prompt: 'One device can safely treat everything on every skin type.', type: 'TRUEFALSE', options: ['False', 'True'], correct: [0], explanation: 'Match the tool to the job.' },
          ],
        },
      },
    ],
  },
  {
    courseSlug: 'level-4-certificate-aesthetic-practice',
    modules: [
      {
        title: 'Consent, Capacity & Expectations',
        summary: 'Take consent properly, check capacity, and set expectations you can meet.',
        lessons: [
          {
            title: 'Informed Consent',
            durationMin: 10,
            objectives: ['Define informed consent', 'List what must be explained', 'Know consent is ongoing'],
            studyTips: ['Consent must be informed, voluntary and ongoing — a signature alone isn’t consent.'],
            examRefs: ['Consent'],
            steps: [
              { kind: 'say', text: 'Consent is the cornerstone — let’s get it right.', mood: 'think' },
              { kind: 'teach', title: 'What it means', text: 'Informed consent means the client understands the procedure, the risks, the alternatives and the cost — and agrees freely.', art: 'safety' },
              { kind: 'ask', prompt: 'Informed consent must cover…', qtype: 'MULTI', options: ['The procedure', 'The risks', 'The alternatives', 'Your lunch plans'], correct: [0, 1, 2], explanation: 'Procedure, risks and alternatives — not small talk.' },
              { kind: 'teach', title: 'A signature isn’t enough', text: 'A signed form alone isn’t consent — the conversation and understanding are what count.' },
              { kind: 'ask', prompt: 'A signed form by itself counts as full consent.', qtype: 'TRUEFALSE', options: ['False', 'True'], correct: [0], explanation: 'Understanding, not just a signature.' },
              { kind: 'say', text: 'Now — consent doesn’t stop at the form.', mood: 'happy' },
              { kind: 'teach', title: 'It’s ongoing', text: 'Consent is ongoing: a client can change their mind at any point, and you stop.' },
              { kind: 'ask', prompt: 'A client can withdraw consent…', qtype: 'SINGLE', options: ['At any time', 'Never', 'Only at the start', 'Only in writing a week ahead'], correct: [0], explanation: 'They can stop at any point.' },
              { kind: 'say', text: 'Consent: properly understood. Excellent.', mood: 'cheer' },
            ],
          },
          {
            title: 'Capacity & Realistic Expectations',
            durationMin: 9,
            objectives: ['Explain mental capacity', 'Spot when to pause', 'Set honest expectations'],
            studyTips: ['No capacity, or under-18 for cosmetic work → don’t proceed.'],
            examRefs: ['Capacity / expectations'],
            steps: [
              { kind: 'say', text: 'Two more things that keep clients safe.', mood: 'think' },
              { kind: 'teach', title: 'Capacity', text: 'Capacity means the client can understand, retain and weigh the information and communicate a decision. Without it, you don’t proceed.' },
              { kind: 'ask', prompt: 'If a client lacks capacity to decide, you should…', qtype: 'SINGLE', options: ['Not proceed', 'Proceed anyway', 'Ask a stranger', 'Guess for them'], correct: [0], explanation: 'No capacity → no treatment.' },
              { kind: 'teach', title: 'Honest expectations', text: 'Promise only what the treatment can realistically deliver — over-promising sets up disappointment and complaints.' },
              { kind: 'ask', prompt: 'Over-promising results tends to lead to…', qtype: 'MULTI', options: ['Disappointment', 'Complaints', 'Loss of trust', 'Guaranteed success'], correct: [0, 1, 2], explanation: 'It rarely ends well.' },
              { kind: 'teach', title: 'Document it', text: 'Record what you discussed, what you agreed and any expectations set — your notes protect both of you.' },
              { kind: 'say', text: 'Safe, honest, well-recorded. That’s the standard.', mood: 'cheer' },
            ],
          },
        ],
        quiz: {
          title: 'Consent Assessment', passMark: 70,
          questions: [
            { prompt: 'Informed consent must be explained to include…', type: 'MULTI', options: ['The procedure', 'The risks', 'The alternatives', 'Nothing in particular'], correct: [0, 1, 2], explanation: 'Procedure, risks, alternatives.' },
            { prompt: 'A signed form on its own is full consent.', type: 'TRUEFALSE', options: ['False', 'True'], correct: [0], explanation: 'Understanding matters, not just a signature.' },
            { prompt: 'A client can withdraw consent…', type: 'SINGLE', options: ['At any time', 'Never', 'Only before booking', 'Only in writing'], correct: [0], explanation: 'At any point.' },
            { prompt: 'If a client lacks capacity to decide, you…', type: 'SINGLE', options: ['Do not proceed', 'Proceed anyway', 'Decide for them', 'Ignore it'], correct: [0], explanation: 'No capacity → no treatment.' },
            { prompt: 'Over-promising results can cause…', type: 'MULTI', options: ['Disappointment', 'Complaints', 'Lost trust', 'Better outcomes'], correct: [0, 1, 2], explanation: 'It harms trust, not outcomes.' },
            { prompt: 'What you discussed and agreed should be documented.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'Notes protect everyone.' },
          ],
        },
      },
    ],
  },
  {
    courseSlug: L2,
    modules: [
      {
        title: 'Contraindications & When to Refer',
        summary: 'Spot when a treatment should wait, adapt, or stop — and when to send the client elsewhere.',
        lessons: [
          {
            title: 'Absolute vs Relative',
            durationMin: 10,
            objectives: ['Define a contraindication', 'Tell absolute from relative', 'Know what each means for treatment'],
            studyTips: ['Absolute = never treat; relative = treat with caution or after advice.'],
            examRefs: ['Contraindications'],
            steps: [
              { kind: 'say', text: 'Knowing when NOT to treat is as skilled as treating. Let’s learn it.', mood: 'think' },
              { kind: 'teach', title: 'What it means', text: 'A contraindication is a reason a treatment may not be safe. Some are absolute (never treat) and some are relative (proceed with care or advice).', art: 'safety' },
              { kind: 'ask', prompt: 'An “absolute” contraindication means you…', qtype: 'SINGLE', options: ['Do not treat', 'Treat carefully', 'Treat faster', 'Charge more'], correct: [0], explanation: 'Absolute = do not treat.' },
              { kind: 'teach', title: 'Relative ones', text: 'A relative contraindication means treat with caution, lower settings, or only after a GP’s advice — not an automatic no.' },
              { kind: 'ask', prompt: 'A “relative” contraindication means…', qtype: 'WORD', options: ['caution', 'never', 'always'], correct: [0], explanation: 'Proceed with caution or advice.' },
              { kind: 'say', text: 'Clear line drawn. Now some real examples.', mood: 'cheer' },
              { kind: 'teach', title: 'Common examples', text: 'Active infection, certain medications, recent sun or fake tan, and some skin conditions are common reasons to pause or adapt.' },
              { kind: 'ask', prompt: 'Which can be reasons to pause or adapt a treatment?', qtype: 'MULTI', options: ['Active infection', 'Recent sunburn', 'Certain medications', 'Wearing a blue top'], correct: [0, 1, 2], explanation: 'Clothing colour isn’t a contraindication.' },
              { kind: 'say', text: 'Sharp judgement — that keeps clients safe.', mood: 'cheer' },
            ],
          },
          {
            title: 'When to Refer',
            durationMin: 9,
            objectives: ['Recognise out-of-scope situations', 'Refer suspicious signs', 'Record the decision'],
            studyTips: ['Anything you’re not sure is safe or normal → refer.'],
            examRefs: ['Referral'],
            steps: [
              { kind: 'say', text: 'Sometimes the safest treatment is none — and a referral.', mood: 'think' },
              { kind: 'teach', title: 'Out of your scope', text: 'If something is outside your training, or a sign looks medical, refer to a GP or specialist rather than treating.' },
              { kind: 'ask', prompt: 'A changing or suspicious mole should be…', qtype: 'SINGLE', options: ['Referred to a doctor', 'Lasered off', 'Ignored', 'Covered up'], correct: [0], explanation: 'Refer suspicious lesions, never treat them.' },
              { kind: 'teach', title: 'Be honest, be safe', text: 'Explain clearly why you’re referring — clients respect honesty, and it protects them and you.' },
              { kind: 'ask', prompt: 'Referring a client when unsure protects…', qtype: 'MULTI', options: ['The client', 'You', 'Your insurance position', 'Nobody'], correct: [0, 1, 2], explanation: 'It protects everyone involved.' },
              { kind: 'teach', title: 'Write it down', text: 'Record what you saw, what you advised and that you referred — your notes show you acted properly.' },
              { kind: 'say', text: 'Safe, honest, documented. Textbook.', mood: 'cheer' },
            ],
          },
        ],
        quiz: {
          title: 'Contraindications Assessment', passMark: 70,
          questions: [
            { prompt: 'An absolute contraindication means you…', type: 'SINGLE', options: ['Do not treat', 'Treat with caution', 'Treat faster', 'Refer for fun'], correct: [0], explanation: 'Never treat.' },
            { prompt: 'A relative contraindication means proceed with…', type: 'WORD', options: ['caution', 'speed', 'pride'], correct: [0], explanation: 'Caution or advice.' },
            { prompt: 'Which can be reasons to pause or adapt treatment?', type: 'MULTI', options: ['Active infection', 'Recent sunburn', 'Certain medications', 'A blue top'], correct: [0, 1, 2], explanation: 'Clothing isn’t one.' },
            { prompt: 'A suspicious, changing mole should be…', type: 'SINGLE', options: ['Referred to a doctor', 'Treated at once', 'Ignored', 'Frozen'], correct: [0], explanation: 'Refer, never treat.' },
            { prompt: 'If something is outside your training, you should refer.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'Stay within scope.' },
            { prompt: 'Referral decisions should be documented.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'Notes show you acted properly.' },
          ],
        },
      },
    ],
  },
  {
    courseSlug: 'level-3-laser-aesthetic-therapies',
    modules: [
      {
        title: 'Tattoo Removal',
        summary: 'Understand how lasers fade tattoos and how to run a realistic course.',
        lessons: [
          {
            title: 'How It Works',
            durationMin: 10,
            objectives: ['Explain ink shattering', 'Name the laser type used', 'Know the body clears the ink'],
            studyTips: ['Q-switched / picosecond lasers shatter ink; the body clears the fragments.'],
            examRefs: ['Tattoo removal'],
            steps: [
              { kind: 'say', text: 'Tattoo removal is clever physics. Let’s see how it fades ink.', mood: 'happy' },
              { kind: 'teach', title: 'Shatter the ink', text: 'A very fast, high-power pulse (Q-switched or picosecond laser) shatters tattoo ink into tiny fragments.', art: 'light-spectrum' },
              { kind: 'ask', prompt: 'Tattoo-removal lasers work by…', qtype: 'SINGLE', options: ['Shattering ink into fragments', 'Bleaching the skin', 'Cutting it out', 'Sanding the skin'], correct: [0], explanation: 'Ultra-short pulses break the ink apart.' },
              { kind: 'teach', title: 'The body clears it', text: 'Your immune system then carries the tiny ink fragments away over the following weeks — that’s why fading is gradual.' },
              { kind: 'ask', prompt: 'After the laser shatters the ink, it’s removed by the body’s…', qtype: 'WORD', options: ['immune', 'digestive', 'nervous'], correct: [0], explanation: 'The immune system clears the fragments.' },
              { kind: 'say', text: 'Physics plus biology — neat. Now the catches.', mood: 'cheer' },
              { kind: 'teach', title: 'Colours differ', text: 'Black ink responds best; some colours (greens, light blues, yellows) are stubborn — set expectations honestly.' },
              { kind: 'ask', prompt: 'Which tattoo ink colour usually responds best?', qtype: 'SINGLE', options: ['Black', 'Yellow', 'Light green', 'White'], correct: [0], explanation: 'Black absorbs across wavelengths.' },
              { kind: 'say', text: 'You get the science now. Lovely.', mood: 'cheer' },
            ],
          },
          {
            title: 'Running a Removal Course',
            durationMin: 9,
            objectives: ['Explain why many sessions', 'Space sessions safely', 'Set honest timelines'],
            studyTips: ['Removal takes many sessions, spaced 6–8 weeks, over many months.'],
            examRefs: ['Tattoo removal'],
            steps: [
              { kind: 'say', text: 'Now — managing a real removal journey.', mood: 'think' },
              { kind: 'teach', title: 'Many sessions', text: 'Removal needs several sessions, because each one only fades part of the ink and the skin must recover between visits.' },
              { kind: 'ask', prompt: 'Tattoo removal usually needs…', qtype: 'SINGLE', options: ['Several sessions', 'One session', 'No sessions', 'A hundred sessions'], correct: [0], explanation: 'Multiple, spaced sessions.' },
              { kind: 'teach', title: 'Space them out', text: 'Sessions are spaced several weeks apart to let skin heal and the body clear the last lot of fragments.' },
              { kind: 'ask', prompt: 'Sessions are spaced several ___ apart to let skin heal.', qtype: 'WORD', options: ['weeks', 'minutes', 'years'], correct: [0], explanation: 'Typically 6–8 weeks.' },
              { kind: 'teach', title: 'Honest timelines', text: 'Be clear it can take many months and full removal isn’t always possible — manage expectations from session one.' },
              { kind: 'say', text: 'Realistic, safe, well-paced. Brilliant.', mood: 'cheer' },
            ],
          },
        ],
        quiz: {
          title: 'Tattoo Removal Assessment', passMark: 70,
          questions: [
            { prompt: 'Tattoo-removal lasers work by…', type: 'SINGLE', options: ['Shattering ink into fragments', 'Bleaching skin', 'Cutting ink out', 'Sanding skin'], correct: [0], explanation: 'Ultra-short pulses break ink apart.' },
            { prompt: 'The shattered ink is cleared by the body’s…', type: 'WORD', options: ['immune', 'digestive', 'skeletal'], correct: [0], explanation: 'The immune system.' },
            { prompt: 'Which ink colour usually responds best?', type: 'SINGLE', options: ['Black', 'Yellow', 'Light green', 'White'], correct: [0], explanation: 'Black absorbs best.' },
            { prompt: 'Tattoo removal usually needs several sessions.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'Each fades part of the ink.' },
            { prompt: 'Sessions are spaced several weeks apart to let skin heal.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'Healing and clearance need time.' },
            { prompt: 'Full removal of every tattoo is always guaranteed.', type: 'TRUEFALSE', options: ['False', 'True'], correct: [0], explanation: 'Some colours/inks never fully clear.' },
          ],
        },
      },
    ],
  },
  {
    courseSlug: 'advanced-aesthetics-level-5-7',
    modules: [
      {
        title: 'Professional Practice, Insurance & CPD',
        summary: 'Run a safe, legal, continually improving practice.',
        lessons: [
          {
            title: 'Insurance & Records',
            durationMin: 10,
            objectives: ['Explain why insurance matters', 'Know record-keeping basics', 'Understand retention'],
            studyTips: ['No valid insurance = don’t treat. Keep records for the required retention period.'],
            examRefs: ['Professional practice'],
            steps: [
              { kind: 'say', text: 'The business side keeps you safe too. Let’s cover the essentials.', mood: 'think' },
              { kind: 'teach', title: 'Be insured', text: 'You need valid treatment and public liability insurance for every procedure you offer — without it, don’t treat.' },
              { kind: 'ask', prompt: 'You should treat only when you hold…', qtype: 'SINGLE', options: ['Valid insurance for the procedure', 'A nice room', 'A new machine', 'A busy diary'], correct: [0], explanation: 'Valid, relevant insurance is essential.' },
              { kind: 'teach', title: 'Good records', text: 'Keep clear records: consent, consultation, settings used, batch numbers and aftercare given — they protect you if questioned.' },
              { kind: 'ask', prompt: 'Which belong in good treatment records?', qtype: 'MULTI', options: ['Consent', 'Settings used', 'Aftercare given', 'Your horoscope'], correct: [0, 1, 2], explanation: 'Clinical facts, not astrology.' },
              { kind: 'teach', title: 'Keep them safely', text: 'Records must be stored securely and kept for the required retention period, then disposed of properly.' },
              { kind: 'ask', prompt: 'Client records must be stored…', qtype: 'WORD', options: ['securely', 'publicly', 'briefly'], correct: [0], explanation: 'Securely, for the retention period.' },
              { kind: 'say', text: 'Insured and organised — that’s professional.', mood: 'cheer' },
            ],
          },
          {
            title: 'CPD & Staying Current',
            durationMin: 9,
            objectives: ['Define CPD', 'Know why it matters', 'Plan ongoing learning'],
            studyTips: ['CPD = Continuing Professional Development — keeping skills and knowledge current.'],
            examRefs: ['CPD'],
            steps: [
              { kind: 'say', text: 'A great practitioner never stops learning. Here’s how.', mood: 'happy' },
              { kind: 'teach', title: 'What CPD is', text: 'CPD — Continuing Professional Development — means keeping your skills and knowledge up to date through ongoing learning.' },
              { kind: 'ask', prompt: 'CPD stands for Continuing Professional…', qtype: 'WORD', options: ['development', 'decoration', 'distance'], correct: [0], explanation: 'Development.' },
              { kind: 'teach', title: 'Why it matters', text: 'Devices, evidence and standards change — CPD keeps you safe, current and credible, and is expected by registers and insurers.' },
              { kind: 'ask', prompt: 'CPD helps you stay…', qtype: 'MULTI', options: ['Safe', 'Current', 'Credible', 'Out of date'], correct: [0, 1, 2], explanation: 'It does the opposite of going out of date.' },
              { kind: 'teach', title: 'Keep a record', text: 'Log your courses, reading and reflection — many registers ask to see your CPD record.' },
              { kind: 'say', text: 'You’ll keep growing for your whole career. Excellent.', mood: 'cheer' },
            ],
          },
        ],
        quiz: {
          title: 'Professional Practice Assessment', passMark: 70,
          questions: [
            { prompt: 'You should treat only when you hold…', type: 'SINGLE', options: ['Valid insurance for the procedure', 'A new machine', 'A full diary', 'A nice sign'], correct: [0], explanation: 'Valid, relevant insurance.' },
            { prompt: 'Which belong in good treatment records?', type: 'MULTI', options: ['Consent', 'Settings used', 'Aftercare given', 'Your horoscope'], correct: [0, 1, 2], explanation: 'Clinical facts.' },
            { prompt: 'Client records must be stored…', type: 'WORD', options: ['securely', 'publicly', 'loosely'], correct: [0], explanation: 'Securely for the retention period.' },
            { prompt: 'CPD stands for Continuing Professional…', type: 'WORD', options: ['development', 'decoration', 'driving'], correct: [0], explanation: 'Development.' },
            { prompt: 'CPD helps you stay safe, current and credible.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'It keeps you up to date.' },
            { prompt: 'You should keep a record of your CPD.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'Registers may ask to see it.' },
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
  { courseSlug: L2, topic: 'Hygiene', prompt: 'Used needles are disposed of in a…', options: ['Sharps bin', 'General bin', 'Recycling', 'Pocket'], correct: [0], explanation: 'Sharps bin prevents needlestick injury.' },
  { courseSlug: L2, topic: 'Hygiene', prompt: 'Couch roll should be replaced…', type: 'WORD', options: ['between clients', 'weekly', 'never'], correct: [0], explanation: 'Fresh per client.' },
  { courseSlug: L2, topic: 'Hygiene', prompt: 'Which is NOT good infection control?', options: ['Reusing an unwashed tool', 'Hand hygiene', 'Single-use sharps', 'Disinfecting surfaces'], correct: [0], explanation: 'Never reuse unwashed tools.' },
  { courseSlug: 'level-3-laser-aesthetic-therapies', topic: 'Rejuvenation', prompt: 'Skin rejuvenation mainly stimulates new…', type: 'WORD', options: ['collagen', 'melanin', 'sweat'], correct: [0], explanation: 'Neocollagenesis.' },
  { courseSlug: 'level-3-laser-aesthetic-therapies', topic: 'Planning', prompt: 'Fluence is best described as…', options: ['Energy delivered (J/cm²)', 'Wavelength', 'Pulse count', 'Skin type'], correct: [0], explanation: 'Energy density.' },
  { courseSlug: 'level-3-laser-aesthetic-therapies', topic: 'Planning', prompt: 'Too-high fluence mainly risks…', options: ['Burns', 'Better results', 'Nothing', 'Faster hair growth'], correct: [0], explanation: 'Build energy cautiously.' },
  { courseSlug: 'level-3-laser-aesthetic-therapies', topic: 'Rejuvenation', prompt: 'IPL photofacials can improve redness and pigmentation in one session.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'They even out tone.' },
  { courseSlug: 'advanced-aesthetics-level-5-7', topic: 'Reflection', prompt: 'Auditing your complication and re-treatment rates helps you…', options: ['Spot patterns and improve', 'Avoid records', 'Skip CPD', 'Work blindly'], correct: [0], explanation: 'Data drives improvement.' },
  { courseSlug: 'advanced-aesthetics-level-5-7', topic: 'Governance', prompt: 'The sector’s standards and register body is the…', type: 'WORD', options: ['JCCP', 'NHS', 'DVLA'], correct: [0], explanation: 'Joint Council for Cosmetic Practitioners.' },
  { courseSlug: 'advanced-aesthetics-level-5-7', topic: 'Leadership', prompt: 'A good safety culture…', options: ['Welcomes concerns being raised', 'Hides mistakes', 'Blames staff', 'Skips consent'], correct: [0], explanation: 'Openness and learning.' },
  { courseSlug: L2, topic: 'Fitzpatrick', prompt: 'The Fitzpatrick scale sorts skin by its response to…', type: 'WORD', options: ['sun', 'water', 'cold'], correct: [0], explanation: 'It’s graded by reaction to UV.' },
  { courseSlug: L2, topic: 'Fitzpatrick', prompt: 'Type VI skin…', options: ['Is deeply pigmented and rarely burns', 'Always burns', 'Has no melanin', 'Is the fairest'], correct: [0], explanation: 'Type VI is the most pigmented end of the scale.' },
  { courseSlug: L2, topic: 'Fitzpatrick', prompt: 'If a client sits between two skin types, choose the…', options: ['Lower-energy, more cautious option', 'Higher-energy option', 'Average price', 'Quicker setting'], correct: [0], explanation: 'Default to caution when unsure.' },
  { courseSlug: 'level-4-certificate-aesthetic-practice', topic: 'Anatomy', prompt: 'In order from the surface inward, the face layers run…', options: ['Skin → fat → muscle (SMAS) → vessels/nerves', 'Bone → skin → fat', 'Muscle → skin → fat', 'Hair → bone → skin'], correct: [0], explanation: 'Skin, fat, the SMAS, then deeper vessels and nerves.' },
  { courseSlug: 'level-4-certificate-aesthetic-practice', topic: 'Anatomy', prompt: 'The SMAS is the face’s…', type: 'WORD', options: ['muscular', 'bony', 'fatty'], correct: [0], explanation: 'The muscular/fibrous layer.' },
  { courseSlug: 'level-4-certificate-aesthetic-practice', topic: 'Danger zones', prompt: 'Areas where extra care is needed because vessels and nerves sit close to the surface include…', type: 'MULTI', options: ['Around the eyes', 'The temples', 'The nasal area', 'The mid-cheek only'], correct: [0, 1, 2], explanation: 'Eyes, temples and the nasal area are higher-risk.' },
  { courseSlug: 'level-3-laser-aesthetic-therapies', topic: 'Hair removal', prompt: 'Laser hair removal responds best when the hair is…', options: ['Dark', 'Grey', 'White', 'Very fair'], correct: [0], explanation: 'Dark hair holds the melanin the laser targets.' },
  { courseSlug: 'level-3-laser-aesthetic-therapies', topic: 'Hair removal', prompt: 'Only follicles in the active growth phase respond — that phase is called…', type: 'WORD', options: ['anagen', 'telogen', 'catagen'], correct: [0], explanation: 'Anagen is the active, pigmented, connected phase.' },
  { courseSlug: 'level-3-laser-aesthetic-therapies', topic: 'Hair removal', prompt: 'Higher Fitzpatrick types can never have laser hair removal.', type: 'TRUEFALSE', options: ['False', 'True'], correct: [0], explanation: 'They can — with the right device, adjusted settings and caution.' },
  { courseSlug: L2, topic: 'Skin structure', prompt: 'The skin’s outer barrier layer is the…', type: 'WORD', options: ['epidermis', 'dermis', 'hypodermis'], correct: [0], explanation: 'The epidermis sits on top.' },
  { courseSlug: L2, topic: 'Skin structure', prompt: 'Collagen, blood vessels and nerves sit mainly in the…', options: ['Dermis', 'Epidermis', 'Hypodermis', 'Hair shaft'], correct: [0], explanation: 'The dermis is the structural, vascular layer.' },
  { courseSlug: L2, topic: 'Skin function', prompt: 'Which are genuine jobs of the skin?', type: 'MULTI', options: ['Protection', 'Temperature control', 'Sensation', 'Digesting food'], correct: [0, 1, 2], explanation: 'Digestion isn’t a skin function.' },
  { courseSlug: 'level-3-laser-aesthetic-therapies', topic: 'Devices', prompt: 'IPL differs from a laser because it emits…', options: ['Many wavelengths (broad-band)', 'One wavelength', 'No light', 'Only sound'], correct: [0], explanation: 'IPL is broad-band; a laser is single-wavelength.' },
  { courseSlug: 'level-3-laser-aesthetic-therapies', topic: 'Devices', prompt: 'Which laser penetrates deepest and is safer in darker skin?', options: ['Nd:YAG', 'Alexandrite', 'Diode', 'IPL'], correct: [0], explanation: 'Longer wavelength, deeper, gentler on surface melanin.' },
  { courseSlug: 'level-3-laser-aesthetic-therapies', topic: 'Devices', prompt: 'A longer wavelength generally penetrates…', type: 'WORD', options: ['deeper', 'shallower', 'sideways'], correct: [0], explanation: 'Depth rises with wavelength.' },
  { courseSlug: 'level-4-certificate-aesthetic-practice', topic: 'Consent', prompt: 'For consent to be valid it must be…', type: 'MULTI', options: ['Informed', 'Voluntary', 'Ongoing', 'Secret'], correct: [0, 1, 2], explanation: 'Informed, voluntary and ongoing.' },
  { courseSlug: 'level-4-certificate-aesthetic-practice', topic: 'Consent', prompt: 'A client may withdraw consent…', options: ['At any time', 'Never', 'Only before paying', 'Only in writing'], correct: [0], explanation: 'They can stop at any point.' },
  { courseSlug: 'level-4-certificate-aesthetic-practice', topic: 'Capacity', prompt: 'If a client lacks the mental capacity to decide, you should…', options: ['Not proceed', 'Proceed anyway', 'Decide for them', 'Ask a bystander'], correct: [0], explanation: 'No capacity means no treatment.' },
  { courseSlug: L2, topic: 'Contraindications', prompt: 'An absolute contraindication means you…', options: ['Do not treat', 'Treat with caution', 'Treat faster', 'Charge more'], correct: [0], explanation: 'Absolute = never treat.' },
  { courseSlug: L2, topic: 'Contraindications', prompt: 'A relative contraindication means proceed with…', type: 'WORD', options: ['caution', 'speed', 'confidence'], correct: [0], explanation: 'Caution or after advice.' },
  { courseSlug: L2, topic: 'Referral', prompt: 'A suspicious, changing mole should be…', options: ['Referred to a doctor', 'Treated at once', 'Ignored', 'Lasered'], correct: [0], explanation: 'Refer suspicious lesions; never treat them.' },
  { courseSlug: 'level-3-laser-aesthetic-therapies', topic: 'Tattoo removal', prompt: 'Tattoo-removal lasers work by…', options: ['Shattering ink into tiny fragments', 'Bleaching the skin', 'Cutting the ink out', 'Sanding the skin'], correct: [0], explanation: 'Ultra-short pulses break the ink apart.' },
  { courseSlug: 'level-3-laser-aesthetic-therapies', topic: 'Tattoo removal', prompt: 'After shattering, ink fragments are cleared by the body’s ___ system.', type: 'WORD', options: ['immune', 'digestive', 'nervous'], correct: [0], explanation: 'The immune system carries them away.' },
  { courseSlug: 'level-3-laser-aesthetic-therapies', topic: 'Tattoo removal', prompt: 'Which tattoo-ink colour usually responds best to laser?', options: ['Black', 'Yellow', 'Light green', 'White'], correct: [0], explanation: 'Black absorbs across wavelengths.' },
  { courseSlug: 'advanced-aesthetics-level-5-7', topic: 'Professional practice', prompt: 'You should carry out a treatment only when you hold…', options: ['Valid insurance for that procedure', 'A new machine', 'A full diary', 'A nice sign'], correct: [0], explanation: 'Valid, relevant insurance is essential.' },
  { courseSlug: 'advanced-aesthetics-level-5-7', topic: 'Records', prompt: 'Client records must be stored…', type: 'WORD', options: ['securely', 'publicly', 'briefly'], correct: [0], explanation: 'Securely, for the required retention period.' },
  { courseSlug: 'advanced-aesthetics-level-5-7', topic: 'CPD', prompt: 'CPD stands for Continuing Professional…', type: 'WORD', options: ['development', 'decoration', 'distance'], correct: [0], explanation: 'Continuing Professional Development.' },
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
