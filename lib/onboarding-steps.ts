import type { OnbStep } from '@/components/onboarding/OnboardingModal';

// Per-audience onboarding question flows (client-safe data).

export const CLIENT_STEPS: OnbStep[] = [
  { type: 'tel', key: 'phone', label: 'What’s the best number for you?', help: 'For appointment reminders and anything urgent.', placeholder: '07…' },
  { type: 'select', key: 'gender', label: 'How do you identify?', help: 'Optional — helps us recommend relevant treatments.', options: [
    { value: 'FEMALE', label: 'Female' }, { value: 'MALE', label: 'Male' }, { value: 'NON_BINARY', label: 'Non-binary' }, { value: 'PREFER_NOT_TO_SAY', label: 'Prefer not to say' },
  ] },
  { type: 'chips', key: 'concerns', label: 'What are you hoping to improve?', help: 'Pick any that apply — we’ll tailor our suggestions.', options: ['Anti-ageing', 'Skin clarity', 'Pigmentation', 'Acne', 'Hair removal', 'Hydration', 'Body contouring', 'Teeth & smile'] },
  { type: 'toggle', key: 'smsReminders', label: 'Text-message reminders?', help: 'We’ll text confirmations and reminders for your visits.' },
  { type: 'toggle', key: 'marketingOptIn', label: 'Offers, events & skincare tips?', help: 'Occasional emails — unsubscribe any time.' },
  { type: 'info', key: 'medical', label: 'Your medical history', help: 'Please complete your medical history & pre-treatment forms before your first treatment — it keeps you safe.', ctaLabel: 'Complete my forms', ctaHref: '/account/assessments' },
];

export const STAFF_STEPS: OnbStep[] = [
  { type: 'text', key: 'name', label: 'Your name', help: 'As it should appear to colleagues and on your team card.' },
  { type: 'text', key: 'title', label: 'Your role / job title', help: 'e.g. Aesthetic Doctor, Nurse Prescriber, Front of House.' },
  { type: 'text', key: 'credentials', label: 'Registration & qualifications', help: 'For clinicians — e.g. “GMC 1234567 · Level 7 Aesthetics”.', placeholder: 'GMC / GDC / NMC · qualification' },
  { type: 'text', key: 'photoUrl', label: 'A headshot (optional)', help: 'Paste an image URL (upload in Media library first).' },
  { type: 'tel', key: 'publicPhone', label: 'Best contact number', help: 'For internal contact and (optionally) your team card.' },
  { type: 'info', key: 'twofa', label: 'Secure your account', help: 'You handle client and health data — please set up two-factor authentication now.', ctaLabel: 'Set up 2FA', ctaHref: '/admin/profile?setup2fa=1' },
];

export const ACADEMY_STEPS: OnbStep[] = [
  { type: 'textarea', key: 'goals', label: 'What do you want to achieve?', help: 'Tell us your goals so we can support you through your training.', placeholder: 'e.g. Qualify in advanced aesthetics and start treating clients…' },
];

export const ONBOARDING = {
  client: { title: 'Welcome', intro: 'A few quick questions so we can look after you properly — about a minute.', steps: CLIENT_STEPS, endpoint: '/api/account/onboarding' },
  staff: { title: 'Set up your profile', intro: 'Let’s get your staff profile ready — about a minute.', steps: STAFF_STEPS, endpoint: '/api/admin/onboarding' },
  academy: { title: 'Welcome to K Academy', intro: 'One quick question to personalise your training.', steps: ACADEMY_STEPS, endpoint: '/api/academy/onboarding' },
} as const;
