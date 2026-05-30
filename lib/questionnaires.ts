// Questionnaire definitions for the client portal's animated health assessments.
// Pure data (safe to import on the client). Each questionnaire is versioned;
// submissions store the `key` + `version` so answers always map to the exact
// wording shown. Add new versions rather than editing live questions.

export type FieldType = 'single' | 'multi' | 'boolean' | 'text' | 'longtext' | 'scale' | 'date' | 'signature';

export type Question = {
  id: string;
  type: FieldType;
  prompt: string;
  help?: string;
  options?: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
  /** Show this question only when another answer matches. */
  showIf?: { id: string; equals?: string; truthy?: boolean };
  /** For `scale`. */
  min?: number;
  max?: number;
  minLabel?: string;
  maxLabel?: string;
};

export type Questionnaire = {
  key: string;
  version: number;
  type: 'MEDICAL_HISTORY' | 'TREATMENT_CONSENT' | 'PRE_TREATMENT' | 'SKIN_PROFILE' | 'DENTAL_HISTORY';
  title: string;
  intro: string;
  estMinutes: number;
  questions: Question[];
};

const YESNO = [
  { value: 'no', label: 'No' },
  { value: 'yes', label: 'Yes' },
];

export const medicalHistory: Questionnaire = {
  key: 'medical-history',
  version: 1,
  type: 'MEDICAL_HISTORY',
  title: 'Medical history',
  intro:
    'A few confidential questions so our clinicians can plan the safest, most effective treatment for you. Everything is encrypted and seen only by your care team.',
  estMinutes: 4,
  questions: [
    {
      id: 'general_health',
      type: 'single',
      prompt: 'How would you describe your general health?',
      required: true,
      options: [
        { value: 'excellent', label: 'Excellent' },
        { value: 'good', label: 'Good' },
        { value: 'fair', label: 'Fair' },
        { value: 'managing', label: 'Managing a condition' },
      ],
    },
    {
      id: 'conditions',
      type: 'multi',
      prompt: 'Do any of these apply to you?',
      help: 'Select all that apply — or choose “None of these”.',
      options: [
        { value: 'diabetes', label: 'Diabetes' },
        { value: 'heart', label: 'Heart / blood pressure condition' },
        { value: 'epilepsy', label: 'Epilepsy or seizures' },
        { value: 'autoimmune', label: 'Autoimmune condition' },
        { value: 'skin', label: 'Skin condition (eczema, psoriasis…)' },
        { value: 'keloid', label: 'Keloid / abnormal scarring' },
        { value: 'cancer', label: 'Current or past cancer' },
        { value: 'bleeding', label: 'Bleeding / clotting disorder' },
        { value: 'none', label: 'None of these' },
      ],
    },
    {
      id: 'conditions_detail',
      type: 'longtext',
      prompt: 'Anything you’d like your clinician to know about those?',
      placeholder: 'Optional — a sentence or two is plenty.',
      showIf: { id: 'conditions', truthy: true },
    },
    {
      id: 'medications',
      type: 'boolean',
      prompt: 'Are you currently taking any medication?',
      required: true,
      options: YESNO,
    },
    {
      id: 'medications_list',
      type: 'longtext',
      prompt: 'Which medications are you taking?',
      placeholder: 'Include anything regular, e.g. Roaccutane, blood thinners, the pill…',
      showIf: { id: 'medications', equals: 'yes' },
    },
    {
      id: 'allergies',
      type: 'boolean',
      prompt: 'Do you have any allergies?',
      help: 'Including medicines, anaesthetics, latex, or skincare ingredients.',
      required: true,
      options: YESNO,
    },
    {
      id: 'allergies_list',
      type: 'text',
      prompt: 'What are you allergic to?',
      placeholder: 'e.g. lidocaine, penicillin, nuts…',
      showIf: { id: 'allergies', equals: 'yes' },
    },
    {
      id: 'pregnancy',
      type: 'single',
      prompt: 'Are you pregnant or breastfeeding?',
      help: 'Some treatments are deferred during pregnancy and breastfeeding.',
      required: true,
      options: [
        { value: 'no', label: 'No' },
        { value: 'pregnant', label: 'Pregnant' },
        { value: 'breastfeeding', label: 'Breastfeeding' },
        { value: 'na', label: 'Not applicable' },
      ],
    },
    {
      id: 'skin_recent',
      type: 'multi',
      prompt: 'In the last 4 weeks, have you had any of these?',
      help: 'Relevant for laser & skin treatments.',
      options: [
        { value: 'sun', label: 'Significant sun exposure / tanning' },
        { value: 'retinoids', label: 'Retinoids / acids on the area' },
        { value: 'fillers', label: 'Injectables or fillers' },
        { value: 'antibiotics', label: 'Antibiotics' },
        { value: 'none', label: 'None of these' },
      ],
    },
    {
      id: 'consent_accuracy',
      type: 'boolean',
      prompt: 'Do you confirm the information you’ve given is accurate?',
      help: 'Your answers form part of your confidential clinical record.',
      required: true,
      options: [
        { value: 'no', label: 'Not yet' },
        { value: 'yes', label: 'I confirm' },
      ],
    },
  ],
};

export const treatmentConsent: Questionnaire = {
  key: 'treatment-consent',
  version: 1,
  type: 'TREATMENT_CONSENT',
  title: 'Treatment consent',
  intro:
    'Informed consent for your upcoming treatment. Please read each point — your clinician will also discuss these with you in person.',
  estMinutes: 2,
  questions: [
    {
      id: 'understands_procedure',
      type: 'boolean',
      prompt: 'Has the procedure, expected results and aftercare been explained to your satisfaction?',
      required: true,
      options: [
        { value: 'no', label: 'I have questions' },
        { value: 'yes', label: 'Yes' },
      ],
    },
    {
      id: 'understands_risks',
      type: 'boolean',
      prompt: 'Do you understand that results vary and some risks/side-effects exist?',
      required: true,
      options: [
        { value: 'no', label: 'Not sure' },
        { value: 'yes', label: 'I understand' },
      ],
    },
    {
      id: 'photos',
      type: 'single',
      prompt: 'May we take confidential before & after photos for your clinical record?',
      required: true,
      options: [
        { value: 'record_only', label: 'Yes — clinical record only' },
        { value: 'marketing_ok', label: 'Yes — and anonymously for marketing' },
        { value: 'no', label: 'No' },
      ],
    },
    {
      id: 'questions',
      type: 'longtext',
      prompt: 'Any questions for your clinician before your visit?',
      placeholder: 'Optional.',
    },
    {
      id: 'consent_final',
      type: 'boolean',
      prompt: 'Do you consent to proceed with the agreed treatment?',
      required: true,
      options: [
        { value: 'no', label: 'Not yet' },
        { value: 'yes', label: 'I consent' },
      ],
    },
  ],
};

export const questionnaires: Record<string, Questionnaire> = {
  [medicalHistory.key]: medicalHistory,
  [treatmentConsent.key]: treatmentConsent,
};

export const getQuestionnaire = (key: string): Questionnaire | undefined => questionnaires[key];

/** The set offered in the portal, in order. */
export const portalAssessments = [medicalHistory, treatmentConsent];

/** Decide whether a question should render given current answers. */
export function isVisible(q: Question, answers: Record<string, unknown>): boolean {
  if (!q.showIf) return true;
  const v = answers[q.showIf.id];
  if (q.showIf.equals !== undefined) return v === q.showIf.equals;
  if (q.showIf.truthy) return Array.isArray(v) ? v.length > 0 && !(v.length === 1 && v[0] === 'none') : !!v;
  return true;
}
