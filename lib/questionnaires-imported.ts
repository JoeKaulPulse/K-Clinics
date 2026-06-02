// Questionnaire definitions for clinical records MIGRATED from the old website.
// These are registered so imported HealthAssessment records render with proper
// labels in the clinical view. They are deliberately NOT added to
// `portalAssessments`, so clients are never offered them to fill in.

import type { Questionnaire } from './questionnaires';

const YESNO = [
  { value: 'no', label: 'No' },
  { value: 'yes', label: 'Yes' },
];

export const importedConsent: Questionnaire = {
  key: 'imported-consent',
  version: 1,
  type: 'TREATMENT_CONSENT',
  title: 'Treatment consent (imported)',
  intro: 'Consent record migrated from the previous website. The signature image is retained, encrypted, on the record.',
  estMinutes: 1,
  questions: [
    { id: 'agreed_terms', type: 'boolean', prompt: 'Agreed to treatment terms', options: YESNO },
    { id: 'agreed_privacy', type: 'boolean', prompt: 'Agreed to privacy / data policy', options: YESNO },
    { id: 'agreed_marketing', type: 'boolean', prompt: 'Agreed to marketing contact', options: YESNO },
    { id: 'signature_present', type: 'boolean', prompt: 'Signature captured', options: YESNO },
  ],
};

export const importedSkinQuiz: Questionnaire = {
  key: 'imported-skin-quiz',
  version: 1,
  type: 'SKIN_PROFILE',
  title: 'Skin quiz (imported)',
  intro: 'Skin consultation quiz migrated from the previous website.',
  estMinutes: 3,
  questions: [
    { id: 'name', type: 'text', prompt: 'Name given' },
    { id: 'level1', type: 'longtext', prompt: 'Answer 1' },
    { id: 'level2', type: 'longtext', prompt: 'Answer 2' },
    { id: 'level3', type: 'longtext', prompt: 'Answer 3' },
    { id: 'level4', type: 'longtext', prompt: 'Answer 4' },
    { id: 'level5', type: 'longtext', prompt: 'Answer 5' },
    { id: 'level6', type: 'longtext', prompt: 'Answer 6' },
    { id: 'level7', type: 'longtext', prompt: 'Answer 7' },
    { id: 'level8', type: 'longtext', prompt: 'Answer 8' },
    { id: 'about', type: 'longtext', prompt: 'About / notes' },
  ],
};

export const importedCarePlan: Questionnaire = {
  key: 'imported-care-plan',
  version: 1,
  type: 'MEDICAL_HISTORY',
  title: 'Care plan (imported)',
  intro: 'Clinician-authored care plan migrated from the previous website.',
  estMinutes: 2,
  questions: [
    { id: 'goal', type: 'longtext', prompt: 'Goal' },
    { id: 'duration', type: 'text', prompt: 'Duration' },
    { id: 'recommendations', type: 'longtext', prompt: 'Recommendations' },
    { id: 'description', type: 'longtext', prompt: 'Description' },
    { id: 'timeline', type: 'longtext', prompt: 'Timeline' },
    { id: 'doctor', type: 'text', prompt: 'Clinician' },
  ],
};

export const importedRecommendation: Questionnaire = {
  key: 'imported-recommendation',
  version: 1,
  type: 'MEDICAL_HISTORY',
  title: 'Clinical recommendation (imported)',
  intro: 'Clinician recommendation migrated from the previous website.',
  estMinutes: 1,
  questions: [
    { id: 'name', type: 'text', prompt: 'Title' },
    { id: 'details', type: 'longtext', prompt: 'Details' },
    { id: 'doctor', type: 'text', prompt: 'Clinician' },
  ],
};

export const importedQuestionnaires = [importedConsent, importedSkinQuiz, importedCarePlan, importedRecommendation];
