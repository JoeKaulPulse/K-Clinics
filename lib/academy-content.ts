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
  {
    courseSlug: L2,
    modules: [
      {
        title: 'Client Care & Communication',
        summary: 'Make clients feel safe and informed — and handle concerns calmly.',
        lessons: [
          {
            title: 'A Great Consultation',
            durationMin: 10,
            objectives: ['Build rapport and trust', 'Listen and check understanding', 'Agree a realistic plan'],
            studyTips: ['Listen more than you talk; check the client has understood, not just heard.'],
            examRefs: ['Client care'],
            steps: [
              { kind: 'say', text: 'People remember how you made them feel. Let’s nail the consultation.', mood: 'happy' },
              { kind: 'teach', title: 'Make them comfortable', text: 'A warm welcome, eye contact and a calm tone help a client relax and speak openly about what they want.', art: 'concept' },
              { kind: 'ask', prompt: 'A good consultation starts by…', qtype: 'SINGLE', options: ['Making the client comfortable', 'Selling hard', 'Rushing', 'Talking over them'], correct: [0], explanation: 'Comfort and trust come first.' },
              { kind: 'teach', title: 'Listen and check', text: 'Ask open questions, listen carefully, then check the client has understood — don’t assume.' },
              { kind: 'ask', prompt: 'To be sure a client understands, you should…', qtype: 'SINGLE', options: ['Check their understanding', 'Assume they got it', 'Use jargon', 'Hurry on'], correct: [0], explanation: 'Confirm understanding, don’t assume.' },
              { kind: 'say', text: 'Now agree the plan together.', mood: 'cheer' },
              { kind: 'teach', title: 'Agree the plan', text: 'Summarise what you’ll do, the likely results and the cost, and agree it together before starting.' },
              { kind: 'ask', prompt: 'Before starting, you and the client should agree…', qtype: 'MULTI', options: ['The plan', 'Likely results', 'The cost', 'Their lunch'], correct: [0, 1, 2], explanation: 'Plan, results and cost.' },
              { kind: 'say', text: 'That’s consultation gold. Lovely.', mood: 'cheer' },
            ],
          },
          {
            title: 'Handling Concerns',
            durationMin: 9,
            objectives: ['Respond calmly to worries', 'Take complaints seriously', 'Know when to escalate'],
            studyTips: ['Listen, apologise where due, act — never get defensive.'],
            examRefs: ['Complaints'],
            steps: [
              { kind: 'say', text: 'Even great practitioners get concerns. Here’s how to handle them well.', mood: 'think' },
              { kind: 'teach', title: 'Stay calm', text: 'If a client is worried or unhappy, listen fully and stay calm — don’t get defensive or dismiss them.' },
              { kind: 'ask', prompt: 'When a client raises a concern, you should first…', qtype: 'SINGLE', options: ['Listen calmly', 'Argue back', 'Ignore it', 'Walk off'], correct: [0], explanation: 'Listen first, always.' },
              { kind: 'teach', title: 'Act on it', text: 'Acknowledge their concern, apologise where appropriate, and explain what you’ll do about it.' },
              { kind: 'ask', prompt: 'A good response to a complaint includes…', qtype: 'MULTI', options: ['Acknowledging it', 'A plan to put it right', 'Honesty', 'Blaming the client'], correct: [0, 1, 2], explanation: 'Own it and fix it — don’t blame.' },
              { kind: 'teach', title: 'Escalate and record', text: 'For anything clinical or serious, escalate to a senior or the client’s GP, and record what happened.' },
              { kind: 'say', text: 'Calm, fair, recorded — that builds trust for life.', mood: 'cheer' },
            ],
          },
        ],
        quiz: {
          title: 'Client Care Assessment', passMark: 70,
          questions: [
            { prompt: 'A good consultation starts by…', type: 'SINGLE', options: ['Making the client comfortable', 'Selling hard', 'Rushing through', 'Talking over them'], correct: [0], explanation: 'Comfort and trust first.' },
            { prompt: 'To be sure a client understands, you should…', type: 'SINGLE', options: ['Check their understanding', 'Assume it', 'Use jargon', 'Hurry'], correct: [0], explanation: 'Confirm, don’t assume.' },
            { prompt: 'Before starting you should agree the plan, results and…', type: 'WORD', options: ['cost', 'weather', 'menu'], correct: [0], explanation: 'Agree the cost too.' },
            { prompt: 'When a client raises a concern, first you should…', type: 'SINGLE', options: ['Listen calmly', 'Argue', 'Ignore it', 'Leave'], correct: [0], explanation: 'Listen first.' },
            { prompt: 'A good complaint response includes…', type: 'MULTI', options: ['Acknowledging it', 'Putting it right', 'Honesty', 'Blaming the client'], correct: [0, 1, 2], explanation: 'Own it, don’t blame.' },
            { prompt: 'Serious or clinical concerns should be escalated and recorded.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'Escalate and document.' },
          ],
        },
      },
    ],
  },
  {
    courseSlug: 'level-3-laser-aesthetic-therapies',
    modules: [
      {
        title: 'Acne & Scar Revision',
        summary: 'How light and laser calm active acne and soften scarring.',
        lessons: [
          {
            title: 'Treating Active Acne',
            durationMin: 10,
            objectives: ['Explain how light helps acne', 'Name the bacteria targeted', 'Set realistic expectations'],
            studyTips: ['Certain light wavelengths target acne bacteria and calm oil glands.'],
            examRefs: ['Acne treatment'],
            steps: [
              { kind: 'say', text: 'Acne is common and treatable — let’s see how light helps.', mood: 'happy' },
              { kind: 'teach', title: 'Light and bacteria', text: 'Certain wavelengths of light target the bacteria involved in acne and help calm the oil glands.', art: 'light-spectrum' },
              { kind: 'ask', prompt: 'Light-based acne treatment partly works by targeting…', qtype: 'SINGLE', options: ['Acne bacteria', 'Bone', 'Hair colour', 'Teeth'], correct: [0], explanation: 'It targets acne bacteria and oil glands.' },
              { kind: 'teach', title: 'Calm, not cure', text: 'It can reduce breakouts and redness, but acne is managed over time, often alongside skincare — not cured in one go.' },
              { kind: 'ask', prompt: 'Light therapy for acne is best described as…', qtype: 'SINGLE', options: ['Ongoing management', 'A one-session cure', 'Useless', 'Only for scars'], correct: [0], explanation: 'It’s managed over time.' },
              { kind: 'say', text: 'Honest framing keeps clients on side. Now scars.', mood: 'cheer' },
              { kind: 'teach', title: 'Set expectations', text: 'Explain it usually takes a course, and results vary — pair it with good skincare and patience.' },
              { kind: 'ask', prompt: 'Acne light treatment usually needs…', qtype: 'WORD', options: ['a course', 'one visit', 'no visits'], correct: [0], explanation: 'A course of sessions.' },
              { kind: 'say', text: 'You can guide an acne client well now. Lovely.', mood: 'cheer' },
            ],
          },
          {
            title: 'Softening Scars',
            durationMin: 9,
            objectives: ['Explain resurfacing', 'Link collagen to smoothing', 'Set honest limits'],
            studyTips: ['Resurfacing stimulates collagen to remodel scar tissue gradually.'],
            examRefs: ['Scar revision'],
            steps: [
              { kind: 'say', text: 'Scars rarely vanish — but we can soften them. Here’s how.', mood: 'think' },
              { kind: 'teach', title: 'Stimulate collagen', text: 'Resurfacing treatments create controlled micro-injury, prompting new collagen that remodels and smooths scar tissue.', art: 'collagen' },
              { kind: 'ask', prompt: 'Scar resurfacing works mainly by stimulating new…', qtype: 'WORD', options: ['collagen', 'melanin', 'bone'], correct: [0], explanation: 'Neocollagenesis smooths the scar.' },
              { kind: 'teach', title: 'Gradual change', text: 'Improvement builds over weeks and several sessions — it’s softening, not erasing.' },
              { kind: 'ask', prompt: 'Scar treatment aims to ___ scars, not erase them.', qtype: 'WORD', options: ['soften', 'colour', 'deepen'], correct: [0], explanation: 'Soften and smooth.' },
              { kind: 'teach', title: 'Be honest', text: 'Manage expectations: results vary with scar type and skin, and full removal usually isn’t possible.' },
              { kind: 'say', text: 'Realistic and skilled — that’s the standard.', mood: 'cheer' },
            ],
          },
        ],
        quiz: {
          title: 'Acne & Scars Assessment', passMark: 70,
          questions: [
            { prompt: 'Light-based acne treatment partly targets…', type: 'SINGLE', options: ['Acne bacteria', 'Bone', 'Hair colour', 'Teeth'], correct: [0], explanation: 'Bacteria and oil glands.' },
            { prompt: 'Acne light therapy is best described as…', type: 'SINGLE', options: ['Ongoing management', 'A one-off cure', 'Useless', 'Only for scars'], correct: [0], explanation: 'Managed over time.' },
            { prompt: 'Acne light treatment usually needs a course of sessions.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'Not one visit.' },
            { prompt: 'Scar resurfacing works mainly by stimulating new…', type: 'WORD', options: ['collagen', 'melanin', 'bone'], correct: [0], explanation: 'Collagen remodels the scar.' },
            { prompt: 'Scar treatment aims to soften scars, not erase them.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'Softening, not erasing.' },
            { prompt: 'Scar results are the same for everyone regardless of scar type.', type: 'TRUEFALSE', options: ['False', 'True'], correct: [0], explanation: 'Results vary with scar type and skin.' },
          ],
        },
      },
    ],
  },
  {
    courseSlug: 'level-4-certificate-aesthetic-practice',
    modules: [
      {
        title: 'Skin Ageing & Photodamage',
        summary: 'Understand why skin ages and how sun exposure drives most visible change.',
        lessons: [
          {
            title: 'Why Skin Ages',
            durationMin: 10,
            objectives: ['Tell intrinsic from extrinsic ageing', 'Link collagen loss to lines', 'Name the biggest external cause'],
            studyTips: ['Intrinsic = the genetic clock; extrinsic = sun, smoking, lifestyle.'],
            examRefs: ['Skin ageing'],
            steps: [
              { kind: 'say', text: 'Why does skin change with time? Two reasons. Let’s split them.', mood: 'think' },
              { kind: 'teach', title: 'Two kinds of ageing', text: 'Intrinsic ageing is the natural genetic clock; extrinsic ageing comes from outside factors like sun, smoking and lifestyle.', art: 'collagen' },
              { kind: 'ask', prompt: 'Ageing from sun and lifestyle is called…', qtype: 'WORD', options: ['extrinsic', 'intrinsic', 'instant'], correct: [0], explanation: 'Extrinsic = external causes.' },
              { kind: 'teach', title: 'Collagen falls', text: 'Over time collagen and elastin decline, so skin loses firmness and fine lines appear.' },
              { kind: 'ask', prompt: 'Lines and sagging are largely due to falling…', qtype: 'MULTI', options: ['Collagen', 'Elastin', 'Firmness', 'Bone density only'], correct: [0, 1, 2], explanation: 'Collagen/elastin loss reduces firmness.' },
              { kind: 'say', text: 'Now the single biggest driver you can control.', mood: 'cheer' },
              { kind: 'teach', title: 'The sun leads', text: 'The sun (UV) causes the majority of visible ageing — so sun protection is the most powerful anti-ageing step.' },
              { kind: 'ask', prompt: 'The biggest external cause of visible skin ageing is…', qtype: 'SINGLE', options: ['The sun (UV)', 'Cold weather', 'Reading', 'Water'], correct: [0], explanation: 'UV drives most photoageing.' },
              { kind: 'say', text: 'You understand ageing now. Brilliant.', mood: 'cheer' },
            ],
          },
          {
            title: 'Photodamage & Protection',
            durationMin: 9,
            objectives: ['Recognise signs of photodamage', 'Explain SPF’s role', 'Advise daily protection'],
            studyTips: ['Pigmentation, fine lines and rough texture are classic photodamage signs.'],
            examRefs: ['Photodamage'],
            steps: [
              { kind: 'say', text: 'Let’s spot sun damage and stop more of it.', mood: 'happy' },
              { kind: 'teach', title: 'Signs of photodamage', text: 'Sun damage shows as uneven pigmentation, fine lines, broken vessels and rough texture — often before deeper wrinkles.' },
              { kind: 'ask', prompt: 'Which are signs of photodamage?', qtype: 'MULTI', options: ['Uneven pigment', 'Fine lines', 'Rough texture', 'Stronger nails'], correct: [0, 1, 2], explanation: 'Nails aren’t a photodamage sign.' },
              { kind: 'teach', title: 'SPF every day', text: 'Daily broad-spectrum SPF is the simplest, most effective way to prevent further photoageing — even on cloudy days.' },
              { kind: 'ask', prompt: 'Daily SPF should be worn…', qtype: 'SINGLE', options: ['Even on cloudy days', 'Only on holiday', 'Never', 'Only at night'], correct: [0], explanation: 'UV reaches skin even through cloud.' },
              { kind: 'teach', title: 'Advise clients', text: 'Whatever treatment you give, reinforce daily SPF — it protects their results and their skin.' },
              { kind: 'say', text: 'Prevention plus treatment — that’s expert care.', mood: 'cheer' },
            ],
          },
        ],
        quiz: {
          title: 'Skin Ageing Assessment', passMark: 70,
          questions: [
            { prompt: 'Ageing from sun and lifestyle is called…', type: 'WORD', options: ['extrinsic', 'intrinsic', 'instant'], correct: [0], explanation: 'External causes.' },
            { prompt: 'The biggest external cause of visible ageing is…', type: 'SINGLE', options: ['The sun (UV)', 'Cold', 'Reading', 'Water'], correct: [0], explanation: 'UV drives photoageing.' },
            { prompt: 'Lines and sagging are largely due to falling collagen and elastin.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'They give skin firmness.' },
            { prompt: 'Which are signs of photodamage?', type: 'MULTI', options: ['Uneven pigment', 'Fine lines', 'Rough texture', 'Stronger nails'], correct: [0, 1, 2], explanation: 'Not nails.' },
            { prompt: 'Daily broad-spectrum SPF should be worn even on cloudy days.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'UV passes through cloud.' },
            { prompt: 'SPF is the single most effective anti-ageing step you can advise.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'Prevention beats correction.' },
          ],
        },
      },
    ],
  },
  {
    courseSlug: 'level-4-certificate-aesthetic-practice',
    modules: [
      {
        title: 'Skin Conditions & When to Adapt',
        summary: 'Recognise common skin conditions and decide whether to adapt, delay or refer.',
        lessons: [
          {
            title: 'Common Conditions',
            durationMin: 10,
            objectives: ['Recognise eczema, rosacea and psoriasis', 'Know they affect skin reactions', 'Spot what needs care'],
            studyTips: ['You don’t diagnose — you recognise, adapt and refer.'],
            examRefs: ['Skin conditions'],
            steps: [
              { kind: 'say', text: 'You’ll meet many skin types and conditions. Let’s learn to spot the common ones.', mood: 'think' },
              { kind: 'teach', title: 'Three you’ll see', text: 'Eczema (dry, itchy, inflamed), rosacea (facial redness and flushing) and psoriasis (raised, scaly patches) are common conditions you’ll encounter.' },
              { kind: 'ask', prompt: 'Facial redness and easy flushing is typical of…', qtype: 'SINGLE', options: ['Rosacea', 'Psoriasis', 'A healthy tan', 'Nothing'], correct: [0], explanation: 'Rosacea = redness and flushing.' },
              { kind: 'teach', title: 'Not your job to diagnose', text: 'You don’t diagnose conditions — but recognising them tells you when to adapt a treatment or refer.' },
              { kind: 'ask', prompt: 'Your role with a skin condition is to recognise, adapt and…', qtype: 'WORD', options: ['refer', 'diagnose', 'ignore'], correct: [0], explanation: 'Recognise, adapt, refer — not diagnose.' },
              { kind: 'say', text: 'Good eyes. Now what to do about it.', mood: 'cheer' },
              { kind: 'teach', title: 'They change reactions', text: 'Conditions and sensitive skin can change how skin reacts to treatment, so they always factor into your plan.' },
              { kind: 'ask', prompt: 'A known skin condition should…', qtype: 'SINGLE', options: ['Factor into your plan', 'Be ignored', 'Speed things up', 'Raise the price'], correct: [0], explanation: 'It shapes a safe plan.' },
              { kind: 'say', text: 'Sharp and safe. Lovely.', mood: 'cheer' },
            ],
          },
          {
            title: 'Adapt, Delay or Refer',
            durationMin: 9,
            objectives: ['Decide to adapt vs delay', 'Know when to refer', 'Record the reasoning'],
            studyTips: ['Active flare-up → delay; unsure or medical → refer.'],
            examRefs: ['Adapting treatment'],
            steps: [
              { kind: 'say', text: 'Three choices when something’s not quite right. Let’s sort them.', mood: 'happy' },
              { kind: 'teach', title: 'Adapt', text: 'For mild, stable conditions you may adapt — gentler settings, smaller area, or avoiding the affected patch.' },
              { kind: 'ask', prompt: 'For mild, stable skin you might…', qtype: 'SINGLE', options: ['Adapt the treatment', 'Refuse forever', 'Use maximum settings', 'Do nothing different'], correct: [0], explanation: 'Adapt gently.' },
              { kind: 'teach', title: 'Delay', text: 'If a condition is flaring or the skin is broken, delay until it settles — treating inflamed skin risks harm.' },
              { kind: 'ask', prompt: 'If skin is actively flaring or broken, you should…', qtype: 'WORD', options: ['delay', 'rush', 'ignore'], correct: [0], explanation: 'Wait until it settles.' },
              { kind: 'teach', title: 'Refer and record', text: 'If you’re unsure, or it looks medical, refer — and record what you saw and decided either way.' },
              { kind: 'say', text: 'Adapt, delay or refer — you’ve got it. Excellent.', mood: 'cheer' },
            ],
          },
        ],
        quiz: {
          title: 'Skin Conditions Assessment', passMark: 70,
          questions: [
            { prompt: 'Facial redness and easy flushing is typical of…', type: 'SINGLE', options: ['Rosacea', 'Psoriasis', 'A healthy tan', 'Nothing'], correct: [0], explanation: 'Rosacea.' },
            { prompt: 'Your role with a skin condition is to recognise, adapt and…', type: 'WORD', options: ['refer', 'diagnose', 'ignore'], correct: [0], explanation: 'Not diagnose.' },
            { prompt: 'A known skin condition should factor into your treatment plan.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'It shapes a safe plan.' },
            { prompt: 'For mild, stable conditions you might…', type: 'SINGLE', options: ['Adapt the treatment', 'Refuse forever', 'Use max settings', 'Change nothing'], correct: [0], explanation: 'Adapt gently.' },
            { prompt: 'If skin is actively flaring or broken, you should…', type: 'WORD', options: ['delay', 'rush', 'ignore'], correct: [0], explanation: 'Delay until settled.' },
            { prompt: 'Decisions to adapt, delay or refer should be recorded.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'Record your reasoning.' },
          ],
        },
      },
    ],
  },
  {
    courseSlug: 'level-3-laser-aesthetic-therapies',
    modules: [
      {
        title: 'Pre & Post Treatment Care',
        summary: 'Prepare skin properly and protect results with the right aftercare.',
        lessons: [
          {
            title: 'Preparing the Skin',
            durationMin: 10,
            objectives: ['List pre-treatment steps', 'Explain why no recent tan', 'Check skin is ready'],
            studyTips: ['Clean, shaved (for laser) and un-tanned skin is the safe starting point.'],
            examRefs: ['Pre-treatment'],
            steps: [
              { kind: 'say', text: 'Good results start before the device switches on. Let’s prep properly.', mood: 'happy' },
              { kind: 'teach', title: 'Clean and ready', text: 'Skin should be clean and free of make-up, lotions or deodorant, and for laser hair removal, shaved on the day.' },
              { kind: 'ask', prompt: 'For laser hair removal, skin should be ___ on the day.', qtype: 'WORD', options: ['shaved', 'waxed', 'plucked'], correct: [0], explanation: 'Shaved keeps the root for the laser; waxing/plucking removes it.' },
              { kind: 'teach', title: 'No recent tan', text: 'Avoid recent sun or fake tan — extra melanin in the skin raises the risk of burns and pigment changes.' },
              { kind: 'ask', prompt: 'Why avoid a recent tan before laser?', qtype: 'SINGLE', options: ['Higher burn/pigment risk', 'It looks nicer', 'It speeds things up', 'No reason'], correct: [0], explanation: 'Tanned skin holds more melanin to absorb the energy.' },
              { kind: 'say', text: 'Skin prepped and safe. Now protect the results.', mood: 'cheer' },
              { kind: 'teach', title: 'Final checks', text: 'Re-check the consultation, contraindications and consent before every session — not just the first.' },
              { kind: 'ask', prompt: 'Contraindications and consent are re-checked…', qtype: 'SINGLE', options: ['Before every session', 'Only the first time', 'Never again', 'Only if asked'], correct: [0], explanation: 'Things change — check each time.' },
              { kind: 'say', text: 'Thorough prep — that’s a professional. Lovely.', mood: 'cheer' },
            ],
          },
          {
            title: 'Aftercare That Protects Results',
            durationMin: 9,
            objectives: ['Give clear aftercare', 'Explain heat and sun avoidance', 'Stress SPF'],
            studyTips: ['Avoid heat and sun for 24–48h; SPF protects the result.'],
            examRefs: ['Aftercare'],
            steps: [
              { kind: 'say', text: 'The right aftercare keeps clients safe and happy. Here’s the core.', mood: 'think' },
              { kind: 'teach', title: 'Keep it cool', text: 'For 24–48 hours, clients avoid heat — saunas, hot showers, intense exercise — which can irritate freshly treated skin.' },
              { kind: 'ask', prompt: 'For 24–48 hours after treatment, clients should avoid…', qtype: 'MULTI', options: ['Saunas', 'Hot showers', 'Intense exercise', 'Daily SPF'], correct: [0, 1, 2], explanation: 'Avoid heat; SPF is encouraged.' },
              { kind: 'teach', title: 'Protect from sun', text: 'Treated skin is more sensitive to UV, so daily broad-spectrum SPF and sun avoidance protect both skin and results.' },
              { kind: 'ask', prompt: 'After treatment, daily ___ protects the skin and the result.', qtype: 'WORD', options: ['SPF', 'makeup', 'exfoliation'], correct: [0], explanation: 'Broad-spectrum SPF.' },
              { kind: 'teach', title: 'Give it in writing', text: 'Provide aftercare verbally and in writing, and tell clients how to reach you if they’re worried.' },
              { kind: 'say', text: 'Clear aftercare, happy clients. Brilliant.', mood: 'cheer' },
            ],
          },
        ],
        quiz: {
          title: 'Pre & Post Care Assessment', passMark: 70,
          questions: [
            { prompt: 'For laser hair removal, skin should be ___ on the day.', type: 'WORD', options: ['shaved', 'waxed', 'plucked'], correct: [0], explanation: 'Shaving keeps the root in place.' },
            { prompt: 'Why avoid a recent tan before laser?', type: 'SINGLE', options: ['Higher burn/pigment risk', 'It looks nicer', 'It speeds things up', 'No reason'], correct: [0], explanation: 'More melanin to absorb energy.' },
            { prompt: 'Contraindications and consent are re-checked before every session.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'Not just the first time.' },
            { prompt: 'For 24–48 hours after treatment clients should avoid…', type: 'MULTI', options: ['Saunas', 'Hot showers', 'Intense exercise', 'Daily SPF'], correct: [0, 1, 2], explanation: 'Avoid heat; keep SPF.' },
            { prompt: 'After treatment, daily ___ protects skin and results.', type: 'WORD', options: ['SPF', 'makeup', 'exfoliation'], correct: [0], explanation: 'Broad-spectrum SPF.' },
            { prompt: 'Aftercare should be given verbally and in writing.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'Both, with a way to reach you.' },
          ],
        },
      },
    ],
  },
  {
    courseSlug: 'advanced-aesthetics-level-5-7',
    modules: [
      {
        title: 'Evidence-Based Practice & Audit',
        summary: 'Use evidence and your own data to make treatments safer and better.',
        lessons: [
          {
            title: 'Using Evidence',
            durationMin: 10,
            objectives: ['Define evidence-based practice', 'Judge a source’s quality', 'Avoid marketing claims'],
            studyTips: ['Peer-reviewed studies beat a manufacturer’s brochure.'],
            examRefs: ['Evidence-based practice'],
            steps: [
              { kind: 'say', text: 'Great practice follows evidence, not hype. Let’s learn to tell them apart.', mood: 'think' },
              { kind: 'teach', title: 'What it means', text: 'Evidence-based practice means basing what you do on good research and proven results, not just habit or marketing.', art: 'concept' },
              { kind: 'ask', prompt: 'Evidence-based practice is based mainly on…', qtype: 'SINGLE', options: ['Good research and proven results', 'Adverts', 'Guesswork', 'Habit alone'], correct: [0], explanation: 'Research and outcomes, not marketing.' },
              { kind: 'teach', title: 'Judge the source', text: 'Peer-reviewed studies and recognised guidelines carry more weight than a manufacturer’s claim or a social-media post.' },
              { kind: 'ask', prompt: 'Which is the strongest source?', qtype: 'SINGLE', options: ['A peer-reviewed study', 'A brochure', 'A viral video', 'A rumour'], correct: [0], explanation: 'Peer-reviewed evidence is strongest.' },
              { kind: 'say', text: 'You can sift good from glossy now. Now your own data.', mood: 'cheer' },
              { kind: 'teach', title: 'Stay sceptical', text: 'If a claim sounds too good to be true, look for the evidence behind it before you offer it.' },
              { kind: 'ask', prompt: 'A “too good to be true” claim should be…', qtype: 'WORD', options: ['checked', 'believed', 'sold'], correct: [0], explanation: 'Check the evidence first.' },
              { kind: 'say', text: 'Evidence-led and grounded. Excellent.', mood: 'cheer' },
            ],
          },
          {
            title: 'Clinical Audit',
            durationMin: 9,
            objectives: ['Explain what an audit is', 'Use outcomes to improve', 'Close the loop'],
            studyTips: ['Audit = measure, compare to a standard, change, re-measure.'],
            examRefs: ['Clinical audit'],
            steps: [
              { kind: 'say', text: 'Your own results are a goldmine. Let’s mine them with audit.', mood: 'happy' },
              { kind: 'teach', title: 'What audit is', text: 'A clinical audit measures how you’re doing against a standard — for example complication or re-treatment rates — to find what to improve.' },
              { kind: 'ask', prompt: 'A clinical audit compares your practice against a…', qtype: 'WORD', options: ['standard', 'rival', 'rumour'], correct: [0], explanation: 'Measure against a standard.' },
              { kind: 'teach', title: 'Then act', text: 'You change something based on what the audit shows, then measure again to check it worked — closing the loop.' },
              { kind: 'ask', prompt: 'After making a change, a good audit then…', qtype: 'SINGLE', options: ['Measures again', 'Stops', 'Hides the data', 'Blames staff'], correct: [0], explanation: 'Re-measure to confirm improvement.' },
              { kind: 'teach', title: 'Why it matters', text: 'Auditing patterns in your outcomes turns everyday work into steady, evidence-based improvement.' },
              { kind: 'say', text: 'Measure, improve, repeat — that’s mastery. Brilliant.', mood: 'cheer' },
            ],
          },
        ],
        quiz: {
          title: 'Evidence & Audit Assessment', passMark: 70,
          questions: [
            { prompt: 'Evidence-based practice is based mainly on…', type: 'SINGLE', options: ['Good research and proven results', 'Adverts', 'Guesswork', 'Habit alone'], correct: [0], explanation: 'Research and outcomes.' },
            { prompt: 'The strongest source of evidence is…', type: 'SINGLE', options: ['A peer-reviewed study', 'A brochure', 'A viral video', 'A rumour'], correct: [0], explanation: 'Peer-reviewed evidence.' },
            { prompt: 'A “too good to be true” claim should be checked before you offer it.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'Verify first.' },
            { prompt: 'A clinical audit compares your practice against a…', type: 'WORD', options: ['standard', 'rival', 'rumour'], correct: [0], explanation: 'A standard.' },
            { prompt: 'After making a change, a good audit then…', type: 'SINGLE', options: ['Measures again', 'Stops', 'Hides data', 'Blames staff'], correct: [0], explanation: 'Re-measure to confirm.' },
            { prompt: 'Audit turns everyday work into steady improvement.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'Measure, improve, repeat.' },
          ],
        },
      },
    ],
  },
  {
    courseSlug: 'level-2-foundation-skin-laser',
    modules: [
      {
        title: 'Health, Safety & the Salon Environment',
        summary: 'Keep yourself, clients and colleagues safe through good salon practice.',
        lessons: [
          {
            title: 'A Safe Treatment Space',
            durationMin: 10,
            objectives: ['Name key safety basics', 'Explain risk assessment', 'Know your legal duty'],
            studyTips: ['Health & safety is a legal duty — not optional.'],
            examRefs: ['Health & safety'],
            steps: [
              { kind: 'say', text: 'A safe space protects everyone. Let’s set it up right.', mood: 'think' },
              { kind: 'teach', title: 'The basics', text: 'A safe salon means clean surfaces, working equipment, clear walkways, good lighting and the right protective gear to hand.', art: 'safety' },
              { kind: 'ask', prompt: 'Which belong in a safe treatment space?', qtype: 'MULTI', options: ['Clean surfaces', 'Working equipment', 'Clear walkways', 'Trailing cables'], correct: [0, 1, 2], explanation: 'Trailing cables are a trip hazard.' },
              { kind: 'teach', title: 'Risk assessment', text: 'A risk assessment simply means spotting what could cause harm and putting steps in place to prevent it.' },
              { kind: 'ask', prompt: 'A risk assessment is about…', qtype: 'SINGLE', options: ['Spotting hazards and preventing harm', 'Selling more', 'Decorating', 'Saving time'], correct: [0], explanation: 'Identify hazards, control them.' },
              { kind: 'say', text: 'Now the rules behind it.', mood: 'cheer' },
              { kind: 'teach', title: 'A legal duty', text: 'Health and safety is a legal responsibility — you must protect clients, colleagues and yourself, and record your checks.' },
              { kind: 'ask', prompt: 'Health and safety in the salon is…', qtype: 'WORD', options: ['legal', 'optional', 'occasional'], correct: [0], explanation: 'A legal duty.' },
              { kind: 'say', text: 'Safe, legal, sorted. Lovely.', mood: 'cheer' },
            ],
          },
          {
            title: 'Chemicals & Waste',
            durationMin: 9,
            objectives: ['Understand COSHH basics', 'Store chemicals safely', 'Dispose of waste correctly'],
            studyTips: ['COSHH = Control of Substances Hazardous to Health.'],
            examRefs: ['COSHH / waste'],
            steps: [
              { kind: 'say', text: 'Salons use chemicals and create waste. Let’s handle both safely.', mood: 'happy' },
              { kind: 'teach', title: 'COSHH', text: 'COSHH — Control of Substances Hazardous to Health — covers storing and using chemicals like disinfectants and solvents safely.' },
              { kind: 'ask', prompt: 'COSHH is mainly about handling…', qtype: 'SINGLE', options: ['Hazardous substances', 'Bookings', 'Music', 'Lighting'], correct: [0], explanation: 'Substances hazardous to health.' },
              { kind: 'teach', title: 'Store it right', text: 'Keep chemicals in labelled containers, away from heat, and follow the product’s safety instructions.' },
              { kind: 'ask', prompt: 'Chemicals should be kept in containers that are…', qtype: 'WORD', options: ['labelled', 'open', 'unmarked'], correct: [0], explanation: 'Clearly labelled and closed.' },
              { kind: 'teach', title: 'Dispose properly', text: 'Sharps go in a sharps bin and clinical waste in the correct stream — never in general rubbish.' },
              { kind: 'ask', prompt: 'Used needles must go in a…', qtype: 'SINGLE', options: ['Sharps bin', 'General bin', 'Recycling', 'Drawer'], correct: [0], explanation: 'Always a sharps bin.' },
              { kind: 'say', text: 'Chemicals and waste handled like a pro. Brilliant.', mood: 'cheer' },
            ],
          },
        ],
        quiz: {
          title: 'Health & Safety Assessment', passMark: 70,
          questions: [
            { prompt: 'Which belong in a safe treatment space?', type: 'MULTI', options: ['Clean surfaces', 'Working equipment', 'Clear walkways', 'Trailing cables'], correct: [0, 1, 2], explanation: 'Not trailing cables.' },
            { prompt: 'A risk assessment is about…', type: 'SINGLE', options: ['Spotting hazards and preventing harm', 'Selling more', 'Decorating', 'Saving time'], correct: [0], explanation: 'Identify and control hazards.' },
            { prompt: 'Health and safety in the salon is a legal duty.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'Not optional.' },
            { prompt: 'COSHH is mainly about handling…', type: 'WORD', options: ['chemicals', 'bookings', 'music'], correct: [0], explanation: 'Substances hazardous to health.' },
            { prompt: 'Chemicals should be kept in containers that are…', type: 'WORD', options: ['labelled', 'open', 'unmarked'], correct: [0], explanation: 'Labelled and closed.' },
            { prompt: 'Used needles must go in a sharps bin.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'Never the general bin.' },
          ],
        },
      },
    ],
  },
  {
    courseSlug: 'level-3-laser-aesthetic-therapies',
    modules: [
      {
        title: 'Skin Tightening & Body Treatments',
        summary: 'How energy devices firm skin and treat the body — and what they realistically do.',
        lessons: [
          {
            title: 'How Tightening Works',
            durationMin: 10,
            objectives: ['Explain controlled heating', 'Link heat to collagen', 'Set realistic expectations'],
            studyTips: ['Controlled deep heat makes collagen contract and rebuild.'],
            examRefs: ['Skin tightening'],
            steps: [
              { kind: 'say', text: 'Can we firm skin without surgery? To a point — here’s how.', mood: 'happy' },
              { kind: 'teach', title: 'Heat the deeper layers', text: 'Devices like radiofrequency heat the deeper skin in a controlled way, which makes existing collagen contract and prompts new collagen.', art: 'collagen' },
              { kind: 'ask', prompt: 'Skin tightening devices work mainly by controlled…', qtype: 'WORD', options: ['heating', 'cooling', 'cutting'], correct: [0], explanation: 'Controlled deep heat.' },
              { kind: 'ask', prompt: 'That heat causes collagen to…', qtype: 'SINGLE', options: ['Contract and rebuild', 'Disappear', 'Turn to fat', 'Do nothing'], correct: [0], explanation: 'Contraction plus new collagen.' },
              { kind: 'say', text: 'Now the honest bit.', mood: 'think' },
              { kind: 'teach', title: 'Gradual and modest', text: 'Results build over weeks and are gradual — tightening firms and refines, it doesn’t replace a surgical lift.' },
              { kind: 'ask', prompt: 'Energy skin tightening is best described as…', qtype: 'SINGLE', options: ['Gradual firming, not a surgical lift', 'Instant facelift', 'Permanent and total', 'Useless'], correct: [0], explanation: 'Modest, gradual firming.' },
              { kind: 'say', text: 'Honest and clear — clients trust that. Lovely.', mood: 'cheer' },
            ],
          },
          {
            title: 'Body Treatments & Suitability',
            durationMin: 9,
            objectives: ['Name common body goals', 'Stress healthy-lifestyle context', 'Select suitable clients'],
            studyTips: ['Body devices support, not replace, a healthy lifestyle.'],
            examRefs: ['Body treatments'],
            steps: [
              { kind: 'say', text: 'Body treatments are popular — let’s frame them properly.', mood: 'happy' },
              { kind: 'teach', title: 'What they target', text: 'Body devices aim to smooth, firm or contour areas — often used alongside, not instead of, diet and exercise.' },
              { kind: 'ask', prompt: 'Body contouring devices work best…', qtype: 'SINGLE', options: ['Alongside a healthy lifestyle', 'Instead of any effort', 'Only overnight', 'On their own forever'], correct: [0], explanation: 'They support a healthy lifestyle.' },
              { kind: 'teach', title: 'Right client', text: 'The best candidates are close to their target, with realistic goals — not expecting major weight loss from a device.' },
              { kind: 'ask', prompt: 'Body devices are NOT a substitute for…', qtype: 'MULTI', options: ['A healthy diet', 'Exercise', 'Realistic goals', 'A holiday'], correct: [0, 1, 2], explanation: 'They complement healthy habits and honest goals.' },
              { kind: 'teach', title: 'Consult fully', text: 'As with any treatment, consult, check contraindications and set expectations before starting.' },
              { kind: 'say', text: 'Framed honestly, suited well. Brilliant.', mood: 'cheer' },
            ],
          },
        ],
        quiz: {
          title: 'Skin Tightening & Body Assessment', passMark: 70,
          questions: [
            { prompt: 'Skin tightening devices work mainly by controlled…', type: 'WORD', options: ['heating', 'cooling', 'cutting'], correct: [0], explanation: 'Controlled deep heat.' },
            { prompt: 'That heat causes collagen to…', type: 'SINGLE', options: ['Contract and rebuild', 'Vanish', 'Turn to fat', 'Do nothing'], correct: [0], explanation: 'Contraction and new collagen.' },
            { prompt: 'Energy skin tightening is best described as…', type: 'SINGLE', options: ['Gradual firming, not a surgical lift', 'An instant facelift', 'Permanent and total', 'Useless'], correct: [0], explanation: 'Modest, gradual firming.' },
            { prompt: 'Body contouring devices work best alongside a healthy lifestyle.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'They support, not replace.' },
            { prompt: 'Body devices are NOT a substitute for…', type: 'MULTI', options: ['A healthy diet', 'Exercise', 'Realistic goals', 'A holiday'], correct: [0, 1, 2], explanation: 'They complement healthy habits.' },
            { prompt: 'Body treatments still need consultation and contraindication checks.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'Same standards apply.' },
          ],
        },
      },
    ],
  },
  {
    courseSlug: 'level-4-certificate-aesthetic-practice',
    modules: [
      {
        title: 'Skin Analysis & Assessment Methods',
        summary: 'Assess skin type, condition and texture systematically before any treatment plan.',
        lessons: [
          {
            title: 'Reading the Skin',
            durationMin: 11,
            objectives: ['Describe a structured skin analysis', 'Identify skin type and condition', 'Use magnification and lighting tools'],
            studyTips: ['Oily, dry, combination and sensitive are skin types; dehydration is a condition, not a type.'],
            examRefs: ['Skin analysis'],
            steps: [
              { kind: 'say', text: 'A thorough skin analysis shapes every good treatment plan. Let\'s walk it through.', mood: 'think' },
              { kind: 'teach', title: 'Start with a clean face', text: 'Analyse skin after gentle cleansing, with good lighting and ideally a magnifying lamp to see texture, pores and lesions clearly.' },
              { kind: 'ask', prompt: 'Why cleanse before a skin analysis?', qtype: 'SINGLE', options: ['To see the true skin without product interference', 'To waste time', 'To exfoliate first', 'It is not needed'], correct: [0], explanation: 'Make-up and product residue mask what you need to see.' },
              { kind: 'teach', title: 'Skin types', text: 'The four main types are oily, dry, combination and sensitive. Type is largely genetic and determines baseline sebum output.' },
              { kind: 'ask', prompt: 'Which are the four main skin types?', qtype: 'MULTI', options: ['Oily', 'Dry', 'Combination', 'Dehydrated'], correct: [0, 1, 2], explanation: 'Dehydration is a condition, not a type — it can affect any type.' },
              { kind: 'say', text: 'Good. Now the difference between type and condition.', mood: 'cheer' },
              { kind: 'teach', title: 'Type vs condition', text: 'A skin condition is a temporary or changeable state such as dehydration, sensitivity or congestion that sits on top of the underlying type.' },
              { kind: 'ask', prompt: 'Dehydration is a skin ___, not a skin type.', qtype: 'WORD', options: ['condition', 'disease', 'type'], correct: [0], explanation: 'Even oily skin can be dehydrated.' },
              { kind: 'teach', title: 'Use the tools', text: 'A magnifying lamp highlights open pores, comedones, erythema and pigment changes that are easy to miss with the naked eye.' },
              { kind: 'ask', prompt: 'A magnifying lamp helps you spot…', qtype: 'MULTI', options: ['Open pores', 'Comedones', 'Erythema', 'The client\'s exact age'], correct: [0, 1, 2], explanation: 'It reveals texture and vascular detail, not exact age.' },
              { kind: 'say', text: 'Strong analysis = a treatment plan you can stand behind. Brilliant.', mood: 'cheer' },
            ],
          },
          {
            title: 'Recording & Translating Findings',
            durationMin: 10,
            objectives: ['Document findings clearly', 'Link analysis to treatment choice', 'Flag anything to refer'],
            studyTips: ['"Possible rosacea - refer for confirmation" is safer than a diagnosis.'],
            examRefs: ['Skin analysis / treatment planning'],
            steps: [
              { kind: 'say', text: 'Now - how to capture what you found and use it.', mood: 'happy' },
              { kind: 'teach', title: 'Write it down', text: 'Record skin type, condition, any lesions noted (size, location, appearance) and any concerns. A face map or photograph helps.' },
              { kind: 'ask', prompt: 'A good skin analysis record includes…', qtype: 'MULTI', options: ['Skin type and condition', 'Any lesions noted', 'Your concerns', 'The client\'s star sign'], correct: [0, 1, 2], explanation: 'Objective clinical findings, not astrology.' },
              { kind: 'teach', title: 'Drive the plan', text: 'Your findings directly shape the treatment: oily skin may need different exfoliation; sensitive skin needs gentler settings.' },
              { kind: 'ask', prompt: 'A skin analysis mainly helps you to…', qtype: 'SINGLE', options: ['Choose a safe, appropriate treatment plan', 'Set the price', 'Decorate the room', 'Skip consent'], correct: [0], explanation: 'Analysis informs a safe plan.' },
              { kind: 'say', text: 'Now - when to stop and refer.', mood: 'think' },
              { kind: 'teach', title: 'Flag and refer', text: 'Anything that looks medical - asymmetric, changing, bleeding or ulcerating lesions - should be noted and referred before any treatment.' },
              { kind: 'ask', prompt: 'An asymmetric, changing lesion should be…', qtype: 'SINGLE', options: ['Noted and referred', 'Treated at once', 'Ignored', 'Photographed and forgotten'], correct: [0], explanation: 'Note, refer, do not treat.' },
              { kind: 'say', text: 'Analyse, record, plan, refer when needed. That is the standard.', mood: 'cheer' },
            ],
          },
        ],
        quiz: {
          title: 'Skin Analysis Assessment',
          passMark: 70,
          questions: [
            { prompt: 'Which are the four main skin types?', type: 'MULTI', options: ['Oily', 'Dry', 'Combination', 'Dehydrated'], correct: [0, 1, 2], explanation: 'Dehydration is a condition, not a type.' },
            { prompt: 'Dehydration is a skin condition, not a skin type.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'Any skin type can be dehydrated.' },
            { prompt: 'A magnifying lamp helps identify…', type: 'MULTI', options: ['Open pores', 'Comedones', 'Erythema', 'Nothing useful'], correct: [0, 1, 2], explanation: 'It reveals texture and vascular detail.' },
            { prompt: 'Before a skin analysis, skin should be…', type: 'WORD', options: ['cleansed', 'moisturised', 'made up'], correct: [0], explanation: 'Cleanse first to remove product interference.' },
            { prompt: 'An asymmetric or changing lesion should be…', type: 'SINGLE', options: ['Noted and referred', 'Treated at once', 'Ignored', 'Lasered'], correct: [0], explanation: 'Refer before any treatment.' },
            { prompt: 'A skin analysis mainly helps you to…', type: 'SINGLE', options: ['Choose a safe treatment plan', 'Set the price', 'Skip consent', 'Decorate'], correct: [0], explanation: 'Analysis drives the plan.' },
          ],
        },
      },
    ],
  },
  {
    courseSlug: L2,
    modules: [
      {
        title: 'Laser Safety & Radiation Protection',
        summary: 'Protect everyone in the room with the right eyewear, controls and safety checks.',
        lessons: [
          {
            title: 'Why Laser Safety Matters',
            durationMin: 11,
            objectives: ['Explain why lasers are classified as hazardous', 'Name the main risks', 'Understand the controlled area'],
            studyTips: ['Class 4 lasers can cause eye and skin damage even from a reflection - treat them with total respect.'],
            examRefs: ['Laser safety / radiation protection'],
            steps: [
              { kind: 'say', text: 'Lasers are powerful tools. Used carelessly, they hurt people. Let\'s understand the rules.', mood: 'think' },
              { kind: 'teach', title: 'Classified hazards', text: 'Treatment lasers are typically Class 3B or Class 4 - high enough power to cause eye damage instantly and skin burns from direct or reflected beams.', art: 'safety' },
              { kind: 'ask', prompt: 'A Class 4 laser can cause eye damage from…', qtype: 'SINGLE', options: ['A direct or reflected beam', 'A gentle glow only', 'No beam at all', 'Only if pointed directly at the eye'], correct: [0], explanation: 'Even a reflection is dangerous at high power.' },
              { kind: 'teach', title: 'Main risks', text: 'The main hazards are eye injury (permanent if the retina is hit), skin burns, fire from flammable materials, and fumes from tissue.' },
              { kind: 'ask', prompt: 'Which are recognised laser hazards?', qtype: 'MULTI', options: ['Eye injury', 'Skin burns', 'Fire risk', 'Better hearing'], correct: [0, 1, 2], explanation: 'Eye, skin, fire - not hearing.' },
              { kind: 'say', text: 'So we control the environment first.', mood: 'cheer' },
              { kind: 'teach', title: 'Controlled area', text: 'The treatment room is a laser-controlled area: warning signs on the door, no unauthorised entry during use, all reflective surfaces covered or removed.', art: 'safety' },
              { kind: 'ask', prompt: 'During laser treatment, entry to the room should be…', qtype: 'WORD', options: ['controlled', 'open', 'optional'], correct: [0], explanation: 'A controlled area with no unexpected entry.' },
              { kind: 'say', text: 'Environment locked down. Now the eyewear.', mood: 'cheer' },
            ],
          },
          {
            title: 'Eyewear, Checks & Operator Responsibility',
            durationMin: 10,
            objectives: ['Choose correct optical density eyewear', 'Perform pre-use safety checks', 'Know the operator\'s legal duties'],
            studyTips: ['Eyewear must match the laser\'s wavelength - a different laser needs different goggles.'],
            examRefs: ['Laser safety / radiation protection'],
            steps: [
              { kind: 'say', text: 'Eyewear is the single most important physical control. Let\'s get it right.', mood: 'happy' },
              { kind: 'teach', title: 'Wavelength-matched eyewear', text: 'Protective eyewear must be rated for the specific wavelength in use and worn by the practitioner, the client and anyone else in the room.', art: 'safety' },
              { kind: 'ask', prompt: 'During laser use, wavelength-matched eyewear is worn by…', qtype: 'MULTI', options: ['The practitioner', 'The client', 'Anyone in the room', 'Nobody'], correct: [0, 1, 2], explanation: 'Every person present needs protection.' },
              { kind: 'teach', title: 'Pre-use checks', text: 'Before firing: verify goggles are correct and undamaged, the client is prepared, the door is signed, no one can walk in unexpectedly, and the device is calibrated.' },
              { kind: 'ask', prompt: 'Which are part of a pre-use laser safety check?', qtype: 'MULTI', options: ['Verify goggles are correct', 'Check the door is signed', 'Confirm no unexpected entry', 'Check the music playlist'], correct: [0, 1, 2], explanation: 'Safety checks, not entertainment.' },
              { kind: 'say', text: 'Every check, every time. Now the law.', mood: 'think' },
              { kind: 'teach', title: 'Operator duties', text: 'In the UK, cosmetic laser use sits under MHRA guidance and Local Authority licensing. The operator is responsible for safe use at all times.' },
              { kind: 'ask', prompt: 'Responsibility for safe laser use lies with…', qtype: 'SINGLE', options: ['The operator', 'The machine manufacturer only', 'The client', 'Nobody'], correct: [0], explanation: 'The operator is responsible at all times.' },
              { kind: 'say', text: 'Safe, compliant, prepared. That is the standard.', mood: 'cheer' },
            ],
          },
        ],
        quiz: {
          title: 'Laser Safety Assessment',
          passMark: 70,
          questions: [
            { prompt: 'A Class 4 laser can cause eye injury from a direct or reflected beam.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'Even reflections are dangerous at high power.' },
            { prompt: 'Which are recognised laser hazards?', type: 'MULTI', options: ['Eye injury', 'Skin burns', 'Fire risk', 'Improved hearing'], correct: [0, 1, 2], explanation: 'Eye, skin, fire - not hearing.' },
            { prompt: 'During laser treatment, room entry should be…', type: 'WORD', options: ['controlled', 'open', 'optional'], correct: [0], explanation: 'A controlled area with no unexpected entry.' },
            { prompt: 'Wavelength-matched eyewear must be worn by…', type: 'MULTI', options: ['The practitioner', 'The client', 'Anyone in the room', 'Nobody'], correct: [0, 1, 2], explanation: 'Every person in the room needs protection.' },
            { prompt: 'Protective goggles must be rated for the specific ___ in use.', type: 'WORD', options: ['wavelength', 'brand', 'colour'], correct: [0], explanation: 'Goggles must match the wavelength.' },
            { prompt: 'Responsibility for safe laser use lies with the operator.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'The operator is accountable at all times.' },
          ],
        },
      },
    ],
  },
  {
    courseSlug: 'advanced-aesthetics-level-5-7',
    modules: [
      {
        title: 'Leadership & Mentoring',
        summary: 'Lead a safe team and bring on the next generation of practitioners.',
        lessons: [
          {
            title: 'Leading a Safe Team',
            durationMin: 10,
            objectives: ['Describe a safety culture', 'Encourage raising concerns', 'Lead by example'],
            studyTips: ['A safe team is one where anyone can raise a concern without fear.'],
            examRefs: ['Leadership'],
            steps: [
              { kind: 'say', text: 'Leading well keeps a whole clinic safe. Let’s look at how.', mood: 'think' },
              { kind: 'teach', title: 'Safety culture', text: 'A good safety culture means everyone feels able to speak up about concerns, mistakes are treated as learning, and standards are shared.', art: 'concept' },
              { kind: 'ask', prompt: 'A good safety culture treats mistakes as…', qtype: 'SINGLE', options: ['Learning opportunities', 'Reasons to blame', 'Things to hide', 'Unimportant'], correct: [0], explanation: 'Learn, don’t blame.' },
              { kind: 'teach', title: 'Make it safe to speak', text: 'Leaders actively invite questions and concerns — staff who fear blame hide problems, and hidden problems harm clients.' },
              { kind: 'ask', prompt: 'When staff fear blame, they tend to…', qtype: 'WORD', options: ['hide', 'share', 'report'], correct: [0], explanation: 'Fear hides problems.' },
              { kind: 'say', text: 'Now lead from the front.', mood: 'cheer' },
              { kind: 'teach', title: 'Lead by example', text: 'The standards you model — consent, records, hygiene, honesty — set the bar the whole team follows.' },
              { kind: 'ask', prompt: 'The best way to set team standards is to…', qtype: 'SINGLE', options: ['Model them yourself', 'Just write rules', 'Hope for the best', 'Punish slips'], correct: [0], explanation: 'Lead by example.' },
              { kind: 'say', text: 'That’s real leadership. Excellent.', mood: 'cheer' },
            ],
          },
          {
            title: 'Mentoring New Practitioners',
            durationMin: 9,
            objectives: ['Explain a mentor’s role', 'Give useful feedback', 'Support safe growth'],
            studyTips: ['Good feedback is specific, kind and actionable.'],
            examRefs: ['Mentoring'],
            steps: [
              { kind: 'say', text: 'Bringing on new talent is part of mastery. Here’s how to mentor well.', mood: 'happy' },
              { kind: 'teach', title: 'The mentor’s role', text: 'A mentor guides, observes and supports a newer practitioner to build skills and judgement safely over time.' },
              { kind: 'ask', prompt: 'A mentor mainly helps a newer practitioner to…', qtype: 'SINGLE', options: ['Build skills and judgement safely', 'Work unsupervised at once', 'Skip the basics', 'Compete'], correct: [0], explanation: 'Safe, supported growth.' },
              { kind: 'teach', title: 'Useful feedback', text: 'Good feedback is specific, kind and actionable — say what was done well, what to change, and how.' },
              { kind: 'ask', prompt: 'Good feedback is…', qtype: 'MULTI', options: ['Specific', 'Kind', 'Actionable', 'Vague'], correct: [0, 1, 2], explanation: 'Not vague.' },
              { kind: 'teach', title: 'Grow them safely', text: 'Increase responsibility as competence grows, and stay available when they hit something new.' },
              { kind: 'say', text: 'You can grow a safe, skilled team now. Brilliant.', mood: 'cheer' },
            ],
          },
        ],
        quiz: {
          title: 'Leadership & Mentoring Assessment', passMark: 70,
          questions: [
            { prompt: 'A good safety culture treats mistakes as…', type: 'SINGLE', options: ['Learning opportunities', 'Reasons to blame', 'Things to hide', 'Unimportant'], correct: [0], explanation: 'Learn, don’t blame.' },
            { prompt: 'When staff fear blame, they tend to ___ problems.', type: 'WORD', options: ['hide', 'share', 'report'], correct: [0], explanation: 'Fear hides problems.' },
            { prompt: 'The best way to set team standards is to model them yourself.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'Lead by example.' },
            { prompt: 'A mentor mainly helps a newer practitioner to…', type: 'SINGLE', options: ['Build skills and judgement safely', 'Work alone at once', 'Skip basics', 'Compete'], correct: [0], explanation: 'Safe, supported growth.' },
            { prompt: 'Good feedback is…', type: 'MULTI', options: ['Specific', 'Kind', 'Actionable', 'Vague'], correct: [0, 1, 2], explanation: 'Not vague.' },
            { prompt: 'Responsibility should grow as a mentee’s competence grows.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'Match responsibility to competence.' },
          ],
        },
      },
    ],
  },

  // -- BATCH 7 -----------------------------------------------------------------

  {
    courseSlug: L2,
    modules: [
      {
        title: "Treatment Planning & Client Records",
        summary: "How to document consultations and treatment plans legally and professionally; GDPR basics for client data; why good records protect both client and practitioner.",
        lessons: [
          {
            title: "Building a Treatment Plan & Keeping Accurate Records",
            durationMin: 12,
            objectives: ["Construct a client-specific treatment plan", "Record consultation findings accurately", "Explain what a good client record must contain"],
            studyTips: ["VTCT Level 2 units emphasise that records must be contemporaneous -- written at the time, not filled in later."],
            examRefs: ["Record keeping", "Treatment planning"],
            steps: [
              { kind: "say", text: "A good record is the backbone of safe, legal practice. Let's build one.", mood: "happy" },
              { kind: "teach", title: "What goes in a treatment plan", text: "A treatment plan records the agreed treatment, the settings or products used, expected outcomes, number of sessions, and review dates." },
              { kind: "teach", title: "The consultation record", text: "It must capture the client's medical history, medications, contraindications identified, the patch-test result, and the client's signed consent." },
              { kind: "ask", prompt: "Which MUST appear on a client record?", qtype: "MULTI", options: ["Signed consent", "Medical history", "Treatment settings used", "The client's shoe size"], correct: [0, 1, 2], explanation: "Consent, history and settings are essential; shoe size is irrelevant." },
              { kind: "say", text: "Exactly right. Now let's look at why accuracy matters.", mood: "cheer" },
              { kind: "teach", title: "Contemporaneous records", text: "Records must be written at the time of treatment, not reconstructed later. Courts and regulators treat late-added records with suspicion." },
              { kind: "ask", prompt: "Records should be written...", qtype: "SINGLE", options: ["At the time of the appointment", "A week later", "Only if something goes wrong", "Never"], correct: [0], explanation: "Contemporaneous records are more credible and more useful." },
              { kind: "teach", title: "What a record protects", text: "If a client complains or a dispute arises, a complete record shows exactly what was agreed, tested and performed -- protecting both parties." },
              { kind: "ask", prompt: "A complete client record mainly protects...", qtype: "MULTI", options: ["The client", "The practitioner", "The business", "Nobody"], correct: [0, 1, 2], explanation: "Good records protect everyone involved." },
              { kind: "say", text: "That's the record sorted. Now let's think about data law.", mood: "think" },
            ],
          },
          {
            title: "GDPR & Data Protection in the Clinic",
            durationMin: 10,
            objectives: ["Apply the core GDPR principles to client records", "Explain how long to keep records", "Describe what clients' data rights mean in practice"],
            studyTips: ["Health data is special category under UK GDPR -- it needs extra protection compared with ordinary personal data."],
            examRefs: ["GDPR", "Data protection", "Record keeping"],
            steps: [
              { kind: "say", text: "Client data is sensitive, and the law is clear about how to handle it.", mood: "think" },
              { kind: "teach", title: "UK GDPR in aesthetics", text: "Health and treatment data is special category data under UK GDPR, requiring a lawful basis and additional safeguards." },
              { kind: "ask", prompt: "Under UK GDPR, health data is classed as...", qtype: "WORD", options: ["special category", "public", "optional"], correct: [0], explanation: "Special category data needs stricter controls than ordinary personal data." },
              { kind: "teach", title: "Core principles", text: "Collect only what you need (data minimisation), keep it accurate, store it securely, and don't hold it longer than necessary." },
              { kind: "ask", prompt: "Which principle limits you to collecting only the data you actually need?", qtype: "SINGLE", options: ["Data minimisation", "Data maximisation", "Open sharing", "No rule applies"], correct: [0], explanation: "Data minimisation: collect only what is necessary for the purpose." },
              { kind: "teach", title: "Retention periods", text: "Adult client records should be kept for a minimum of 7 years; records relating to minors, until they reach 25." },
              { kind: "ask", prompt: "Adult client records in aesthetics should be kept for a minimum of...", qtype: "SINGLE", options: ["7 years", "1 year", "30 days", "Forever"], correct: [0], explanation: "7 years is the standard minimum retention period for adult treatment records." },
              { kind: "teach", title: "Client rights", text: "Clients can request to see their data (subject access request) and can ask for errors to be corrected -- you must respond within one month." },
              { kind: "ask", prompt: "A client asks to see their records. You must respond within...", qtype: "SINGLE", options: ["One month", "One year", "One week", "Ten minutes"], correct: [0], explanation: "One calendar month is the legal deadline for a subject access request." },
              { kind: "say", text: "Solid data practice keeps clients safe and keeps you compliant. Well done.", mood: "cheer" },
            ],
          },
        ],
        quiz: {
          title: "Treatment Planning & Client Records Assessment",
          passMark: 70,
          questions: [
            { prompt: "Which information must appear on a client record?", type: "MULTI", options: ["Signed consent", "Medical history", "Settings used", "Client's shoe size"], correct: [0, 1, 2], explanation: "Consent, history and settings are essential records." },
            { prompt: "Records should be written at the time of the appointment, not reconstructed later.", type: "TRUEFALSE", options: ["True", "False"], correct: [0], explanation: "Contemporaneous records are legally stronger and more credible." },
            { prompt: "Under UK GDPR, health data is classed as ___ category data.", type: "WORD", options: ["special", "public", "basic"], correct: [0], explanation: "Special category data requires additional lawful basis and safeguards." },
            { prompt: "The data minimisation principle means you should collect...", type: "SINGLE", options: ["Only what is needed for the treatment", "As much data as possible", "Nothing at all", "Only financial data"], correct: [0], explanation: "Collect only data that is necessary and proportionate." },
            { prompt: "Adult aesthetics client records must be kept for a minimum of...", type: "SINGLE", options: ["7 years", "1 year", "30 days", "50 years"], correct: [0], explanation: "7 years is the standard minimum retention period." },
            { prompt: "A client submits a subject access request. You must respond within...", type: "SINGLE", options: ["One month", "Six months", "One week", "One day"], correct: [0], explanation: "UK GDPR requires a response within one calendar month." },
          ],
        },
      },
    ],
  },

  {
    courseSlug: "level-3-laser-aesthetic-therapies",
    modules: [
      {
        title: "Skin Pharmacology & Topicals",
        summary: "How topical agents interact with laser and aesthetic treatments; the role of retinoids, AHAs and SPF in pre/post protocols; photosensitising medications and why some topicals must stop before laser.",
        lessons: [
          {
            title: "Topical Agents & Their Interaction with Laser Treatments",
            durationMin: 13,
            objectives: ["Name key topical agents used in pre/post laser protocols", "Explain why certain topicals must be stopped before laser", "Understand the role of numbing creams and photosensitisers"],
            studyTips: ["A practical exam question often asks which topical to stop and why -- link the pharmacology to the risk (e.g. retinoids thin the skin, raising burn risk)."],
            examRefs: ["Pre-treatment preparation", "Topical pharmacology"],
            steps: [
              { kind: "say", text: "What clients put on their skin before and after treatment matters as much as the device settings.", mood: "think" },
              { kind: "teach", title: "Topical anaesthetics (numbing creams)", text: "EMLA and LMX creams contain local anaesthetics (lidocaine/prilocaine) applied under occlusion 30-60 minutes before treatment to reduce pain." },
              { kind: "ask", prompt: "Topical anaesthetic cream is typically applied...", qtype: "SINGLE", options: ["30-60 minutes before treatment", "The day before", "During treatment", "After treatment"], correct: [0], explanation: "30-60 minutes under occlusion gives effective tissue penetration." },
              { kind: "teach", title: "Retinoids -- stop before laser", text: "Retinoids (tretinoin, retinol) increase epidermal turnover and thin the stratum corneum; clients must stop 5-7 days before laser to avoid heightened sensitivity and burn risk." },
              { kind: "ask", prompt: "Why must retinoid use stop before laser treatment?", qtype: "SINGLE", options: ["They thin the skin, raising burn risk", "They improve results", "They block the laser beam", "They have no effect"], correct: [0], explanation: "Retinoids accelerate cell turnover and thin the barrier, making skin more susceptible to laser injury." },
              { kind: "teach", title: "AHAs and BHAs", text: "Alpha-hydroxy acids (glycolic, lactic) and beta-hydroxy acids (salicylic) exfoliate and sensitise skin; stop 5-7 days before laser to avoid adverse reactions." },
              { kind: "ask", prompt: "Which topicals should be paused 5-7 days before laser?", qtype: "MULTI", options: ["Retinoids", "AHAs (glycolic acid)", "BHAs (salicylic acid)", "Plain moisturiser"], correct: [0, 1, 2], explanation: "Active exfoliants sensitise skin; plain moisturiser does not." },
              { kind: "teach", title: "Photosensitising medications", text: "Some systemic drugs (certain antibiotics, diuretics, NSAIDs, some antidepressants) increase skin's UV/light sensitivity -- always take a full medication history." },
              { kind: "ask", prompt: "Before laser, it is important to ask about systemic medications because some can...", qtype: "SINGLE", options: ["Increase skin photosensitivity", "Improve laser absorption", "Block all side effects", "Have no relevance"], correct: [0], explanation: "Photosensitising drugs raise the risk of adverse reactions to laser and IPL energy." },
              { kind: "say", text: "A thorough medication history is as important as the device settings. Good work.", mood: "cheer" },
            ],
          },
          {
            title: "SPF, Serums & Post-Treatment Topical Protocols",
            durationMin: 12,
            objectives: ["Explain why SPF is non-negotiable post-laser", "Describe which ingredients support healing and which to avoid", "Advise clients confidently on a post-treatment regime"],
            studyTips: ["Think of post-treatment skin as a wound: calm it, protect it, then rebuild. The same logic underpins every topical recommendation."],
            examRefs: ["Post-treatment care", "SPF and photoprotection"],
            steps: [
              { kind: "say", text: "After laser, the skin is in a vulnerable state. The right topicals help it heal.", mood: "happy" },
              { kind: "teach", title: "Why SPF is non-negotiable", text: "Post-laser skin lacks its normal barrier and is highly susceptible to UV-induced pigmentation changes; broad-spectrum SPF 30-50 must be worn daily." },
              { kind: "ask", prompt: "After laser treatment, clients should wear broad-spectrum SPF...", qtype: "SINGLE", options: ["Every day, even on cloudy days", "Only on holiday", "Only for one day", "Never"], correct: [0], explanation: "UV reaches skin through cloud; post-laser PIH risk is elevated for weeks." },
              { kind: "teach", title: "Barrier-supporting ingredients", text: "Ceramides, hyaluronic acid and gentle peptides support barrier repair post-laser without irritating compromised skin." },
              { kind: "ask", prompt: "Which ingredient helps restore the skin barrier post-laser?", qtype: "SINGLE", options: ["Ceramides", "Glycolic acid", "Retinol", "Salicylic acid"], correct: [0], explanation: "Ceramides are lipid molecules integral to barrier structure and repair." },
              { kind: "teach", title: "What to avoid post-treatment", text: "Avoid active exfoliants (AHAs, BHAs, retinoids), fragrance and heat for at least 5-7 days; these can disrupt healing and trigger PIH." },
              { kind: "ask", prompt: "Post-laser, clients should avoid using...", qtype: "MULTI", options: ["Glycolic acid toner", "Tretinoin", "Fragrance-heavy products", "Plain SPF moisturiser"], correct: [0, 1, 2], explanation: "Active exfoliants and fragrance irritate compromised skin; plain SPF is fine." },
              { kind: "teach", title: "When to reintroduce actives", text: "Retinoids and AHAs can usually be reintroduced after full healing -- typically 7-14 days post-treatment, guided by skin response." },
              { kind: "ask", prompt: "Retinoids can usually be reintroduced after full healing, typically...", qtype: "SINGLE", options: ["7-14 days post-treatment", "The next morning", "After 6 months", "Never again"], correct: [0], explanation: "7-14 days is the standard guidance; individual response may vary." },
              { kind: "say", text: "Get the post-treatment protocol right and results improve. You've got this.", mood: "cheer" },
            ],
          },
        ],
        quiz: {
          title: "Skin Pharmacology & Topicals Assessment",
          passMark: 70,
          questions: [
            { prompt: "Topical anaesthetic cream should be applied under occlusion...", type: "SINGLE", options: ["30-60 minutes before treatment", "Immediately before", "The day before", "After treatment"], correct: [0], explanation: "30-60 minutes gives adequate penetration and effect." },
            { prompt: "Retinoids must be stopped before laser treatment because they...", type: "SINGLE", options: ["Thin the skin and raise burn risk", "Improve laser absorption", "Prevent pain", "Block laser wavelengths"], correct: [0], explanation: "Retinoids thin the stratum corneum, increasing sensitivity to laser energy." },
            { prompt: "Which topicals should be paused 5-7 days before laser?", type: "MULTI", options: ["Retinoids", "AHAs", "BHAs", "Plain moisturiser"], correct: [0, 1, 2], explanation: "Active exfoliants sensitise skin; plain moisturiser does not." },
            { prompt: "Some systemic medications raise skin photosensitivity and must be identified at...", type: "SINGLE", options: ["Consultation", "After treatment", "The invoice stage", "Never"], correct: [0], explanation: "Full medication history at consultation identifies photosensitising drugs." },
            { prompt: "Post-laser, broad-spectrum SPF must be worn...", type: "SINGLE", options: ["Every day, including cloudy days", "Only in summer", "Only for 24 hours", "Only abroad"], correct: [0], explanation: "UV penetrates cloud; PIH risk is elevated for weeks post-laser." },
            { prompt: "Which ingredient best supports barrier repair after laser?", type: "SINGLE", options: ["Ceramides", "Glycolic acid", "Salicylic acid", "Fragrance"], correct: [0], explanation: "Ceramides are structural lipids that restore barrier integrity." },
          ],
        },
      },
    ],
  },

  // -- BATCH 8 -----------------------------------------------------------------

  {
    courseSlug: L2,
    modules: [
      {
        title: "Client Preparation & Treatment Delivery",
        summary: "How to set up the treatment room, prepare the client, take pre-treatment photographs and deliver a systematic, safe treatment from start to finish.",
        lessons: [
          {
            title: "Setting Up & Preparing the Client",
            durationMin: 11,
            objectives: ["Describe correct room preparation before a laser or light treatment", "Explain why pre-treatment photographs are taken", "State how to position and prepare the client safely"],
            studyTips: ["VTCT Level 2 assessments often include practical observation of your set-up routine -- every step matters."],
            examRefs: ["Treatment preparation", "Client preparation", "Record keeping"],
            steps: [
              { kind: "say", text: "Good preparation before the first pulse is what separates a safe treatment from a risky one.", mood: "think" },
              { kind: "teach", title: "Room preparation", text: "The treatment room must be at a comfortable temperature, have a clean couch with fresh couch roll, and have all equipment switched on and tested before the client enters." },
              { kind: "ask", prompt: "Couch roll must be replaced...", qtype: "SINGLE", options: ["Between every client", "Once a day", "Once a week", "When it looks dirty"], correct: [0], explanation: "Fresh couch roll for every client is an infection-control requirement." },
              { kind: "teach", title: "Jewellery and clothing", text: "Ask the client to remove all jewellery and metal objects near the treatment area. Ensure clothing is folded back safely and not at risk from stray laser energy." },
              { kind: "teach", title: "Pre-treatment photography", text: "Take clear, consistent photographs of the treatment area from standard angles before every treatment. These form part of the clinical record and provide a baseline for comparison." },
              { kind: "ask", prompt: "Why photograph the treatment area before starting?", qtype: "SINGLE", options: ["To create a baseline for comparison and for the medicolegal record", "To post on social media", "To impress the client", "It is not necessary"], correct: [0], explanation: "Before photographs are essential for tracking progress and for medicolegal protection." },
              { kind: "teach", title: "Client positioning", text: "Position the client so the treatment area is fully accessible, they are comfortable and stable, and you can move around the area without interruption." },
              { kind: "ask", prompt: "The best client position for treatment is one that is...", qtype: "MULTI", options: ["Comfortable for the client", "Safe and stable", "Fully accessible to the practitioner", "As fast as possible"], correct: [0, 1, 2], explanation: "Comfort, stability and access are all essential; speed alone is not a positioning goal." },
              { kind: "say", text: "A methodical setup protects both of you. Now let's look at delivering the treatment itself.", mood: "cheer" },
            ],
          },
          {
            title: "Delivering a Safe, Systematic Treatment",
            durationMin: 12,
            objectives: ["Explain the purpose of a test pulse before a full treatment", "Describe a systematic treatment delivery approach", "State how to recognise and respond to unexpected reactions mid-treatment"],
            studyTips: ["The test pulse is not optional for new clients or new settings. Examiners look for it in practical assessments."],
            examRefs: ["Treatment delivery", "Test pulse", "Adverse reactions"],
            steps: [
              { kind: "say", text: "Delivering the treatment well is about method, attention and knowing when to stop.", mood: "think" },
              { kind: "teach", title: "Test pulse", text: "For a new client or new settings, fire a test pulse on an inconspicuous area and wait the recommended time to check the tissue response before treating the full area." },
              { kind: "ask", prompt: "A test pulse is performed to...", qtype: "SINGLE", options: ["Check how the skin responds to the planned settings before full treatment", "Save time", "Impress the client", "Set the price"], correct: [0], explanation: "The test pulse identifies unexpected reactions early, when they are easy to manage." },
              { kind: "teach", title: "Systematic coverage", text: "Work methodically across the treatment area using a systematic pattern. This avoids missed patches, double-pulsing the same spot, and over-treating one area." },
              { kind: "teach", title: "Monitoring during treatment", text: "Watch for the expected tissue response (mild erythema, hair singeing in hair removal) and for unexpected signs: excessive redness, pain beyond mild discomfort, blistering or whitening of the skin." },
              { kind: "ask", prompt: "If a client reports unexpected, sharp pain mid-treatment, you should...", qtype: "SINGLE", options: ["Stop, assess the skin and adjust settings before continuing", "Increase the energy and carry on", "Ignore it and finish", "Leave the room"], correct: [0], explanation: "Unexpected pain is a signal to stop and assess. Never continue through it." },
              { kind: "teach", title: "Documenting the session", text: "Record the device used, wavelength, fluence, pulse duration, number of pulses, treatment area, client response, and any adverse reactions at the time of treatment." },
              { kind: "ask", prompt: "Treatment notes must be completed...", qtype: "SINGLE", options: ["At the time of treatment", "At the end of the week", "Only if something went wrong", "Never"], correct: [0], explanation: "Contemporaneous records are more accurate and legally more credible." },
              { kind: "say", text: "Methodical delivery and clear records are the foundation of safe, professional practice. You have got this.", mood: "cheer" },
            ],
          },
        ],
        quiz: {
          title: "Client Preparation & Delivery Assessment",
          passMark: 70,
          questions: [
            { prompt: "Couch roll must be changed...", type: "SINGLE", options: ["Between every client", "Once a day", "Once a week", "When it tears"], correct: [0], explanation: "Fresh per client is the infection-control standard." },
            { prompt: "Jewellery near the treatment area should be...", type: "SINGLE", options: ["Removed before treatment", "Left on", "Covered with tape", "Placed on the couch"], correct: [0], explanation: "Metal near laser energy risks burns and reflection." },
            { prompt: "Pre-treatment photographs are taken to...", type: "SINGLE", options: ["Create a baseline record for comparison and medicolegal use", "Post online", "Check the lighting", "Avoid starting treatment"], correct: [0], explanation: "Before shots are a clinical and medicolegal requirement." },
            { prompt: "A test pulse is used to...", type: "SINGLE", options: ["Check the tissue response at planned settings before treating the full area", "Save energy", "Shorten the appointment", "Replace the patch test"], correct: [0], explanation: "It identifies unexpected reactions when the area treated is still small." },
            { prompt: "If you see unexpected blistering mid-treatment, you should...", type: "SINGLE", options: ["Stop, cool the area, protect it and document", "Increase the energy", "Continue", "Apply makeup"], correct: [0], explanation: "Stop immediately, protect the blister, and document." },
            { prompt: "Treatment notes must record...", type: "MULTI", options: ["Device and settings used", "Client response", "Date and area treated", "The best social media caption"], correct: [0, 1, 2], explanation: "Settings, response, date and area are all essential; social media captions are not." },
          ],
        },
      },
    ],
  },

  {
    courseSlug: "level-3-laser-aesthetic-therapies",
    modules: [
      {
        title: "Combination Treatments & Course Planning",
        summary: "How to plan a multi-session treatment programme and combine different energy-based modalities safely to achieve outcomes neither could reach alone.",
        lessons: [
          {
            title: "Building a Multi-Session Programme",
            durationMin: 12,
            objectives: ["Explain why courses deliver better outcomes than single sessions", "State standard treatment intervals for common laser modalities", "Write a structured written treatment plan"],
            studyTips: ["Standard intervals exist because the biological response (collagen remodelling, follicle cycling) takes time. Know the timeframes for hair removal, pigmentation and rejuvenation separately."],
            examRefs: ["Course planning", "Treatment intervals", "Written treatment plan"],
            steps: [
              { kind: "say", text: "Single sessions rarely deliver the full result. Understanding why courses work better makes you a much better clinician.", mood: "think" },
              { kind: "teach", title: "Why courses beat single sessions", text: "Laser and light treatments work with the body's own biology. Collagen remodelling, follicle cycling and pigment clearance all take weeks to complete. A course of spaced treatments compounds the response." },
              { kind: "teach", title: "Standard treatment intervals", text: "Hair removal: 4-8 weeks (to catch follicles cycling into anagen). Pigmentation and vascular: 4-6 weeks (allow clearance before the next session). Skin rejuvenation/photofacials: 3-4 weeks. Body contouring: 2-4 weeks." },
              { kind: "ask", prompt: "Why are laser hair removal sessions spaced 4-8 weeks apart?", qtype: "SINGLE", options: ["To allow follicles in other growth phases to enter anagen, where they can be targeted", "To save appointment time", "To fill the diary", "There is no reason"], correct: [0], explanation: "Only follicles in anagen respond; spacing the sessions catches more of them." },
              { kind: "teach", title: "The midcourse review", text: "Build a formal review into every programme, at the halfway point. Reassess the result, adjust settings if needed, manage expectations, and decide whether to continue or modify the plan." },
              { kind: "ask", prompt: "A formal midcourse review allows you to...", qtype: "MULTI", options: ["Adjust settings based on response", "Manage the client's expectations", "Modify the number of sessions if needed", "Skip the remaining appointments"], correct: [0, 1, 2], explanation: "Review is for adjustment and expectation management, not abandonment." },
              { kind: "teach", title: "The written treatment plan", text: "Document the agreed course: planned number of sessions, intervals, starting settings, target outcomes and review points. The client should be given a copy and sign to confirm they understand." },
              { kind: "ask", prompt: "A written treatment plan must include...", qtype: "MULTI", options: ["Number of sessions", "Treatment intervals", "Target outcomes", "The practitioner's personal opinions"], correct: [0, 1, 2], explanation: "Facts about the plan; not personal opinions." },
              { kind: "say", text: "A plan in writing protects both of you and sets clear expectations. Now: combining treatments safely.", mood: "cheer" },
            ],
          },
          {
            title: "Combining Modalities Safely",
            durationMin: 11,
            objectives: ["Explain the rationale for combining modalities", "Apply the one-modality-per-session rule correctly", "Identify contraindications that arise only in combination"],
            studyTips: ["The standard rule: one energy-based modality per session on the same area. Exceptions need specific clinical justification and training in both devices."],
            examRefs: ["Combination treatments", "Contraindications", "Treatment planning"],
            steps: [
              { kind: "say", text: "Combining modalities is powerful when done right -- and risky when done carelessly.", mood: "think" },
              { kind: "teach", title: "Why combine?", text: "Some outcomes cannot be achieved by one modality alone. IPL targets melanin and haemoglobin while RF targets the deeper dermis -- combining them on different days can address both pigment and laxity." },
              { kind: "teach", title: "The standard rule", text: "One energy-based modality per session on the same area. Cumulative heat from two devices in one session raises the risk of burns, PIH and prolonged downtime significantly." },
              { kind: "ask", prompt: "A client wants both IPL and RF skin tightening on the same cheek in the same appointment. What is the standard advice?", qtype: "SINGLE", options: ["Plan them in separate sessions to allow the skin to recover between treatments", "Do both in one session to save time", "Do the RF first and IPL immediately after", "Refuse all combination plans"], correct: [0], explanation: "Cumulative heat in one session raises burn and PIH risk; separate sessions are safer." },
              { kind: "teach", title: "Contraindication overlay", text: "When planning a combination programme, check whether adding the second modality introduces new contraindications. Some contraindications (e.g. recent IPL heat) make RF treatment less safe, and vice versa." },
              { kind: "ask", prompt: "Before adding a second modality to a treatment plan, you must...", qtype: "SINGLE", options: ["Check whether it introduces new contraindications for this client", "Assume it is safe if both are individually safe", "Ask the client to decide", "Skip the consultation"], correct: [0], explanation: "Contraindications can arise in combination that do not exist for either modality alone." },
              { kind: "teach", title: "Document the rationale", text: "If you use a combination approach, record in the treatment notes why it was chosen, the specific protocol used, and how the client was counselled about the additional risks." },
              { kind: "ask", prompt: "The reason for combining modalities should always be...", qtype: "SINGLE", options: ["Clinical benefit for this client, based on their assessed needs", "Convenience", "Charging more per session", "Following a trend"], correct: [0], explanation: "Clinical need, not convenience or revenue, drives the decision." },
              { kind: "say", text: "Combine to get better outcomes for the client -- not to impress or to save time.", mood: "think" },
            ],
          },
        ],
        quiz: {
          title: "Combination Treatments & Course Planning Assessment",
          passMark: 70,
          questions: [
            { prompt: "Standard laser hair removal sessions are spaced...", type: "SINGLE", options: ["4-8 weeks apart", "Daily", "Every 6 months", "Whenever convenient"], correct: [0], explanation: "4-8 weeks allows follicles to cycle into the anagen phase." },
            { prompt: "A formal midcourse review allows the clinician to...", type: "SINGLE", options: ["Adjust settings, manage expectations and modify the plan if needed", "Cancel remaining sessions", "Charge more", "Ignore the result so far"], correct: [0], explanation: "Review points are for clinical adjustment and expectation management." },
            { prompt: "The main risk of using two energy-based modalities on the same area in the same session is...", type: "SINGLE", options: ["Cumulative heat causing burns or PIH", "Better results", "Saving time", "Client satisfaction"], correct: [0], explanation: "Stacked heat from two devices in one session raises adverse event risk significantly." },
            { prompt: "Before adding a second modality to a plan, you must check for...", type: "SINGLE", options: ["New contraindications that arise in combination", "Extra revenue", "A bigger treatment room", "Nothing extra"], correct: [0], explanation: "Combinations can create contraindications that do not exist for either device alone." },
            { prompt: "A written treatment plan should be signed by...", type: "SINGLE", options: ["The client, to confirm they understand", "The device manufacturer", "The regulator", "Nobody"], correct: [0], explanation: "The client's signature confirms informed agreement to the plan." },
            { prompt: "The rationale for a combination treatment programme should be based on...", type: "SINGLE", options: ["The client's specific clinical needs", "Trend following", "Upselling", "Saving appointment time"], correct: [0], explanation: "Clinical need is the only valid basis for treatment decisions." },
          ],
        },
      },
    ],
  },

  {
    courseSlug: "advanced-aesthetics-level-5-7",
    modules: [
      {
        title: "Business Development & Clinical Governance",
        summary: "Clinical governance frameworks for advanced practice, and the principles of building a sustainable, ethical aesthetic business.",
        lessons: [
          {
            title: "Clinical Governance in Aesthetic Practice",
            durationMin: 13,
            objectives: ["Define clinical governance and its seven pillars", "Explain how incident reporting and the audit cycle improve safety", "Describe what a near-miss is and why reporting matters"],
            studyTips: ["Clinical governance is the framework that makes you accountable for quality. Regulators and insurers look for evidence that it is actually operating, not just written down."],
            examRefs: ["Clinical governance", "Incident reporting", "Audit", "Duty of candour"],
            steps: [
              { kind: "say", text: "Clinical governance is not a paper exercise. It is how you demonstrate that client safety is built into your practice.", mood: "think" },
              { kind: "teach", title: "What is clinical governance?", text: "Clinical governance is the framework through which an organisation and its clinicians are accountable for continuously improving quality and safeguarding high standards of care." },
              { kind: "ask", prompt: "Clinical governance is best described as...", qtype: "SINGLE", options: ["The framework through which you are accountable for quality and safety in practice", "A set of marketing rules", "A document you file once and forget", "A competitor analysis tool"], correct: [0], explanation: "Governance is an active, ongoing accountability framework." },
              { kind: "teach", title: "Seven pillars", text: "The seven pillars are: clinical effectiveness; patient safety; patient experience; workforce (competence and training); information and communication; audit; and leadership. Advanced practitioners are expected to operate across all seven." },
              { kind: "ask", prompt: "Which of these is a pillar of clinical governance?", qtype: "MULTI", options: ["Patient safety", "Clinical effectiveness", "Workforce training", "Choosing a logo"], correct: [0, 1, 2], explanation: "Safety, effectiveness and workforce are pillars; brand design is not." },
              { kind: "teach", title: "Incident reporting and near-misses", text: "Every adverse event and near-miss must be documented, reviewed and acted on. A near-miss is something that could have harmed a client but did not. Reporting it is how systems improve." },
              { kind: "ask", prompt: "A near-miss in clinical practice should be...", qtype: "SINGLE", options: ["Documented, reviewed and learned from", "Ignored because no harm occurred", "Hidden to protect the business", "Reported only if the client noticed"], correct: [0], explanation: "Near-misses are valuable learning opportunities; not reporting them is a governance failure." },
              { kind: "teach", title: "The audit cycle", text: "Set a standard. Collect data. Compare practice to the standard. Identify gaps. Make changes. Re-audit to confirm improvement. Skipping the re-audit step means you never know whether the change worked." },
              { kind: "ask", prompt: "The last step of the audit cycle is...", qtype: "SINGLE", options: ["Re-auditing to confirm the change improved practice", "Writing a report", "Filing the data", "Moving on to a new topic"], correct: [0], explanation: "Re-audit closes the loop and proves whether the change worked." },
              { kind: "say", text: "Governance is your evidence that you take safety seriously. It is what protects clients and what protects you.", mood: "cheer" },
            ],
          },
          {
            title: "Strategic Business Development",
            durationMin: 12,
            objectives: ["Describe a market analysis approach for an aesthetic practice", "Explain value-based pricing and when to use it", "Identify which marketing channels are compliant with CAP/ASA rules"],
            studyTips: ["Advanced practitioners are often practice owners or leads. Business literacy is examinable at Level 5-7 -- know pricing models and advertising compliance, not just clinical protocols."],
            examRefs: ["Business planning", "Pricing strategy", "Marketing compliance", "Service mix"],
            steps: [
              { kind: "say", text: "A brilliant clinician in a failing business helps no one. Business development is part of advanced practice.", mood: "think" },
              { kind: "teach", title: "Market analysis", text: "Understand who your ideal client is, what outcomes they want, what they are willing to pay, and who else in your area offers it. This shapes your service mix and pricing." },
              { kind: "teach", title: "Service mix", text: "Balance your menu: high-volume, lower-margin treatments (the revenue engine: laser hair removal, skin rejuvenation) with premium, higher-margin treatments (advanced injectables, combination programmes). Over-reliance on either extreme is fragile." },
              { kind: "ask", prompt: "A balanced service mix typically combines...", qtype: "SINGLE", options: ["High-volume treatments for revenue and premium treatments for margin", "Only the most expensive treatments", "Only the cheapest treatments", "Whatever the competitor offers"], correct: [0], explanation: "Volume and premium treatments together create a more resilient revenue base." },
              { kind: "teach", title: "Pricing models", text: "Cost-plus pricing sets price from your costs upward. Market-rate pricing matches local competition. Value-based pricing sets the price from the perceived benefit to the client. Advanced practitioners often use value-based for complex, outcome-driven programmes." },
              { kind: "ask", prompt: "Value-based pricing sets the price based on...", qtype: "SINGLE", options: ["The perceived value of the outcome to the client", "Your cost of supplies only", "Whatever a competitor charges", "A random figure"], correct: [0], explanation: "Value-based pricing reflects what the result is worth to that specific client, not just what it costs to deliver." },
              { kind: "teach", title: "Marketing compliance", text: "Aesthetic marketing must comply with CAP (Code of Advertising Practice) and ASA (Advertising Standards Authority) rules. Before/after images require explicit written consent. Claims must be truthful and substantiated. Avoid pressure tactics or misleading timelines." },
              { kind: "ask", prompt: "Before/after photographs used in marketing require...", qtype: "SINGLE", options: ["Explicit written consent from the client specifically for marketing use", "Only verbal agreement", "No consent if faces are blurred", "Automatic consent once treatment is paid for"], correct: [0], explanation: "Marketing use is separate from clinical consent. A specific, written consent for the marketing purpose is needed." },
              { kind: "teach", title: "Sustainable growth", text: "Sustainable growth comes from reputation and repeat business, not from discounting. Discounting attracts price-sensitive clients who do not return, and erodes your ability to invest in training and equipment." },
              { kind: "ask", prompt: "The most sustainable driver of practice growth is...", qtype: "SINGLE", options: ["Reputation and client retention", "Constant discounting", "Copying competitors", "Volume alone"], correct: [0], explanation: "Repeat clients and referrals are cheaper to acquire and more loyal than discount-seekers." },
              { kind: "say", text: "Business development done well is ethical, client-centred and sustainable. That is also what good governance looks like.", mood: "cheer" },
            ],
          },
        ],
        quiz: {
          title: "Business Development & Governance Assessment",
          passMark: 70,
          questions: [
            { prompt: "Clinical governance is best described as...", type: "SINGLE", options: ["An active accountability framework for quality and safety in practice", "A marketing strategy", "An annual filing requirement", "A competitor comparison"], correct: [0], explanation: "Governance is ongoing accountability, not a one-off document." },
            { prompt: "A near-miss in clinical practice should always be...", type: "SINGLE", options: ["Documented and reviewed, even if no harm occurred", "Ignored", "Blamed on the client", "Hidden from the team"], correct: [0], explanation: "Near-misses reveal system weaknesses before they cause real harm." },
            { prompt: "The final step of the audit cycle is...", type: "SINGLE", options: ["Re-audit to confirm the improvement worked", "Writing a summary", "Starting a new audit immediately", "Stopping the process"], correct: [0], explanation: "Re-audit closes the loop and proves improvement." },
            { prompt: "Value-based pricing sets the price from...", type: "SINGLE", options: ["The perceived benefit of the outcome to the client", "Your costs alone", "A standard price list", "Competitor prices only"], correct: [0], explanation: "Value-based pricing reflects what the result is worth to the client." },
            { prompt: "Before/after images used in marketing need...", type: "SINGLE", options: ["Explicit written consent for marketing use specifically", "Verbal consent only", "No consent", "Automatic consent"], correct: [0], explanation: "Clinical consent and marketing consent are separate; explicit written consent is needed for both." },
            { prompt: "Sustainable practice growth depends most on...", type: "SINGLE", options: ["Reputation and client retention", "Discounting constantly", "Volume of new clients only", "Copying competitors"], correct: [0], explanation: "Repeat clients and referrals are the most durable source of growth." },
          ],
        },
      },
    ],
  },

  {
    courseSlug: "level-4-certificate-aesthetic-practice",
    modules: [
      {
        title: "Legal Frameworks & Professional Accountability",
        summary: "UK aesthetics regulation, vicarious and personal liability, scope of practice, duty of candour, adverse event reporting, professional indemnity insurance, and what makes a defensible clinical record.",
        lessons: [
          {
            title: "UK Regulation, Licensing & Scope of Practice",
            durationMin: 14,
            objectives: ["Describe the current UK regulatory landscape for aesthetics", "Explain local licensing requirements for Class 3B/4 lasers", "Define scope of practice and why it matters"],
            studyTips: ["HEE and the JCCP set workforce standards; the CQC oversees clinical settings; local authorities license laser use. Know which body does what."],
            examRefs: ["Regulation", "Licensing", "Scope of practice"],
            steps: [
              { kind: "say", text: "Knowing the regulatory landscape protects your clients, your career and your business.", mood: "think" },
              { kind: "teach", title: "HEE and JCCP", text: "Health Education England (HEE) and the Joint Council for Cosmetic Practitioners (JCCP) set the competency and qualification standards for the UK aesthetics workforce." },
              { kind: "ask", prompt: "Which body sets competency standards for the UK aesthetics workforce?", qtype: "SINGLE", options: ["JCCP / HEE", "The local council only", "The client", "No body regulates this"], correct: [0], explanation: "The JCCP and HEE set the workforce standards practitioners are expected to meet." },
              { kind: "teach", title: "Local authority laser licensing", text: "Class 3B and Class 4 lasers used for cosmetic treatments require a local authority licence under the Local Government (Miscellaneous Provisions) Act 1982 in England and Wales." },
              { kind: "ask", prompt: "Class 3B and 4 cosmetic lasers require a licence from...", qtype: "SINGLE", options: ["The local authority", "The client", "The device manufacturer only", "No licence is needed"], correct: [0], explanation: "Local authority licensing is a legal requirement before using these lasers commercially." },
              { kind: "teach", title: "CQC oversight", text: "The Care Quality Commission (CQC) regulates clinical settings in England; if your practice carries out procedures classified as regulated activities, CQC registration may be required." },
              { kind: "ask", prompt: "The CQC is primarily concerned with...", qtype: "SINGLE", options: ["Clinical care quality and safety in registered settings", "Laser licences only", "Pricing of treatments", "Social media advertising"], correct: [0], explanation: "CQC regulates quality and safety of regulated health activities." },
              { kind: "teach", title: "Scope of practice", text: "Scope of practice means performing only those treatments you are trained, insured and competent to deliver -- working outside it risks the client and exposes you to liability." },
              { kind: "ask", prompt: "Working within your scope of practice means...", qtype: "SINGLE", options: ["Only treating within your training, competence and insurance", "Doing whatever a client requests", "Following a colleague's advice only", "Avoiding all complex cases"], correct: [0], explanation: "Scope is defined by qualification, demonstrated competence and valid insurance coverage." },
              { kind: "say", text: "Now you know who regulates what. Next: when things go wrong.", mood: "think" },
            ],
          },
          {
            title: "Liability, Duty of Candour & Defensible Records",
            durationMin: 13,
            objectives: ["Distinguish vicarious from personal liability", "Explain the duty of candour", "Describe what makes a record defensible in a dispute"],
            studyTips: ["When something goes wrong the answer is always: stop, record, be honest, report, support the client."],
            examRefs: ["Liability", "Duty of candour", "Adverse event reporting", "Indemnity insurance"],
            steps: [
              { kind: "say", text: "Even excellent practitioners face complaints. Knowing your legal position is essential.", mood: "think" },
              { kind: "teach", title: "Personal vs vicarious liability", text: "Personal liability is your own responsibility for your actions; vicarious liability is an employer's responsibility for the acts of an employee within their role." },
              { kind: "ask", prompt: "When an employer is legally responsible for an employee's clinical error, this is called...", qtype: "SINGLE", options: ["Vicarious liability", "Personal liability", "Strict liability", "No liability"], correct: [0], explanation: "Vicarious liability: the employer may be sued for an employee's negligent acts within their role." },
              { kind: "teach", title: "Professional indemnity insurance", text: "Professional indemnity insurance covers legal costs and compensation claims arising from professional errors or omissions -- it must be valid for each specific procedure you perform." },
              { kind: "ask", prompt: "Professional indemnity insurance must cover...", qtype: "SINGLE", options: ["Each specific procedure you perform", "Only injections", "All treatments regardless of training", "Nothing -- it is optional"], correct: [0], explanation: "Cover must be specific to the procedure; performing an uninsured treatment leaves you personally exposed." },
              { kind: "teach", title: "Duty of candour", text: "The duty of candour requires you to be open and honest with a client when something has gone wrong with their treatment, offer an apology, and explain what happened." },
              { kind: "ask", prompt: "The duty of candour requires you to...", qtype: "SINGLE", options: ["Be open, honest and apologise when something goes wrong", "Stay silent to avoid claims", "Blame the client", "Delete the record"], correct: [0], explanation: "Honesty, an apology and a plan to put things right are all required." },
              { kind: "teach", title: "Adverse event reporting", text: "Serious adverse events must be reported to the MHRA (yellow card scheme for devices), your insurer, and -- where applicable -- the CQC." },
              { kind: "ask", prompt: "A serious adverse event linked to a medical device should be reported to...", qtype: "SINGLE", options: ["The MHRA (yellow card scheme)", "Social media only", "Nobody", "The client's GP only"], correct: [0], explanation: "The MHRA yellow card scheme captures device-related adverse events." },
              { kind: "teach", title: "The defensible record", text: "A defensible record is contemporaneous, complete, signed, and shows the rationale for decisions made -- it demonstrates you acted reasonably and in the client's best interests." },
              { kind: "ask", prompt: "A defensible record must be...", qtype: "MULTI", options: ["Contemporaneous", "Complete", "Show the rationale for decisions", "Written weeks later"], correct: [0, 1, 2], explanation: "Written at the time, complete and reasoned -- not reconstructed after the fact." },
              { kind: "say", text: "Honest practice, good records and the right insurance keep you and your clients protected. Excellent work.", mood: "cheer" },
            ],
          },
        ],
        quiz: {
          title: "Legal Frameworks & Professional Accountability Assessment",
          passMark: 70,
          questions: [
            { prompt: "Class 3B and Class 4 cosmetic lasers require a licence from...", type: "SINGLE", options: ["The local authority", "The manufacturer", "The client", "No licence needed"], correct: [0], explanation: "Local authority licensing is a legal requirement under the Local Government (Miscellaneous Provisions) Act 1982." },
            { prompt: "Working within scope of practice means only treating within your training, competence and...", type: "WORD", options: ["insurance", "diary", "budget"], correct: [0], explanation: "Training, competence and valid insurance together define your scope." },
            { prompt: "Vicarious liability applies when...", type: "SINGLE", options: ["An employer is held responsible for an employee's negligent act", "A practitioner is personally sued", "A client causes harm", "No one is responsible"], correct: [0], explanation: "Vicarious liability: the employer can be liable for acts of an employee within their role." },
            { prompt: "Professional indemnity insurance must be valid for each specific procedure performed.", type: "TRUEFALSE", options: ["True", "False"], correct: [0], explanation: "Generic cover does not protect you for procedures not listed in the policy." },
            { prompt: "The duty of candour requires you to be open and honest when something goes wrong.", type: "TRUEFALSE", options: ["True", "False"], correct: [0], explanation: "Openness, an apology and a plan to put things right are all required." },
            { prompt: "A serious adverse event linked to a medical device should be reported to the...", type: "WORD", options: ["MHRA", "client only", "nobody"], correct: [0], explanation: "The Medicines and Healthcare products Regulatory Agency (MHRA) collects device-related adverse event reports." },
          ],
        },
      },
    ],
  },

  // ── Batch 8 ─────────────────────────────────────────────────────────────────

  {
    courseSlug: L2,
    modules: [
      {
        title: 'Electrical Safety & Equipment Maintenance',
        summary: 'Identify electrical hazards in the treatment room, carry out basic equipment checks, and know when to report or remove a faulty device.',
        lessons: [
          {
            title: 'Electrical Hazards & Safe Working',
            durationMin: 10,
            objectives: ['Identify electrical hazards in a treatment room', 'Describe how to work safely with electrical devices', 'Know what to do when a fault is found'],
            studyTips: ['All electrical treatment devices must be PAT-tested. If a device looks damaged, do not use it -- report it.'],
            examRefs: ['Health and safety', 'Equipment safety'],
            steps: [
              { kind: 'say', text: 'Every electrical device in the treatment room carries a risk if not maintained. Let\'s keep things safe.', mood: 'think' },
              { kind: 'teach', title: 'Common electrical hazards', text: 'Frayed cables, overloaded sockets, damaged plugs, and wet hands near equipment are the main risks in a treatment room.' },
              { kind: 'ask', prompt: 'Which of these is an electrical hazard in a treatment room?', qtype: 'MULTI', options: ['Frayed cable', 'Overloaded socket', 'Wet hands near a device', 'A clean plug'], correct: [0, 1, 2], explanation: 'A clean plug is fine. The others are hazards.' },
              { kind: 'teach', title: 'Before you plug in', text: 'Before each use, visually check the device: cable intact, plug undamaged, no signs of burning or melting, no liquid near the unit.' },
              { kind: 'ask', prompt: 'Before using an electrical device you should first...', qtype: 'SINGLE', options: ['Visually check the cable, plug and unit', 'Start immediately', 'Ignore the cable', 'Check only the price'], correct: [0], explanation: 'A visual check before every use catches faults early.' },
              { kind: 'teach', title: 'If you find a fault', text: 'If a device looks or smells wrong, do not use it. Switch it off, unplug it, label it "do not use" and report it to a supervisor immediately.' },
              { kind: 'ask', prompt: 'You notice a burning smell from a device mid-treatment. You should...', qtype: 'SINGLE', options: ['Stop, switch off, unplug, label and report', 'Carry on for this client', 'Spray water on it', 'Ignore it and watch for smoke'], correct: [0], explanation: 'Stop immediately. Any sign of electrical fault is a safety emergency.' },
              { kind: 'say', text: 'Safety first, always. A quick check takes seconds and can prevent injury.', mood: 'cheer' },
            ],
          },
          {
            title: 'Equipment Checks, PAT Testing & Records',
            durationMin: 10,
            objectives: ['Explain what PAT testing is and why it matters', 'Understand who carries out PAT testing', 'Describe equipment maintenance records'],
            studyTips: ['PAT = Portable Appliance Testing. It must be done by a competent person (often an electrician or trained staff member) and the results recorded.'],
            examRefs: ['Health and safety', 'Equipment maintenance', 'PAT testing'],
            steps: [
              { kind: 'say', text: 'Daily checks are your job. Periodic testing is for a competent person. Let\'s see how both work together.', mood: 'happy' },
              { kind: 'teach', title: 'What is PAT testing?', text: 'Portable Appliance Testing (PAT) is an inspection and electrical test of portable equipment to ensure it is safe to use. It is carried out by a competent person and the results are recorded.' },
              { kind: 'ask', prompt: 'PAT testing must be carried out by...', qtype: 'SINGLE', options: ['A competent person', 'Any client', 'The device manufacturer only', 'Nobody'], correct: [0], explanation: 'A competent person -- often a trained staff member or electrician -- carries out PAT testing.' },
              { kind: 'teach', title: 'How often?', text: 'Frequency depends on the device and how it is used. High-use equipment in a busy clinic is often tested annually, but your employer\'s risk assessment sets the schedule.' },
              { kind: 'ask', prompt: 'How often high-use equipment in a clinic is PAT-tested is set by...', qtype: 'SINGLE', options: ['The employer\'s risk assessment', 'Never', 'Only once ever', 'The client'], correct: [0], explanation: 'The employer\'s risk assessment determines the correct testing interval.' },
              { kind: 'teach', title: 'Equipment records', text: 'All maintenance, PAT results, and reported faults must be recorded. This forms an audit trail and shows your legal duty of care has been met.' },
              { kind: 'ask', prompt: 'Why must equipment maintenance and PAT results be recorded?', qtype: 'MULTI', options: ['To meet the legal duty of care', 'To show faults were acted on', 'To create an audit trail', 'To decorate the wall'], correct: [0, 1, 2], explanation: 'Records prove compliance and support any incident investigation.' },
              { kind: 'say', text: 'Good records protect your clients, your employer and you.', mood: 'cheer' },
            ],
          },
        ],
        quiz: {
          title: 'Electrical Safety & Equipment Assessment',
          passMark: 70,
          questions: [
            { prompt: 'Which of these is an electrical hazard in a treatment room?', type: 'MULTI', options: ['Frayed cable', 'Overloaded socket', 'Wet hands near a device', 'A clean, intact plug'], correct: [0, 1, 2], explanation: 'A sound plug is safe; the others are hazards.' },
            { prompt: 'If a device smells of burning you should immediately...', type: 'SINGLE', options: ['Stop, switch off, unplug, label and report', 'Finish the treatment first', 'Spray water on it', 'Ignore it'], correct: [0], explanation: 'Any electrical fault is a safety emergency -- stop at once.' },
            { prompt: 'PAT testing must be carried out by a competent person.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'Only a competent person may carry out PAT testing.' },
            { prompt: 'PAT testing stands for Portable ___ Testing.', type: 'WORD', options: ['Appliance', 'Antenna', 'Application'], correct: [0], explanation: 'Portable Appliance Testing.' },
            { prompt: 'How often equipment is PAT-tested in a clinic is determined by the employer\'s...', type: 'SINGLE', options: ['Risk assessment', 'Favourite colour', 'Opening hours', 'Lunch schedule'], correct: [0], explanation: 'The risk assessment sets the testing frequency.' },
            { prompt: 'Equipment maintenance and PAT records must be kept to form an...', type: 'WORD', options: ['audit trail', 'expense', 'obstacle'], correct: [0], explanation: 'An audit trail proves due diligence and supports any investigation.' },
          ],
        },
      },
    ],
  },

  {
    courseSlug: 'level-3-laser-aesthetic-therapies',
    modules: [
      {
        title: 'Combination Protocols & Treatment Sequencing',
        summary: 'How to plan treatments that involve more than one modality: the right order, safe intervals between sessions, and when combining treatments creates risk rather than benefit.',
        lessons: [
          {
            title: 'Why Sequencing Order Matters',
            durationMin: 11,
            objectives: ['Explain why treatment order affects outcomes and safety', 'Identify which modalities interact and why', 'Describe the risks of incorrect sequencing'],
            studyTips: ['Think of the skin as recovering from each treatment. What heals first opens the door for the next modality safely.'],
            examRefs: ['Treatment planning', 'Combination therapies'],
            steps: [
              { kind: 'say', text: 'Combining treatments can give great results -- or serious harm. Order matters enormously.', mood: 'think' },
              { kind: 'teach', title: 'Why sequence matters', text: 'Each treatment changes the skin\'s condition. A resurfacing treatment leaves the barrier disrupted; applying laser energy over disrupted skin raises burn risk. The sequence determines what the skin\'s state is at each step.' },
              { kind: 'ask', prompt: 'Applying laser energy over recently resurfaced skin raises the risk of...', qtype: 'SINGLE', options: ['Burns and adverse reaction', 'Better results', 'No change', 'Faster healing'], correct: [0], explanation: 'Disrupted barrier + energy = elevated burn and pigmentation risk.' },
              { kind: 'teach', title: 'General rule: least aggressive first', text: 'As a starting principle, perform the least aggressive treatment first (e.g. cleansing, mild exfoliation) before energy-based modalities.' },
              { kind: 'ask', prompt: 'As a general rule, in a combination session you should perform the least aggressive step...', qtype: 'SINGLE', options: ['First', 'Last', 'At any point', 'Skip it entirely'], correct: [0], explanation: 'Least aggressive first preserves the skin\'s integrity for subsequent steps.' },
              { kind: 'teach', title: 'Chemical peels and laser', text: 'Chemical peels (especially medium to deep) and laser resurfacing should never be combined in the same session. Both disrupt the epidermal barrier; doing both at once dramatically increases risk.' },
              { kind: 'ask', prompt: 'A medium chemical peel and a laser resurfacing treatment should...', qtype: 'SINGLE', options: ['Never be combined in the same session', 'Always be done together', 'Be done only with no gap', 'Improve each other with no risk'], correct: [0], explanation: 'Combining two barrier-disrupting modalities in one session is unsafe.' },
              { kind: 'say', text: 'The rule is simple: respect what the skin has just been through before adding more.', mood: 'cheer' },
            ],
          },
          {
            title: 'Safe Intervals & Combination Contraindications',
            durationMin: 11,
            objectives: ['Recommend safe intervals between specific treatment modalities', 'Identify contraindications that arise only when treatments are combined', 'Advise clients on at-home care between modalities'],
            studyTips: ['Laser + tanning (natural or spray) is always contraindicated. Never let a client be treated with active tan.'],
            examRefs: ['Combination therapies', 'Contraindications', 'Treatment planning'],
            steps: [
              { kind: 'say', text: 'Now let\'s get specific about intervals and which combinations are always off the table.', mood: 'happy' },
              { kind: 'teach', title: 'Intervals between sessions', text: 'The interval depends on how disruptive each treatment is. Mild LED therapy might allow another session within days; laser resurfacing needs weeks for full barrier recovery before repeat energy-based treatment.' },
              { kind: 'ask', prompt: 'After laser resurfacing, the next energy-based treatment is usually safe after...', qtype: 'SINGLE', options: ['Several weeks of barrier recovery', 'The next day', 'One hour', 'Six months always'], correct: [0], explanation: 'The barrier must be fully healed before more energy is applied.' },
              { kind: 'teach', title: 'Active tan is always a contraindication for laser', text: 'Laser and IPL with an active tan (natural or spray) is always contraindicated. The extra melanin in the tan absorbs energy unpredictably, dramatically raising burn and pigmentation-change risk.' },
              { kind: 'ask', prompt: 'A client comes in with a recent spray tan. Your action for their laser appointment is to...', qtype: 'SINGLE', options: ['Postpone until the tan has faded', 'Proceed but reduce settings slightly', 'Treat as normal', 'Apply more cooling gel and continue'], correct: [0], explanation: 'Any tan -- natural or spray -- is a contraindication for laser and IPL.' },
              { kind: 'teach', title: 'Injectable and laser timing', text: 'Laser treatment near a recent injectable site (e.g. filler or anti-wrinkle) carries added risk. Wait at least two weeks after injectables before laser in the same area.' },
              { kind: 'ask', prompt: 'After a dermal filler in the cheek, a safe minimum wait before laser in that area is...', qtype: 'SINGLE', options: ['At least two weeks', 'Twenty-four hours', 'No wait needed', 'Six weeks always'], correct: [0], explanation: 'Two weeks is the commonly accepted minimum; longer if the area is still settling.' },
              { kind: 'say', text: 'Good combination planning protects outcomes and client safety. Always document your reasoning.', mood: 'cheer' },
            ],
          },
        ],
        quiz: {
          title: 'Combination Protocols Assessment',
          passMark: 70,
          questions: [
            { prompt: 'When combining treatments, the least aggressive step should generally be performed...', type: 'SINGLE', options: ['First', 'Last', 'At random', 'Only once ever'], correct: [0], explanation: 'Least aggressive first preserves the skin\'s integrity for subsequent steps.' },
            { prompt: 'A medium chemical peel and laser resurfacing in the same session is...', type: 'SINGLE', options: ['Unsafe and should never be combined', 'Recommended for faster results', 'Fine with extra cooling', 'Neutral in effect'], correct: [0], explanation: 'Both disrupt the barrier; combining them dramatically elevates risk.' },
            { prompt: 'An active tan (natural or spray) before laser treatment is...', type: 'SINGLE', options: ['A contraindication', 'Beneficial', 'Irrelevant', 'Preferred'], correct: [0], explanation: 'Extra melanin in the tan absorbs energy unpredictably.' },
            { prompt: 'After laser resurfacing, the next energy-based treatment requires the ___ to recover first.', type: 'WORD', options: ['barrier', 'melanin', 'dermis'], correct: [0], explanation: 'Full barrier recovery is needed before repeating energy-based treatment.' },
            { prompt: 'A minimum of two weeks should pass after a dermal filler before laser in the same area.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'Two weeks is the accepted minimum to reduce risk in the treated area.' },
            { prompt: 'Why must treatment sequencing be documented?', type: 'MULTI', options: ['To show reasoning if a complication occurs', 'To support future treatment planning', 'To meet audit requirements', 'To hide mistakes'], correct: [0, 1, 2], explanation: 'Documentation supports safety, accountability and continuity of care.' },
          ],
        },
      },
    ],
  },

  {
    courseSlug: 'level-4-certificate-aesthetic-practice',
    modules: [
      {
        title: 'Client Psychology & Wellbeing',
        summary: 'Recognise the psychological dimension of aesthetic treatments, build therapeutic rapport, spot the signs of body dysmorphic disorder, and know when referring to other professionals is the right call.',
        lessons: [
          {
            title: 'Understanding Client Psychology',
            durationMin: 11,
            objectives: ['Explain why motivation and self-image matter in aesthetics', 'Describe how to build therapeutic rapport', 'Identify unrealistic expectations and how to address them'],
            studyTips: ['Aesthetic treatments affect how a person feels about themselves, not just how they look. Understanding this protects both the client and you.'],
            examRefs: ['Client consultation', 'Ethics', 'Client psychology'],
            steps: [
              { kind: 'say', text: 'Aesthetic treatments are not just physical. Understanding your client\'s psychology is part of safe practice.', mood: 'think' },
              { kind: 'teach', title: 'Motivation matters', text: 'A client who wants to feel more like themselves after illness is in a very different headspace to one who wants to look like a filtered photo. Understanding motivation shapes what you offer and how.' },
              { kind: 'ask', prompt: 'Why does a client\'s motivation for treatment matter?', qtype: 'SINGLE', options: ['It helps you tailor treatment and spot risk factors', 'It determines the price', 'It is irrelevant to the outcome', 'It only matters for new clients'], correct: [0], explanation: 'Motivation reveals what the client really wants and flags psychological risk factors.' },
              { kind: 'teach', title: 'Building rapport', text: 'Use open questions, listen without interrupting, mirror language, and avoid leading suggestions. A client who feels heard is more likely to disclose concerns honestly.' },
              { kind: 'ask', prompt: 'Which approach best builds therapeutic rapport with a client?', qtype: 'MULTI', options: ['Open questions', 'Listening without interrupting', 'Avoiding leading suggestions', 'Telling them what they need immediately'], correct: [0, 1, 2], explanation: 'Open questions, active listening and no leading suggestions create a safe space for honest disclosure.' },
              { kind: 'teach', title: 'Unrealistic expectations', text: 'When a client expects perfection, or expresses distress entirely out of proportion to the perceived flaw, this is a red flag. Document, address it calmly, and consider whether treatment is appropriate at all.' },
              { kind: 'ask', prompt: 'A client is extremely distressed about a feature that appears minor to you. The right response is to...', qtype: 'SINGLE', options: ['Document, address calmly, consider whether treatment is appropriate', 'Treat immediately to reassure them', 'Dismiss their concern', 'Offer the most aggressive option'], correct: [0], explanation: 'Disproportionate distress is a clinical flag -- document and assess before proceeding.' },
              { kind: 'say', text: 'Listening as carefully as you treat is what separates a good practitioner from an excellent one.', mood: 'cheer' },
            ],
          },
          {
            title: 'Recognising BDD & When to Refer',
            durationMin: 12,
            objectives: ['Describe body dysmorphic disorder (BDD) and how it presents', 'Explain why aesthetic treatment does not help BDD', 'Know when and how to refer a client to mental health support'],
            studyTips: ['BDD = Body Dysmorphic Disorder. The JCCP and major industry bodies say you must not treat a client with suspected BDD. Treatment won\'t resolve the underlying distress and may worsen it.'],
            examRefs: ['Body dysmorphic disorder', 'Safeguarding', 'Ethics', 'Client psychology'],
            steps: [
              { kind: 'say', text: 'BDD is a recognised mental health condition. Knowing the signs protects your clients and your practice.', mood: 'think' },
              { kind: 'teach', title: 'What is BDD?', text: 'Body Dysmorphic Disorder is an obsessive preoccupation with a perceived flaw in appearance that others cannot see or consider minor. It causes significant distress and impaired daily function.' },
              { kind: 'ask', prompt: 'Body Dysmorphic Disorder is best described as...', qtype: 'SINGLE', options: ['Obsessive preoccupation with a perceived appearance flaw causing real distress', 'A preference for cosmetic treatment', 'A normal level of self-consciousness', 'A skin condition'], correct: [0], explanation: 'BDD is a mental health condition characterised by obsessive, distressing focus on a perceived flaw.' },
              { kind: 'teach', title: 'Red-flag signs in a consultation', text: 'Warning signs include: repeated consultations about the same minor issue, requests to look like a specific celebrity or filtered image, requesting multiple areas in one session, arriving with altered photos, and previous treatment dissatisfaction despite good results.' },
              { kind: 'ask', prompt: 'Which of these may indicate BDD during a consultation?', qtype: 'MULTI', options: ['Repeated consultations about one minor feature', 'Wanting to look like a filtered image of themselves', 'Dissatisfied despite objectively good previous results', 'A single clear treatment goal discussed calmly'], correct: [0, 1, 2], explanation: 'A calm, single clear goal is healthy. The others are red flags for BDD or unrealistic expectations.' },
              { kind: 'teach', title: 'Why treatment does not help BDD', text: 'Aesthetic treatment does not resolve BDD because the problem is the client\'s perception, not their appearance. Treating often moves the focus to the next perceived flaw.' },
              { kind: 'ask', prompt: 'If a client has suspected BDD, aesthetic treatment should be...', qtype: 'SINGLE', options: ['Declined and the client signposted to mental health support', 'Offered at a discount', 'Agreed to immediately to reassure them', 'Offered in smaller steps only'], correct: [0], explanation: 'Treatment doesn\'t resolve BDD and may worsen distress. Decline and refer to appropriate support.' },
              { kind: 'teach', title: 'How to decline and refer', text: 'Be calm, non-judgemental and clear. Say you believe treatment is not right for them at this time, and signpost them to their GP or a mental health service. Document the decision and your reasoning.' },
              { kind: 'ask', prompt: 'When declining a client for suspected BDD, you should...', qtype: 'MULTI', options: ['Be calm and non-judgemental', 'Signpost to GP or mental health support', 'Document your reasoning', 'Offer the treatment anyway with a caveat'], correct: [0, 1, 2], explanation: 'Calm, compassionate refusal with a clear referral pathway and full documentation.' },
              { kind: 'say', text: 'Declining a client when it is the right thing to do is a sign of a skilled, ethical practitioner.', mood: 'cheer' },
            ],
          },
        ],
        quiz: {
          title: 'Client Psychology & Wellbeing Assessment',
          passMark: 70,
          questions: [
            { prompt: 'Understanding a client\'s motivation for treatment helps you...', type: 'SINGLE', options: ['Tailor treatment and spot psychological risk factors', 'Set the price', 'Skip the consultation', 'Choose the strongest modality'], correct: [0], explanation: 'Motivation reveals what they really want and flags red flags.' },
            { prompt: 'Building therapeutic rapport involves...', type: 'MULTI', options: ['Open questions', 'Listening without interrupting', 'Avoiding leading suggestions', 'Immediately recommending the priciest option'], correct: [0, 1, 2], explanation: 'Open questions, active listening and no steering.' },
            { prompt: 'Body Dysmorphic Disorder is characterised by obsessive distress about a perceived appearance flaw.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'BDD causes significant real distress about a perceived (often minor or absent) flaw.' },
            { prompt: 'If BDD is suspected, aesthetic treatment is...', type: 'SINGLE', options: ['Contraindicated', 'Recommended immediately', 'Fine with reduced settings', 'Only for small areas'], correct: [0], explanation: 'Treatment will not resolve BDD and may worsen distress. Decline and refer.' },
            { prompt: 'When declining a client for BDD, you should document...', type: 'SINGLE', options: ['Your reasoning and what you signposted them to', 'Nothing', 'The client\'s address only', 'The cost of the missed appointment'], correct: [0], explanation: 'Documentation of the decision and referral pathway is essential.' },
            { prompt: 'Repeated, obsessive consultations about a single minor feature may indicate...', type: 'SINGLE', options: ['Possible BDD', 'Good client engagement', 'High satisfaction', 'A need for the most advanced treatment'], correct: [0], explanation: 'Repeated distress about a minor feature is a BDD red flag.' },
          ],
        },
      },
    ],
  },

  // -- BATCH 9 modules ---------------------------------------------------------

  {
    courseSlug: L2,
    modules: [
      {
        title: 'Record Keeping & Data Protection in Practice',
        summary: 'Understand what to record after every treatment, how long to keep it, and what GDPR requires of clinic data.',
        lessons: [
          {
            title: 'Client Records: What, Why and When',
            durationMin: 10,
            objectives: ['State the minimum record-keeping requirements for laser treatments', 'Explain why comprehensive records protect both client and practitioner', 'Describe what a good treatment note includes'],
            steps: [
              { kind: 'teach', title: 'Why records matter', text: 'A client record is a legal document. It shows what you assessed, what you did, and what advice you gave — your first line of defence if a complaint is ever made.' },
              { kind: 'teach', title: 'Before treatment', text: 'Record the consultation findings: medical history, contraindications checked, patch test result, the client\'s skin type, and the signed consent form reference.' },
              { kind: 'ask', prompt: 'Which of these belongs in a pre-treatment record?', options: ['Patch test result and skin type', 'The treatment room temperature', 'How long the client waited', 'The practitioner\'s lunch break'], correct: [0], explanation: 'Clinical findings and safety checks are the pre-treatment record; logistics are not.' },
              { kind: 'teach', title: 'During treatment', text: 'Note the device used, the settings (wavelength, fluence, pulse width), the area treated, and the number of passes.' },
              { kind: 'ask', prompt: 'Why record the exact treatment settings?', options: ['So future sessions can be adapted safely', 'To fill the record card', 'For marketing purposes', 'The equipment manufacturer requires it'], correct: [0], explanation: 'Knowing what worked (or caused a reaction) is essential for the next visit.' },
              { kind: 'teach', title: 'After treatment', text: 'Record the client\'s immediate reaction, any cooling or first aid applied, and the aftercare advice you gave (and how).' },
              { kind: 'ask', prompt: 'What should be noted if a client\'s skin blisters during a treatment?', options: ['The blister, the action taken, advice given, and follow-up plan', 'Nothing — mild reactions are expected', 'The blister only', 'The device brand name'], correct: [0], explanation: 'Adverse events must be documented in full: what happened, what you did, and what you said.' },
              { kind: 'teach', title: 'Signatures', text: 'The client\'s signature on the consent form confirms they were informed. Retain the original or a secure digital copy alongside the session record.' },
              { kind: 'ask', prompt: 'A client\'s consent form must be kept for at least...', options: ['7 years (or until the client is 25, if younger)', '6 months', '28 days', 'Indefinitely'], correct: [0], explanation: 'HMRC retention rules apply to financial records; for clinical records, 7 years is the standard minimum for adults and until age 25 for minors.' },
              { kind: 'say', text: 'Well-kept records are not admin — they are clinical care. They protect the client if things go wrong and protect you if a claim is ever made.' },
            ],
          },
          {
            title: 'GDPR & Data Protection in the Clinic',
            durationMin: 10,
            objectives: ['Name the lawful basis for processing client health data', 'Describe what a subject access request (SAR) requires', 'State how to handle a right-to-erasure request'],
            steps: [
              { kind: 'teach', title: 'What is personal data?', text: 'Any data that can identify a living person — name, date of birth, phone number, email, photos, treatment notes.' },
              { kind: 'teach', title: 'Special category data', text: 'Health data is "special category" under UK GDPR. Processing it requires both a lawful basis AND an additional condition — typically "provision of health care" or explicit consent.' },
              { kind: 'ask', prompt: 'Before-treatment clinical photographs are classed as...', options: ['Special category data (health)', 'General personal data', 'Public information', 'Anonymous data'], correct: [0], explanation: 'Photos linked to a named client and their health condition are special category data — they need explicit consent and secure storage.' },
              { kind: 'teach', title: 'Retention limits', text: 'You may only keep data for as long as you need it. For clinical records, the standard is 7 years post-treatment for adults. After that, data should be securely deleted.' },
              { kind: 'teach', title: 'Subject Access Requests', text: 'Any client can ask you to provide a copy of all the personal data you hold on them. You must respond within one month at no charge.' },
              { kind: 'ask', prompt: 'A client asks for all the data you hold on them. This is called a...', type: 'WORD', options: ['Subject Access Request', 'Privacy Notice', 'Consent Form'], correct: [0], explanation: 'A Subject Access Request (SAR) is the client\'s legal right under UK GDPR Art. 15.' },
              { kind: 'teach', title: 'Right to erasure', text: 'Clients can request deletion of their data. You must comply unless you have a legal obligation to retain it (e.g. financial records for HMRC).' },
              { kind: 'ask', prompt: 'A client asks you to delete all their records. You must comply with all records EXCEPT those...', options: ['Kept for legal or regulatory reasons (e.g. financial records)', 'That are inconvenient to delete', 'Held for more than 7 years', 'In paper format'], correct: [0], explanation: 'HMRC and other legal obligations override the right to erasure for the relevant records.' },
              { kind: 'say', text: 'GDPR is not just for large companies. Every clinic that holds client data must comply — and non-compliance can lead to fines and reputational damage.' },
            ],
          },
        ],
        quiz: {
          title: 'Record Keeping & Data Protection Assessment',
          passMark: 70,
          questions: [
            { prompt: 'A treatment record must include the device settings used.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'Settings are a clinical record requirement — without them you cannot safely repeat or adapt treatment.' },
            { prompt: 'Client health data belongs to which GDPR category?', options: ['Special category data', 'General personal data', 'Anonymous data', 'Public data'], correct: [0], explanation: 'Health data is special category under UK GDPR and requires additional conditions for processing.' },
            { prompt: 'A Subject Access Request must be fulfilled within...', options: ['One calendar month', 'Six months', '7 working days', 'One week'], correct: [0], explanation: 'UK GDPR Art. 15: respond within one month, at no charge.' },
            { prompt: 'After an adverse reaction during a treatment, you should document...', options: ['The reaction, action taken, advice given, and follow-up plan', 'Nothing if it resolved quickly', 'The device brand only', 'The reaction only'], correct: [0], explanation: 'All elements of an adverse event must be captured — incomplete records can be as damaging as no records.' },
            { prompt: 'Before-treatment consent forms should be retained for at least...', options: ['7 years for adults', '6 months', '28 days', 'There is no requirement'], correct: [0], explanation: 'Clinical records should be kept for 7 years post-treatment for adults as a minimum standard.' },
            { prompt: 'Which of these is NOT a requirement of a laser treatment record?', options: ['The practitioner\'s personal home address', 'Treatment settings used', 'Signed consent reference', 'Client reaction and aftercare given'], correct: [0], explanation: 'The practitioner\'s home address has no place in a clinical record. The others are all standard requirements.' },
          ],
        },
      },
    ],
  },

  {
    courseSlug: 'level-3-laser-aesthetic-therapies',
    modules: [
      {
        title: 'Acne & Post-Inflammatory Hyperpigmentation Protocols',
        summary: 'Plan safe laser and IPL protocols for active acne and the PIH it often leaves behind, with correct Fitzpatrick-based adjustments.',
        lessons: [
          {
            title: 'Treating Active Acne with IPL & Laser',
            durationMin: 11,
            objectives: ['Identify the mechanism by which IPL reduces acne', 'List the contraindications to laser/IPL for active acne', 'State the isotretinoin waiting period'],
            steps: [
              { kind: 'teach', title: 'The mechanism', text: 'IPL wavelengths around 420 nm are absorbed by porphyrins produced by Cutibacterium acnes. The energy destroys the bacteria and reduces sebaceous activity — without touching the surrounding tissue.' },
              { kind: 'ask', prompt: 'IPL targets acne bacteria via...', type: 'WORD', options: ['porphyrins', 'melanin', 'haemoglobin'], correct: [0], explanation: 'Porphyrins in C. acnes absorb the 420 nm blue/green wavelength, making them the primary chromophore in acne IPL.' },
              { kind: 'teach', title: 'Who it helps', text: 'Best results are seen in inflammatory acne (papules, pustules). It is not a first-line treatment for nodulo-cystic acne, which needs medical management.' },
              { kind: 'ask', prompt: 'IPL for acne works best on which type?', options: ['Inflammatory (papules and pustules)', 'Nodulo-cystic acne', 'Comedonal acne only', 'All types equally'], correct: [0], explanation: 'Inflammatory acne responds well; cystic acne needs GP/dermatology referral.' },
              { kind: 'teach', title: 'Isotretinoin (Roaccutane)', text: 'Isotretinoin makes skin fragile and reduces sebum dramatically. Any laser or IPL treatment must wait until at least 6 months after the last dose.' },
              { kind: 'ask', prompt: 'A client finished isotretinoin 4 months ago. Can you treat their acne with IPL?', options: ['No — wait at least 6 months post-course', 'Yes, at reduced settings', 'Yes, with extra cooling', 'Only if a GP approves on the day'], correct: [0], explanation: 'Six months post-isotretinoin is the minimum safe interval before any ablative or light-based treatment.' },
              { kind: 'teach', title: 'Other contraindications', text: 'Photosensitising antibiotics (tetracyclines), topical retinoids applied within 48 hours, and active cold sores on the face are all contraindications. Review the full medication history.' },
              { kind: 'say', text: 'For acne, laser/IPL is a complement to medical treatment — not a replacement. Always ask about current medications and GP involvement before planning a course.' },
            ],
          },
          {
            title: 'Post-Inflammatory Hyperpigmentation: Assessment & Treatment',
            durationMin: 11,
            objectives: ['Distinguish PIH from other pigmentation conditions', 'Apply Fitzpatrick-based risk assessment for PIH', 'State the low-fluence first-pass principle for darker skin types'],
            steps: [
              { kind: 'teach', title: 'What is PIH?', text: 'Post-inflammatory hyperpigmentation (PIH) is excess melanin deposited after skin inflammation. It is not a scar — the skin texture is normal, only the colour has changed.' },
              { kind: 'ask', prompt: 'PIH is caused by excess melanin following...', type: 'WORD', options: ['inflammation', 'dehydration', 'ageing'], correct: [0], explanation: 'Any skin inflammation — including acne, an adverse treatment reaction, or a wound — can trigger PIH.' },
              { kind: 'teach', title: 'Higher Fitzpatrick risk', text: 'Fitzpatrick types IV–VI have more reactive melanocytes. Laser or IPL itself can cause PIH if settings are too high — the treatment that causes inflammation can worsen the problem it was meant to fix.' },
              { kind: 'ask', prompt: 'For a Fitzpatrick V client with PIH, what is the initial approach?', options: ['Start at a low fluence and review before progressing', 'Use maximum settings for faster clearance', 'Treat the same as a Fitzpatrick II', 'Avoid all treatment'], correct: [0], explanation: 'Low, conservative settings and careful review prevent treatment-induced PIH on higher skin types.' },
              { kind: 'teach', title: 'Whitening prep', text: 'Topical tyrosinase inhibitors (e.g. azelaic acid, niacinamide, alpha-arbutin) can be applied 4–6 weeks before treatment to reduce melanocyte activity and improve outcomes — but only with a prescriber\'s involvement for hydroquinone.' },
              { kind: 'ask', prompt: 'Pre-treatment use of tyrosinase inhibitors in PIH aims to...', options: ['Reduce melanocyte activity before the treatment', 'Exfoliate the skin', 'Increase skin hydration', 'Numb the area'], correct: [0], explanation: 'Inhibiting melanocyte activity before light-based treatment reduces the risk of PIH worsening.' },
              { kind: 'teach', title: 'Sun avoidance', text: 'Fresh UV exposure before or between sessions significantly increases PIH risk. Daily SPF 50 broad-spectrum is mandatory throughout any course and for 4 weeks after the last treatment.' },
              { kind: 'say', text: 'PIH requires patience — results come over weeks, not sessions. Manage expectations from the outset and reinforce sun protection at every appointment.' },
            ],
          },
        ],
        quiz: {
          title: 'Acne & PIH Protocols Assessment',
          passMark: 70,
          questions: [
            { prompt: 'IPL targets acne bacteria primarily via their porphyrins.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'C. acnes produces porphyrins that absorb visible (especially ~420 nm) light — this is the mechanism of photodynamic acne treatment.' },
            { prompt: 'A client on isotretinoin can receive IPL treatment if extra cooling is used.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [1], explanation: 'Isotretinoin is an absolute contraindication during treatment and for 6 months post-course. Cooling does not remove the risk.' },
            { prompt: 'PIH on a Fitzpatrick V client should initially be treated with...', options: ['Low fluence, conservative settings with careful review', 'Maximum fluence for fastest results', 'Standard protocols as for Fitzpatrick I', 'No light-based treatment ever'], correct: [0], explanation: 'Higher skin types require conservative starts to avoid treatment-induced PIH.' },
            { prompt: 'What pre-treatment topical approach can reduce PIH risk before laser?', options: ['Tyrosinase inhibitors such as azelaic acid or niacinamide', 'AHA chemical peel two days before', 'High-SPF sunscreen alone', 'Topical retinoid the night before'], correct: [0], explanation: 'Tyrosinase inhibitors reduce melanocyte activity over 4-6 weeks pre-treatment, lowering PIH risk.' },
            { prompt: 'The minimum gap after finishing isotretinoin before any light-based treatment is...', options: ['6 months', '2 weeks', '3 months', '1 year always'], correct: [0], explanation: '6 months is the standard minimum; some guidelines recommend longer for ablative procedures.' },
            { prompt: 'Which acne type responds best to IPL/laser?', options: ['Inflammatory (papules and pustules)', 'Nodulo-cystic', 'Comedonal only', 'Scarring only'], correct: [0], explanation: 'Inflammatory acne with visible papules and pustules responds best to photodynamic-style IPL.' },
          ],
        },
      },
    ],
  },

  {
    courseSlug: 'level-4-certificate-aesthetic-practice',
    modules: [
      {
        title: 'Medication Interactions & Photosensitivity',
        summary: 'Identify the drugs that affect laser and light-based treatment safety, and manage clients on anticoagulants or immunosuppressants appropriately.',
        lessons: [
          {
            title: 'Drugs That Affect Laser Safety',
            durationMin: 12,
            objectives: ['List the main classes of photosensitising medications', 'State the correct pauses before treatment for retinoids and isotretinoin', 'Identify which drugs increase bleeding or bruising risk'],
            steps: [
              { kind: 'teach', title: 'Why medication matters', text: 'Several common medications change how the skin responds to light-based treatment — by increasing photosensitivity, thinning the blood, or impairing healing. A full medication review is non-negotiable at every consultation.' },
              { kind: 'teach', title: 'Photosensitising drugs', text: 'These make the skin react more strongly to light, increasing the risk of burns, PIH, and adverse reactions. Main classes: tetracycline antibiotics (especially doxycycline), St John\'s Wort (herbal supplement), NSAIDs, certain diuretics (thiazides), some antidepressants (SSRIs), and fluoroquinolone antibiotics.' },
              { kind: 'ask', prompt: 'Which of the following is a photosensitising medication?', options: ['Doxycycline (tetracycline antibiotic)', 'Paracetamol', 'Cetirizine antihistamine', 'Vitamin C'], correct: [0], explanation: 'Tetracyclines, especially doxycycline, are a well-documented cause of photosensitivity and must be disclosed before laser/IPL.' },
              { kind: 'teach', title: 'Retinoids', text: 'Topical retinoids (tretinoin, adapalene) thin the skin and increase sensitivity. Pause topical application for 5–7 days before ablative or resurfacing treatments. For oral retinoids (isotretinoin), wait 6 months after the last dose.' },
              { kind: 'ask', prompt: 'A client uses topical tretinoin nightly. Before a laser resurfacing, they should stop it for...', options: ['5-7 days', '24 hours', 'No pause needed', '6 months'], correct: [0], explanation: 'Topical retinoids need a 5-7 day pause before resurfacing procedures to reduce sensitivity and impaired healing.' },
              { kind: 'teach', title: 'Isotretinoin (oral retinoid)', text: 'The 6-month rule is absolute: no ablative, resurfacing, or aggressive light-based treatments until 6 months post-course. The skin is profoundly altered — reduced sebum, thinner, impaired wound healing.' },
              { kind: 'ask', prompt: 'Isotretinoin alters skin behaviour primarily by...', type: 'MULTI', options: ['Reducing sebum production', 'Thinning the skin', 'Impairing wound healing', 'Increasing melanin production'], correct: [0, 1, 2], explanation: 'Reduced sebum, thinner epidermis, and impaired healing — all three make any energy-based treatment higher risk.' },
              { kind: 'say', text: 'Always ask "are you on any medications, vitamins or herbal supplements?" — St John\'s Wort is over the counter and commonly overlooked, yet it is a significant photosensitiser.' },
            ],
          },
          {
            title: 'Anticoagulants, Immunosuppressants & Complex Clients',
            durationMin: 12,
            objectives: ['Describe the treatment risks for clients on anticoagulants', 'Explain how immunosuppression affects healing and infection risk', 'State when to seek GP input before treating a medically complex client'],
            steps: [
              { kind: 'teach', title: 'Anticoagulants', text: 'Warfarin, apixaban, rivaroxaban, clopidogrel, and aspirin all reduce the ability of blood to clot. Energy-based treatments may cause prolonged bleeding, unusual bruising, or purpura after vascular or resurfacing treatments.' },
              { kind: 'ask', prompt: 'A client on warfarin for atrial fibrillation is having IPL for thread veins. The main added risk is...', options: ['Prolonged bleeding or unusual bruising', 'Increased hyperpigmentation', 'Reduced treatment efficacy', 'No additional risk'], correct: [0], explanation: 'Anticoagulants significantly increase bleeding and bruising risk after any vascular or energy-based treatment.' },
              { kind: 'teach', title: 'Do not stop their medication', text: 'Never advise a client to stop anticoagulants before a cosmetic appointment. Stopping warfarin without GP supervision can be life-threatening. Obtain GP written clearance if proceeding.' },
              { kind: 'ask', prompt: 'A client asks if they should stop warfarin before their laser appointment. You should...', options: ['Never advise them to stop — refer to their GP', 'Tell them to skip one dose', 'Reassure them it is fine to stop for 48 hours', 'Proceed without any adjustments'], correct: [0], explanation: 'Only the prescribing GP can authorise any change to anticoagulation. Never advise the client to stop.' },
              { kind: 'teach', title: 'Immunosuppressants', text: 'Methotrexate, ciclosporin, azathioprine, and biologics (used for psoriasis, rheumatoid arthritis, transplants) impair the immune response. Any open wound or skin compromise carries a higher infection risk, and healing is slower and less predictable.' },
              { kind: 'ask', prompt: 'A client on methotrexate for rheumatoid arthritis has a skin infection risk after laser because...', options: ['Their immune system is suppressed and wound healing is impaired', 'Methotrexate is photosensitising', 'They will be more comfortable than usual', 'There is no added risk'], correct: [0], explanation: 'Methotrexate suppresses the immune system, raising infection risk after any skin disruption.' },
              { kind: 'teach', title: 'GP referral pathway', text: 'Any medically complex client — on anticoagulants, immunosuppressants, or multiple medications — should be treated only after written GP clearance. Document the referral, the GP response, and your clinical rationale.' },
              { kind: 'say', text: 'The safest words in complex cases are "let me check with your GP first". A short delay to get clearance is far better than a complication you could not defend.' },
            ],
          },
        ],
        quiz: {
          title: 'Medication Interactions & Photosensitivity Assessment',
          passMark: 70,
          questions: [
            { prompt: 'Doxycycline is a photosensitising medication.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'Tetracyclines, including doxycycline, are well-documented photosensitisers — an absolute disclosure requirement before any light-based treatment.' },
            { prompt: 'A client who finished isotretinoin 5 months ago should be treated with laser resurfacing if they are keen and the skin looks normal.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [1], explanation: 'Six months post-course is the minimum. The skin may look normal but wound healing and sebaceous function remain altered.' },
            { prompt: 'Before topical retinoid use and a resurfacing laser, the retinoid should be paused for...', options: ['5-7 days', '24 hours only', 'No pause needed', '6 months'], correct: [0], explanation: 'Topical retinoids should be stopped 5-7 days before any resurfacing or ablative procedure.' },
            { prompt: 'You should advise a client on warfarin to skip one dose before vascular IPL.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [1], explanation: 'Never advise stopping or adjusting anticoagulants. Refer to the prescribing GP for written clearance.' },
            { prompt: 'Immunosuppressed clients undergoing laser treatment face higher risk of...', options: ['Infection and impaired healing', 'Faster recovery', 'Reduced bruising', 'No change in outcome'], correct: [0], explanation: 'Immunosuppression raises infection risk and slows healing after any treatment that breaches the skin barrier.' },
            { prompt: 'St John\'s Wort is relevant to ask about before laser treatment because it is...', options: ['A photosensitiser available over the counter', 'Irrelevant to skin treatment', 'A prescription anticoagulant', 'A topical retinoid'], correct: [0], explanation: 'St John\'s Wort is a common, over-the-counter photosensitiser that many clients do not think to mention.' },
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
  { courseSlug: L2, topic: 'Client care', prompt: 'When a client raises a concern, your first step is to…', options: ['Listen calmly', 'Argue back', 'Ignore it', 'Walk away'], correct: [0], explanation: 'Listen first, stay calm.' },
  { courseSlug: L2, topic: 'Client care', prompt: 'Before starting a treatment you should agree the plan, the likely results and the…', type: 'WORD', options: ['cost', 'weather', 'parking'], correct: [0], explanation: 'Agree the cost up front.' },
  { courseSlug: L2, topic: 'Complaints', prompt: 'A good response to a complaint includes…', type: 'MULTI', options: ['Acknowledging it', 'A plan to put it right', 'Honesty', 'Blaming the client'], correct: [0, 1, 2], explanation: 'Own it and fix it; never blame.' },
  { courseSlug: 'level-3-laser-aesthetic-therapies', topic: 'Acne', prompt: 'Light-based acne treatment partly works by targeting…', options: ['Acne bacteria and oil glands', 'Bone', 'Hair colour', 'Teeth'], correct: [0], explanation: 'It targets the bacteria and calms oil glands.' },
  { courseSlug: 'level-3-laser-aesthetic-therapies', topic: 'Acne', prompt: 'Light therapy for acne is best described as ongoing management, not a one-session cure.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'Acne is managed over time.' },
  { courseSlug: 'level-3-laser-aesthetic-therapies', topic: 'Scars', prompt: 'Scar resurfacing softens scars mainly by stimulating new…', type: 'WORD', options: ['collagen', 'melanin', 'bone'], correct: [0], explanation: 'New collagen remodels the scar.' },
  { courseSlug: 'level-4-certificate-aesthetic-practice', topic: 'Ageing', prompt: 'Ageing caused by sun, smoking and lifestyle is called…', type: 'WORD', options: ['extrinsic', 'intrinsic', 'eternal'], correct: [0], explanation: 'Extrinsic = external causes.' },
  { courseSlug: 'level-4-certificate-aesthetic-practice', topic: 'Ageing', prompt: 'The biggest external cause of visible skin ageing is…', options: ['The sun (UV)', 'Cold weather', 'Reading', 'Drinking water'], correct: [0], explanation: 'UV drives most photoageing.' },
  { courseSlug: 'level-4-certificate-aesthetic-practice', topic: 'Photodamage', prompt: 'Daily broad-spectrum SPF should be worn…', options: ['Even on cloudy days', 'Only on holiday', 'Only at night', 'Never'], correct: [0], explanation: 'UV reaches skin through cloud.' },
  { courseSlug: 'level-4-certificate-aesthetic-practice', topic: 'Skin conditions', prompt: 'Facial redness and easy flushing is most typical of…', options: ['Rosacea', 'Psoriasis', 'A healthy tan', 'Eczema only'], correct: [0], explanation: 'Rosacea presents as redness and flushing.' },
  { courseSlug: 'level-4-certificate-aesthetic-practice', topic: 'Skin conditions', prompt: 'Your role with a client’s skin condition is to recognise, adapt and…', type: 'WORD', options: ['refer', 'diagnose', 'ignore'], correct: [0], explanation: 'Recognise, adapt, refer — you don’t diagnose.' },
  { courseSlug: 'level-4-certificate-aesthetic-practice', topic: 'Adapting', prompt: 'If skin is actively flaring or broken, the right call is to…', options: ['Delay until it settles', 'Treat anyway', 'Use stronger settings', 'Ignore it'], correct: [0], explanation: 'Treating inflamed skin risks harm.' },
  { courseSlug: 'level-3-laser-aesthetic-therapies', topic: 'Pre-treatment', prompt: 'For laser hair removal, skin should be ___ on the day, not waxed.', type: 'WORD', options: ['shaved', 'plucked', 'tanned'], correct: [0], explanation: 'Shaving keeps the root the laser targets.' },
  { courseSlug: 'level-3-laser-aesthetic-therapies', topic: 'Pre-treatment', prompt: 'A recent tan before laser raises the risk of…', type: 'MULTI', options: ['Burns', 'Pigment changes', 'Better results', 'Adverse reaction'], correct: [0, 1, 3], explanation: 'Extra melanin absorbs energy — it doesn’t improve results.' },
  { courseSlug: 'level-3-laser-aesthetic-therapies', topic: 'Aftercare', prompt: 'After treatment, daily ___ protects both the skin and the result.', type: 'WORD', options: ['SPF', 'makeup', 'exfoliation'], correct: [0], explanation: 'Broad-spectrum SPF.' },
  { courseSlug: 'advanced-aesthetics-level-5-7', topic: 'Evidence', prompt: 'The strongest source of evidence for a treatment is…', options: ['A peer-reviewed study', 'A manufacturer brochure', 'A viral video', 'A rumour'], correct: [0], explanation: 'Peer-reviewed evidence outranks marketing.' },
  { courseSlug: 'advanced-aesthetics-level-5-7', topic: 'Audit', prompt: 'A clinical audit compares your practice against a…', type: 'WORD', options: ['standard', 'rival', 'rumour'], correct: [0], explanation: 'Measure against an agreed standard.' },
  { courseSlug: 'advanced-aesthetics-level-5-7', topic: 'Audit', prompt: 'After changing something, a good audit then re-measures to check it worked.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'Closing the loop confirms improvement.' },
  { courseSlug: L2, topic: 'Health & safety', prompt: 'A risk assessment is mainly about…', options: ['Spotting hazards and preventing harm', 'Selling more treatments', 'Decorating the room', 'Saving time'], correct: [0], explanation: 'Identify hazards and put controls in place.' },
  { courseSlug: L2, topic: 'Health & safety', prompt: 'Health and safety in the salon is a ___ duty.', type: 'WORD', options: ['legal', 'optional', 'seasonal'], correct: [0], explanation: 'It is a legal responsibility.' },
  { courseSlug: L2, topic: 'COSHH', prompt: 'COSHH is mainly concerned with the safe handling of…', options: ['Substances hazardous to health', 'Bookings', 'Music', 'Lighting'], correct: [0], explanation: 'Control of Substances Hazardous to Health.' },
  { courseSlug: 'level-3-laser-aesthetic-therapies', topic: 'Skin tightening', prompt: 'Radiofrequency-type skin tightening works mainly by controlled…', type: 'WORD', options: ['heating', 'cooling', 'cutting'], correct: [0], explanation: 'Controlled deep heat makes collagen contract and rebuild.' },
  { courseSlug: 'level-3-laser-aesthetic-therapies', topic: 'Skin tightening', prompt: 'Energy-based skin tightening is best described as…', options: ['Gradual firming, not a surgical lift', 'An instant facelift', 'Permanent and total', 'Useless'], correct: [0], explanation: 'It firms modestly and gradually.' },
  { courseSlug: 'level-3-laser-aesthetic-therapies', topic: 'Body treatments', prompt: 'Body contouring devices work best…', options: ['Alongside a healthy lifestyle', 'Instead of any diet or exercise', 'Only overnight', 'On their own forever'], correct: [0], explanation: 'They support, not replace, healthy habits.' },
  { courseSlug: 'advanced-aesthetics-level-5-7', topic: 'Leadership', prompt: 'In a good safety culture, mistakes are treated as…', options: ['Learning opportunities', 'Reasons to blame', 'Things to hide', 'Unimportant'], correct: [0], explanation: 'Openness and learning, not blame.' },
  { courseSlug: 'advanced-aesthetics-level-5-7', topic: 'Leadership', prompt: 'The best way for a leader to set team standards is to…', options: ['Model them personally', 'Only write rules', 'Hope for the best', 'Punish every slip'], correct: [0], explanation: 'Lead by example.' },
  { courseSlug: 'advanced-aesthetics-level-5-7', topic: 'Mentoring', prompt: 'Useful feedback to a mentee is specific, kind and…', type: 'WORD', options: ['actionable', 'vague', 'harsh'], correct: [0], explanation: 'Specific, kind and actionable.' },
  { courseSlug: 'level-4-certificate-aesthetic-practice', topic: 'Skin analysis', prompt: 'Before a skin analysis, skin should be…', type: 'WORD', options: ['cleansed', 'moisturised', 'made up'], correct: [0], explanation: 'Cleansing removes product interference so you see the true skin.' },
  { courseSlug: 'level-4-certificate-aesthetic-practice', topic: 'Skin analysis', prompt: 'Dehydration is a skin ___, not a skin type.', type: 'WORD', options: ['condition', 'disease', 'colour'], correct: [0], explanation: 'Any skin type can be dehydrated; it is a changeable state.' },
  { courseSlug: 'level-4-certificate-aesthetic-practice', topic: 'Skin analysis', prompt: 'Which are the main skin types?', type: 'MULTI', options: ['Oily', 'Dry', 'Combination', 'Dehydrated'], correct: [0, 1, 2], explanation: 'Dehydration is a condition, not a type.' },
  { courseSlug: 'level-4-certificate-aesthetic-practice', topic: 'Skin analysis', prompt: 'A magnifying lamp is used during skin analysis to see…', type: 'MULTI', options: ['Open pores', 'Comedones', 'Erythema', 'The client\'s exact age'], correct: [0, 1, 2], explanation: 'It reveals texture and vascular detail, not age.' },
  { courseSlug: 'level-4-certificate-aesthetic-practice', topic: 'Skin analysis', prompt: 'An asymmetric, changing or bleeding lesion should be treated immediately.', type: 'TRUEFALSE', options: ['False', 'True'], correct: [0], explanation: 'Refer it to a doctor before any treatment.' },
  { courseSlug: 'level-4-certificate-aesthetic-practice', topic: 'Skin analysis', prompt: 'The main purpose of a skin analysis is to…', options: ['Shape a safe treatment plan', 'Set the price', 'Skip the consultation', 'Impress the client'], correct: [0], explanation: 'Analysis informs a safe, appropriate plan.' },
  { courseSlug: L2, topic: 'Laser safety', prompt: 'Treatment lasers are typically Class 3B or Class 4, meaning they can cause injury from…', type: 'MULTI', options: ['Direct beam contact', 'A reflected beam', 'Stray fumes', 'Good lighting only'], correct: [0, 1, 2], explanation: 'Direct, reflected beams and fumes are all recognised hazards.' },
  { courseSlug: L2, topic: 'Laser safety', prompt: 'The treatment room during laser use is known as a laser-___ area.', type: 'WORD', options: ['controlled', 'open', 'free'], correct: [0], explanation: 'A controlled area with warning signs and restricted entry.' },
  { courseSlug: L2, topic: 'Laser safety', prompt: 'Protective laser goggles must be rated for the specific ___ in use.', type: 'WORD', options: ['wavelength', 'brand', 'colour'], correct: [0], explanation: 'Different wavelengths need different optical density ratings.' },
  { courseSlug: L2, topic: 'Laser safety', prompt: 'During laser use, wavelength-matched eyewear must be worn by…', type: 'MULTI', options: ['The practitioner', 'The client', 'Anyone in the room', 'Nobody'], correct: [0, 1, 2], explanation: 'Every person present needs wavelength-specific protection.' },
  { courseSlug: L2, topic: 'Laser safety', prompt: 'Responsibility for safe laser use rests with…', options: ['The operator', 'The machine manufacturer only', 'The client', 'The regulator alone'], correct: [0], explanation: 'The operator is responsible and accountable at all times.' },
  { courseSlug: L2, topic: 'Laser safety', prompt: 'Fire and fumes are potential laser hazards in addition to eye and skin injury.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'Flammable materials and tissue fumes are recognised laser hazards.' },

  // -- BATCH 7 exam bank questions ---------------------------------------------

  // Treatment Planning & Client Records (L2)
  { courseSlug: L2, topic: "Record keeping", prompt: "A client record should be completed...", options: ["At the time of the appointment", "The following week", "Only after a complaint", "Never"], correct: [0], explanation: "Contemporaneous records are legally stronger and more accurate than retrospective ones." },
  { courseSlug: L2, topic: "Record keeping", prompt: "Under UK GDPR, client health data is classed as...", type: "WORD", options: ["special category", "public", "optional"], correct: [0], explanation: "Health data requires a higher level of protection as special category data." },
  { courseSlug: L2, topic: "Record keeping", prompt: "Adult aesthetics client records should be retained for a minimum of...", options: ["7 years", "6 months", "30 days", "1 year"], correct: [0], explanation: "Seven years is the standard minimum retention period for adult treatment records." },
  { courseSlug: L2, topic: "Record keeping", prompt: "The data minimisation principle requires you to collect...", options: ["Only data needed for the treatment", "As much data as possible", "No personal data at all", "Financial data only"], correct: [0], explanation: "Collect only what is necessary and proportionate to the purpose." },
  { courseSlug: L2, topic: "Record keeping", prompt: "A complete client record protects...", type: "MULTI", options: ["The client", "The practitioner", "The business", "Nobody"], correct: [0, 1, 2], explanation: "Good records protect all parties if a dispute arises." },

  // Skin Pharmacology & Topicals (L3)
  { courseSlug: "level-3-laser-aesthetic-therapies", topic: "Topicals", prompt: "Retinoid use should be stopped before laser treatment because retinoids...", options: ["Thin the skin, increasing burn risk", "Protect the skin from heat", "Improve laser absorption", "Block the wavelength"], correct: [0], explanation: "Retinoids accelerate epidermal turnover and thin the stratum corneum, raising sensitivity to laser energy." },
  { courseSlug: "level-3-laser-aesthetic-therapies", topic: "Topicals", prompt: "Topical anaesthetic creams (e.g. EMLA) are typically applied under occlusion for...", options: ["30-60 minutes before treatment", "The day before", "During the treatment", "After the treatment"], correct: [0], explanation: "30-60 minutes under occlusion achieves effective tissue penetration of the anaesthetic." },
  { courseSlug: "level-3-laser-aesthetic-therapies", topic: "Topicals", prompt: "Post-laser, the ingredient best suited to supporting barrier repair is...", options: ["Ceramides", "Glycolic acid", "Salicylic acid", "Retinol"], correct: [0], explanation: "Ceramides are structural skin lipids that restore barrier integrity after treatment." },
  { courseSlug: "level-3-laser-aesthetic-therapies", topic: "Photosensitivity", prompt: "Photosensitising systemic medications must be identified...", options: ["During the consultation", "After treatment", "At payment", "They need not be identified"], correct: [0], explanation: "A thorough medication history at consultation is needed before any laser or light-based treatment." },

  // Legal Frameworks & Professional Accountability (L4)
  { courseSlug: "level-4-certificate-aesthetic-practice", topic: "Regulation", prompt: "Class 3B and Class 4 cosmetic lasers require a licence from...", options: ["The local authority", "The device manufacturer", "The client", "No licence is needed"], correct: [0], explanation: "A local authority licence is required under the Local Government (Miscellaneous Provisions) Act 1982 before commercial cosmetic laser use." },
  { courseSlug: "level-4-certificate-aesthetic-practice", topic: "Liability", prompt: "When an employer is legally responsible for an employee's negligent clinical act, this is known as...", options: ["Vicarious liability", "Personal liability", "Strict liability", "Absolute immunity"], correct: [0], explanation: "Vicarious liability holds the employer accountable for acts of an employee performed within their role." },
  { courseSlug: "level-4-certificate-aesthetic-practice", topic: "Adverse events", prompt: "A serious adverse event related to a medical device must be reported to the...", options: ["MHRA (yellow card scheme)", "Client's GP only", "Nobody", "Social media"], correct: [0], explanation: "The MHRA's yellow card scheme collects device-related adverse event reports to protect public safety." },

  // -- BATCH 8 exam bank questions ---------------------------------------------

  // Client Preparation & Treatment Delivery (L2)
  { courseSlug: L2, topic: "Treatment preparation", prompt: "Before the first full laser treatment on a new client, you should fire a...", type: "WORD", options: ["test pulse", "full sweep", "random burst"], correct: [0], explanation: "A test pulse checks the tissue response at the planned settings before committing to the full area." },
  { courseSlug: L2, topic: "Treatment preparation", prompt: "Pre-treatment photographs form part of the...", options: ["Clinical record and provide a medicolegal baseline", "Social media feed", "Invoice", "Marketing campaign"], correct: [0], explanation: "Before photos are a clinical record requirement, not a marketing asset." },
  { courseSlug: L2, topic: "Treatment delivery", prompt: "During a treatment, unexpected sharp pain or blistering means you should...", options: ["Stop, assess, and adjust before continuing", "Increase the energy setting", "Continue to the end of the treatment", "Leave the client to rest"], correct: [0], explanation: "Any unexpected adverse response is a signal to stop immediately and assess." },

  // Electrical Safety & Equipment Maintenance (L2)
  { courseSlug: L2, topic: 'Equipment safety', prompt: 'PAT testing stands for Portable ___ Testing.', type: 'WORD', options: ['Appliance', 'Antenna', 'Application'], correct: [0], explanation: 'PAT = Portable Appliance Testing -- an electrical safety inspection of portable devices.' },
  { courseSlug: L2, topic: 'Equipment safety', prompt: 'A visually damaged cable on a treatment device should be...', options: ['Reported and the device taken out of use', 'Taped up and used carefully', 'Ignored until next service', 'Left for the client to report'], correct: [0], explanation: 'Damaged cables must not be used. Report and withdraw from service immediately.' },
  { courseSlug: L2, topic: 'Equipment safety', prompt: 'Equipment maintenance records help form a legal...', type: 'WORD', options: ['audit trail', 'marketing plan', 'client record'], correct: [0], explanation: 'An audit trail demonstrates that your duty of care was met and supports any incident investigation.' },

  // Combination Treatments & Course Planning (L3)
  { courseSlug: "level-3-laser-aesthetic-therapies", topic: "Course planning", prompt: "Skin rejuvenation photofacial sessions are typically spaced...", options: ["3-4 weeks apart", "Every 6 months", "Daily", "Every 2 years"], correct: [0], explanation: "3-4 weeks allows the neocollagenesis response to develop before the next treatment." },
  { courseSlug: "level-3-laser-aesthetic-therapies", topic: "Combination treatments", prompt: "The main clinical risk of applying two energy-based devices to the same area in one session is...", options: ["Cumulative heat causing burns or post-inflammatory hyperpigmentation", "Better results", "Reduced discomfort", "Faster healing"], correct: [0], explanation: "Stacked heat in one session significantly raises the risk of burns and PIH." },
  { courseSlug: "level-3-laser-aesthetic-therapies", topic: "Course planning", prompt: "A written treatment plan benefits the client by...", options: ["Setting clear expectations about the number of sessions and likely outcomes", "Locking them into a payment plan", "Reducing the number of sessions needed", "Allowing the practitioner to change the plan without notice"], correct: [0], explanation: "Clear, documented expectations protect both client and practitioner." },

  // Combination Protocols & Treatment Sequencing (L3)
  { courseSlug: 'level-3-laser-aesthetic-therapies', topic: 'Combination protocols', prompt: 'In a combination session, treatments should generally progress from...', options: ['Least to most aggressive', 'Most to least aggressive', 'Random order', 'Most expensive first'], correct: [0], explanation: 'Least aggressive first preserves the skin barrier for subsequent energy-based steps.' },
  { courseSlug: 'level-3-laser-aesthetic-therapies', topic: 'Combination protocols', prompt: 'A client has a fresh spray tan. The laser appointment should be...', options: ['Postponed until the tan has faded', 'Adapted with lower settings', 'Carried out as normal', 'Cancelled permanently'], correct: [0], explanation: 'Any active tan is a contraindication for laser and IPL; postpone and re-book.' },
  { courseSlug: 'level-3-laser-aesthetic-therapies', topic: 'Combination protocols', prompt: 'After a medium chemical peel, laser resurfacing in the same area should wait until the...', type: 'WORD', options: ['barrier', 'colour', 'melanin'], correct: [0], explanation: 'The epidermal barrier must fully recover before additional energy-based treatment is applied.' },
  { courseSlug: 'level-3-laser-aesthetic-therapies', topic: 'Combination protocols', prompt: 'The minimum recommended gap between a dermal filler and laser in the same area is...', options: ['Two weeks', 'Two hours', 'No gap needed', 'Six months always'], correct: [0], explanation: 'Two weeks allows initial settling and reduces the risk of adverse interaction with the filler.' },

  // Business Development & Governance (L4 and L5-7)
  { courseSlug: "level-4-certificate-aesthetic-practice", topic: "Governance", prompt: "Clinical governance operates...", options: ["Continuously as an active accountability framework", "Only during regulatory inspections", "Once a year at review", "When complaints arise"], correct: [0], explanation: "Clinical governance is an ongoing, active process, not a reactive one." },
  { courseSlug: "level-4-certificate-aesthetic-practice", topic: "Audit", prompt: "The audit cycle is only complete once you have...", options: ["Re-audited to confirm the change improved practice", "Written a report", "Presented the findings at a meeting", "Filed the data"], correct: [0], explanation: "Re-audit closes the loop; without it you cannot confirm whether the improvement worked." },
  { courseSlug: "advanced-aesthetics-level-5-7", topic: "Business development", prompt: "Value-based pricing reflects...", options: ["The perceived benefit of the outcome to the client", "The cost of supplies only", "A standard market rate", "What competitors charge"], correct: [0], explanation: "Value-based pricing is set from the client's perspective -- what the result is worth to them." },
  { courseSlug: "advanced-aesthetics-level-5-7", topic: "Marketing compliance", prompt: "Aesthetic treatment before/after photographs used in marketing require...", options: ["Explicit written consent for marketing use, separate from clinical consent", "Verbal agreement only", "No consent if faces are cropped", "Automatic consent after payment"], correct: [0], explanation: "Marketing consent must be separate, explicit and in writing." },

  // Client Psychology & Wellbeing (L4)
  { courseSlug: 'level-4-certificate-aesthetic-practice', topic: 'Client psychology', prompt: 'Body Dysmorphic Disorder (BDD) is best described as...', options: ['Obsessive, distressing preoccupation with a perceived appearance flaw', 'Normal concern about appearance', 'A contraindication for all consultations', 'A skin condition'], correct: [0], explanation: 'BDD is a mental health condition -- obsessive, distressing focus on a perceived (often minor or absent) flaw.' },
  { courseSlug: 'level-4-certificate-aesthetic-practice', topic: 'Client psychology', prompt: 'Aesthetic treatment for a client with suspected BDD should be...', options: ['Declined; client signposted to mental health support', 'Offered immediately to reduce distress', 'Given at a reduced rate', 'Completed in stages only'], correct: [0], explanation: 'Treatment does not resolve BDD and may worsen it. Decline and refer appropriately.' },
  { courseSlug: 'level-4-certificate-aesthetic-practice', topic: 'Client psychology', prompt: 'Which of these is a red flag for unrealistic expectations or BDD during consultation?', type: 'MULTI', options: ['Wanting to look like a filtered image', 'Repeated visits about one minor feature', 'Dissatisfied after objectively successful treatment', 'A single clear, realistic goal discussed calmly'], correct: [0, 1, 2], explanation: 'A calm, specific, realistic goal is healthy. The others raise concern.' },
  { courseSlug: 'level-4-certificate-aesthetic-practice', topic: 'Client psychology', prompt: 'When declining a client for psychological reasons, the practitioner must...', type: 'MULTI', options: ['Be calm and non-judgemental', 'Signpost to GP or mental health services', 'Document the decision and reasoning', 'Tell other clients about the case'], correct: [0, 1, 2], explanation: 'Calm, compassionate refusal with a referral pathway and full documentation -- never breach confidentiality.' },
  { courseSlug: 'advanced-aesthetics-level-5-7', topic: 'Client psychology', prompt: 'Understanding a client\'s motivation for treatment is part of the practitioner\'s...', type: 'SINGLE', options: ['Duty of care', 'Marketing strategy', 'Personal curiosity', 'Financial planning'], correct: [0], explanation: 'Duty of care includes assessing psychological suitability, not just physical contraindications.' },

  // -- BATCH 9 exam bank questions ---------------------------------------------

  // Record Keeping & Data Protection (L2)
  { courseSlug: L2, topic: 'Record keeping', prompt: 'Laser treatment settings must be recorded in the client notes.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'Treatment settings are a clinical record requirement — without them future sessions cannot safely adapt the protocol.' },
  { courseSlug: L2, topic: 'GDPR', prompt: 'A client\'s before-treatment photographs are classed as...', options: ['Special category data under UK GDPR', 'General personal data', 'Anonymous data', 'Public information'], correct: [0], explanation: 'Photographs linked to a named client\'s health are special category data and require explicit consent and secure storage.' },
  { courseSlug: L2, topic: 'GDPR', prompt: 'A Subject Access Request must be fulfilled within...', options: ['One calendar month', 'Six months', 'Seven working days', 'One year'], correct: [0], explanation: 'UK GDPR Art. 15 requires a response within one month at no charge.' },
  { courseSlug: L2, topic: 'Record keeping', prompt: 'After an adverse reaction during treatment you must record...', type: 'MULTI', options: ['The reaction and its severity', 'The action you took', 'The aftercare advice given', 'The lunch menu that day'], correct: [0, 1, 2], explanation: 'Full adverse event documentation: what happened, what you did, and what you advised — all three protect the client and the practitioner.' },

  // Acne & PIH Protocols (L3)
  { courseSlug: 'level-3-laser-aesthetic-therapies', topic: 'Acne protocols', prompt: 'IPL for acne works by targeting bacterial porphyrins with approximately 420 nm light.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'Porphyrins produced by C. acnes absorb short-wavelength visible light, making them the chromophore in photodynamic acne treatment.' },
  { courseSlug: 'level-3-laser-aesthetic-therapies', topic: 'Acne protocols', prompt: 'A client finished isotretinoin 3 months ago. The correct decision is to...', options: ['Decline and rebook after 6 months post-course', 'Treat at half fluence', 'Treat as normal if skin looks healthy', 'Apply extra cooling and proceed'], correct: [0], explanation: 'Six months post-isotretinoin is the minimum before any light-based treatment. Appearance alone does not confirm skin safety.' },
  { courseSlug: 'level-3-laser-aesthetic-therapies', topic: 'PIH', prompt: 'For PIH on a Fitzpatrick V client, the safest first approach is...', options: ['Conservative low-fluence start with review before increasing', 'Standard fluence as for Fitzpatrick II', 'Maximum settings for fastest clearance', 'No treatment ever'], correct: [0], explanation: 'Higher skin types need conservative starts; aggressive settings on reactive melanocytes can worsen PIH.' },
  { courseSlug: 'level-3-laser-aesthetic-therapies', topic: 'PIH', prompt: 'Tyrosinase inhibitors used before laser treatment aim to...', options: ['Reduce melanocyte activity before the treatment session', 'Exfoliate dead skin', 'Increase collagen production', 'Numb the treatment area'], correct: [0], explanation: 'Inhibiting melanocyte activity 4-6 weeks before laser reduces the risk of treatment-triggered PIH.' },

  // Medication Interactions & Photosensitivity (L4)
  { courseSlug: 'level-4-certificate-aesthetic-practice', topic: 'Photosensitivity', prompt: 'St John\'s Wort is relevant to disclose before laser treatment because it is a photosensitiser.', type: 'TRUEFALSE', options: ['True', 'False'], correct: [0], explanation: 'St John\'s Wort is an over-the-counter photosensitiser. Many clients do not consider herbal supplements medications and may not volunteer this.' },
  { courseSlug: 'level-4-certificate-aesthetic-practice', topic: 'Medication interactions', prompt: 'A client asks if they should stop warfarin before their vascular IPL appointment. You should...', options: ['Advise them never to stop without GP instruction and refer for written clearance', 'Tell them to skip one dose', 'Reassure them it is safe to stop for 48 hours', 'Proceed without GP involvement'], correct: [0], explanation: 'Only the prescribing GP can authorise changes to anticoagulation. Never advise the client to stop warfarin.' },
  { courseSlug: 'level-4-certificate-aesthetic-practice', topic: 'Medication interactions', prompt: 'Topical retinoids should be paused before resurfacing for...', options: ['5-7 days', '24 hours', '6 months', 'No pause is needed'], correct: [0], explanation: 'Topical retinoids thin the skin and increase photosensitivity; a 5-7 day pause before resurfacing is standard.' },
  { courseSlug: 'level-4-certificate-aesthetic-practice', topic: 'Medication interactions', prompt: 'Which of these drugs should trigger a GP referral before laser treatment?', type: 'MULTI', options: ['Warfarin', 'Methotrexate', 'Isotretinoin (within last 6 months)', 'Vitamin D supplement'], correct: [0, 1, 2], explanation: 'Anticoagulants, immunosuppressants, and recent isotretinoin all require GP clearance before any laser or energy-based treatment.' },

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
