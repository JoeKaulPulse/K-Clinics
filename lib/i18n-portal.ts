// ─────────────────────────────────────────────────────────────────────────────
// Client portal internationalisation (EN / UK).
//
// British English is the canonical source. Clients choose a language at signup;
// the portal renders in that language and they can toggle it any time. Distinct
// from the staff-CRM dictionary (lib/i18n.ts) so the two evolve independently.
// ─────────────────────────────────────────────────────────────────────────────
import { LOCALES, DEFAULT_LOCALE, type Locale } from '@/lib/i18n';

export { LOCALES, DEFAULT_LOCALE, type Locale };
export const PORTAL_LOCALE_COOKIE = 'kc_clang';

type Entry = Record<Locale, string>;

export const PORTAL_DICT: Record<string, Entry> = {
  // Signup wizard
  'signup.eyebrow': { en: 'Client portal', uk: 'Кабінет клієнта' },
  'signup.welcome': { en: 'Welcome to K Clinics', uk: 'Ласкаво просимо до K Clinics' },
  'signup.step': { en: 'Step {n} of {total}', uk: 'Крок {n} з {total}' },
  'signup.langTitle': { en: 'Choose your language', uk: 'Оберіть мову' },
  'signup.langSub': { en: 'Your portal will be shown in this language. You can change it any time.', uk: 'Кабінет відображатиметься цією мовою. Її можна змінити будь-коли.' },
  'signup.nameTitle': { en: 'What shall we call you?', uk: 'Як до вас звертатися?' },
  'signup.nameSub': { en: 'Let’s start with your name.', uk: 'Почнемо з вашого імені.' },
  'signup.contactTitle': { en: 'How can we reach you?', uk: 'Як з вами звʼязатися?' },
  'signup.contactSub': { en: 'We’ll use these to confirm appointments.', uk: 'Ми використаємо це для підтвердження записів.' },
  'signup.secureTitle': { en: 'Secure your account', uk: 'Захистіть свій акаунт' },
  'signup.secureSub': { en: 'Create a password to finish.', uk: 'Створіть пароль, щоб завершити.' },
  'field.firstName': { en: 'First name', uk: 'Імʼя' },
  'field.lastName': { en: 'Last name', uk: 'Прізвище' },
  'field.email': { en: 'Email', uk: 'Електронна пошта' },
  'field.phone': { en: 'Phone', uk: 'Телефон' },
  'field.dob': { en: 'Date of birth', uk: 'Дата народження' },
  'field.password': { en: 'Create a password', uk: 'Створіть пароль' },
  'field.optional': { en: 'optional', uk: 'необовʼязково' },
  'signup.marketing': { en: 'Send me offers, events and skincare tips.', uk: 'Надсилайте мені пропозиції, події та поради по догляду.' },
  'signup.consent': { en: 'I agree to the Terms & Privacy Policy.', uk: 'Я погоджуюся з Умовами та Політикою конфіденційності.' },
  'signup.consentRequired': { en: 'Please accept the terms to continue.', uk: 'Будь ласка, прийміть умови, щоб продовжити.' },
  'action.continue': { en: 'Continue', uk: 'Далі' },
  'action.back': { en: 'Back', uk: 'Назад' },
  'action.create': { en: 'Create account & claim 15% off', uk: 'Створити акаунт і отримати 15% знижки' },
  'action.creating': { en: 'Creating your account…', uk: 'Створення акаунту…' },
  'signup.haveAccount': { en: 'Already have an account?', uk: 'Вже маєте акаунт?' },
  'action.signin': { en: 'Sign in', uk: 'Увійти' },
  'signup.doneTitle': { en: 'Welcome to K Clinics, {name}.', uk: 'Ласкаво просимо до K Clinics, {name}.' },
  'signup.discountReady': { en: 'Your {percent}% welcome discount is ready — code {code}. It’s saved to your account.', uk: 'Ваша знижка {percent}% готова — код {code}. Її збережено у вашому акаунті.' },
  'signup.goPortal': { en: 'Go to my portal', uk: 'Перейти до кабінету' },
  'error.network': { en: 'Network error — please try again.', uk: 'Помилка мережі — спробуйте ще раз.' },
  'error.create': { en: 'Could not create your account.', uk: 'Не вдалося створити акаунт.' },

  // Portal shell / nav
  'nav.overview': { en: 'Overview', uk: 'Огляд' },
  'nav.appointments': { en: 'Appointments', uk: 'Записи' },
  'nav.assessments': { en: 'Health forms', uk: 'Анкети здоровʼя' },
  'nav.invoices': { en: 'Invoices', uk: 'Рахунки' },
  'nav.profile': { en: 'Profile', uk: 'Профіль' },
  'portal.signOut': { en: 'Sign out', uk: 'Вийти' },
  'portal.language': { en: 'Language', uk: 'Мова' },

  // Assessment runner
  'assess.aboutMin': { en: 'about {n} min', uk: 'близько {n} хв' },
  'assess.encrypted': { en: 'Encrypted and visible only to your clinical team.', uk: 'Зашифровано та доступно лише вашій клінічній команді.' },
  'assess.begin': { en: 'Begin →', uk: 'Почати →' },
  'assess.back': { en: '← Back', uk: '← Назад' },
  'assess.continue': { en: 'Continue', uk: 'Далі' },
  'assess.continueSkip': { en: 'Continue / skip', uk: 'Далі / пропустити' },
  'assess.almost': { en: 'Almost there', uk: 'Майже готово' },
  'assess.readySubmit': { en: 'Ready to submit?', uk: 'Готові надіслати?' },
  'assess.submitIntro': { en: 'Once submitted, your answers form part of your confidential clinical record. You can submit a fresh version later if anything changes.', uk: 'Після надсилання ваші відповіді стають частиною конфіденційного клінічного запису. За потреби ви зможете надіслати оновлену версію пізніше.' },
  'assess.submit': { en: 'Submit securely', uk: 'Надіслати безпечно' },
  'assess.saving': { en: 'Encrypting & saving…', uk: 'Шифрування та збереження…' },
  'assess.doneTitle': { en: 'All done — thank you.', uk: 'Готово — дякуємо.' },
  'assess.doneBody': { en: 'Your {form} has been encrypted and added to your confidential record. Your clinician will review it before your visit.', uk: 'Ваша анкета «{form}» зашифрована та додана до конфіденційного запису. Клініцист перегляне її перед вашим візитом.' },
  'assess.backToPortal': { en: 'Back to portal', uk: 'Повернутися до кабінету' },
  'error.couldNotSave': { en: 'Could not save.', uk: 'Не вдалося зберегти.' },
};

export function pt(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  const entry = PORTAL_DICT[key];
  let out = entry ? entry[locale] ?? entry[DEFAULT_LOCALE] : key;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
  return out;
}

export function portalTranslator(locale: Locale) {
  return (key: string, vars?: Record<string, string | number>) => pt(locale, key, vars);
}
