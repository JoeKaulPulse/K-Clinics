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
  'signup.referred': { en: 'A friend invited you — your welcome offer is ready, and you’ll both earn £25 once your first treatment is complete.', uk: 'Вас запросив друг — ваша вітальна пропозиція готова, і ви обоє отримаєте £25 після вашої першої процедури.' },
  'action.continue': { en: 'Continue', uk: 'Далі' },
  'action.back': { en: 'Back', uk: 'Назад' },
  'action.create': { en: 'Create account & claim 15% off', uk: 'Створити акаунт і отримати 15% знижки' },
  'action.creating': { en: 'Creating your account…', uk: 'Створення акаунту…' },
  'signup.haveAccount': { en: 'Already have an account?', uk: 'Вже маєте акаунт?' },
  'action.signin': { en: 'Sign in', uk: 'Увійти' },
  'signup.doneTitle': { en: 'Welcome to K Clinics, {name}.', uk: 'Ласкаво просимо до K Clinics, {name}.' },
  'signup.discountReady': { en: 'Your {percent}% welcome discount is ready — code {code}. It’s saved to your account.', uk: 'Ваша знижка {percent}% готова — код {code}. Її збережено у вашому акаунті.' },
  'signup.goPortal': { en: 'Go to my portal', uk: 'Перейти до кабінету' },
  'signup.errFirstName': { en: 'Please enter your first name.', uk: 'Будь ласка, введіть своє імʼя.' },
  'signup.errEmail': { en: 'Please enter a valid email.', uk: 'Введіть дійсну електронну пошту.' },
  'signup.errPassword': { en: 'Use at least 8 characters.', uk: 'Використайте щонайменше 8 символів.' },
  'error.network': { en: 'Network error — please try again.', uk: 'Помилка мережі — спробуйте ще раз.' },
  'error.create': { en: 'Could not create your account.', uk: 'Не вдалося створити акаунт.' },

  // Portal shell / nav
  'nav.overview': { en: 'Overview', uk: 'Огляд' },
  'nav.appointments': { en: 'Appointments', uk: 'Записи' },
  'nav.assessments': { en: 'Health forms', uk: 'Анкети здоровʼя' },
  'nav.aftercare': { en: 'Aftercare', uk: 'Догляд' },
  'nav.invoices': { en: 'Invoices', uk: 'Рахунки' },
  'nav.profile': { en: 'Profile', uk: 'Профіль' },
  'nav.rewards': { en: 'Rewards', uk: 'Бонуси' },

  // ── Rewards / loyalty ──────────────────────────────────────────────────
  'rw.title': { en: 'Rewards', uk: 'Бонуси' },
  'rw.sub': { en: 'Earn points every time you visit and turn them into money off future treatments.', uk: 'Отримуйте бали за кожен візит і перетворюйте їх на знижку на майбутні процедури.' },
  'rw.balance': { en: 'Points balance', uk: 'Баланс балів' },
  'rw.worth': { en: 'worth {value}', uk: 'на суму {value}' },
  'rw.points': { en: 'points', uk: 'балів' },
  'rw.expiringSoon': { en: '{n} points expire within 30 days', uk: '{n} балів спливають протягом 30 днів' },
  'rw.howTitle': { en: 'How to earn', uk: 'Як заробляти' },
  'rw.howSpend': { en: '1 point for every £1 you spend on treatments', uk: '1 бал за кожен витрачений £1 на процедури' },
  'rw.howReview': { en: '50 points for leaving a review', uk: '50 балів за відгук' },
  'rw.howBirthday': { en: '200 points as a birthday gift each year', uk: '200 балів у подарунок на день народження щороку' },
  'rw.howReferral': { en: '£25 in points when a friend you refer completes their first treatment', uk: '£25 балами, коли запрошений друг завершить першу процедуру' },
  'rw.activity': { en: 'Recent activity', uk: 'Остання активність' },
  'rw.noActivity': { en: 'No points yet — your next visit is the perfect place to start.', uk: 'Поки що немає балів — ваш наступний візит — чудовий початок.' },
  'rw.redeemNote': { en: 'Apply points to an upcoming appointment from the Appointments page — up to half of any treatment.', uk: 'Застосуйте бали до майбутнього запису на сторінці «Записи» — до половини вартості процедури.' },

  // Referral
  'rw.referTitle': { en: 'Give £25, get £25', uk: 'Подаруйте £25, отримайте £25' },
  'rw.referSub': { en: 'Share your link. When a friend joins and completes their first treatment of £100 or more, you’ll both receive £25 in points.', uk: 'Поділіться посиланням. Коли друг приєднається та завершить першу процедуру на £100+, ви обоє отримаєте £25 балами.' },
  'rw.yourLink': { en: 'Your invite link', uk: 'Ваше посилання-запрошення' },
  'rw.copy': { en: 'Copy link', uk: 'Копіювати' },
  'rw.copied': { en: 'Copied', uk: 'Скопійовано' },
  'rw.share': { en: 'Share', uk: 'Поділитися' },
  'rw.referStats': { en: '{qualified} rewarded · {pending} pending', uk: '{qualified} винагороджено · {pending} в очікуванні' },
  'rw.shareText': { en: 'Join me at K Clinics and we’ll both get £25 off.', uk: 'Приєднуйтесь до мене в K Clinics — ми обоє отримаємо £25 знижки.' },

  // Redemption (on appointments)
  'rw.applyPoints': { en: 'Use points', uk: 'Використати бали' },
  'rw.applyTitle': { en: 'Apply your points', uk: 'Застосувати бали' },
  'rw.applyHint': { en: 'Up to {max} off this treatment ({balance} points available).', uk: 'До {max} знижки на цю процедуру ({balance} балів доступно).' },
  'rw.applied': { en: '{amount} off with points', uk: 'Знижка {amount} балами' },
  'rw.apply': { en: 'Apply', uk: 'Застосувати' },
  'rw.remove': { en: 'Remove', uk: 'Прибрати' },
  'rw.cancel': { en: 'Cancel', uk: 'Скасувати' },
  'portal.signOut': { en: 'Sign out', uk: 'Вийти' },
  'portal.language': { en: 'Language', uk: 'Мова' },
  'portal.footer': { en: 'Your data is encrypted and held securely. Need help? Call', uk: 'Ваші дані зашифровані та надійно захищені. Потрібна допомога? Телефонуйте' },
  'portal.greeting': { en: 'Hi, {name}', uk: 'Вітаємо, {name}' },

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

  // Login / forgot password
  'login.password': { en: 'Password', uk: 'Пароль' },
  'login.forgot': { en: 'Forgot?', uk: 'Забули?' },
  'login.signingIn': { en: 'Signing in…', uk: 'Вхід…' },
  'login.failed': { en: 'Sign in failed.', uk: 'Не вдалося увійти.' },
  'login.newHere': { en: 'New here?', uk: 'Вперше тут?' },
  'login.createCta': { en: 'Create an account — get 15% off', uk: 'Створити акаунт — знижка 15%' },
  'login.staff': { en: 'Staff & clinicians:', uk: 'Персонал і клініцисти:' },
  'login.crmSignin': { en: 'CRM sign in', uk: 'Вхід у CRM' },
  'login.preview': { en: 'This is a design preview — the secure portal runs on the live clinic site.', uk: 'Це демонстрація дизайну — захищений кабінет працює на робочому сайті клініки.' },
  'forgot.title': { en: 'Reset your password', uk: 'Скидання пароля' },
  'forgot.sub': { en: 'Enter your email and we’ll send a reset link.', uk: 'Введіть свою електронну пошту, і ми надішлемо посилання для скидання.' },
  'forgot.send': { en: 'Send reset link', uk: 'Надіслати посилання' },
  'forgot.sending': { en: 'Sending…', uk: 'Надсилання…' },
  'forgot.sent': { en: 'If an account exists for that email, a reset link is on its way.', uk: 'Якщо акаунт із такою поштою існує, посилання для скидання вже надіслано.' },
  'forgot.back': { en: 'Back to sign in', uk: 'Назад до входу' },

  // Dashboard
  'dash.eyebrow': { en: 'Your portal', uk: 'Ваш кабінет' },
  'dash.goodMorning': { en: 'Good morning, {name}.', uk: 'Доброго ранку, {name}.' },
  'dash.goodAfternoon': { en: 'Good afternoon, {name}.', uk: 'Доброго дня, {name}.' },
  'dash.goodEvening': { en: 'Good evening, {name}.', uk: 'Доброго вечора, {name}.' },
  'dash.offerReady': { en: 'Your welcome offer is ready', uk: 'Ваша вітальна пропозиція готова' },
  'dash.offerBody': { en: '{percent}% off your first treatment — code {code}', uk: '{percent}% знижки на першу процедуру — код {code}' },
  'dash.book': { en: 'Book a treatment', uk: 'Записатися на процедуру' },
  'dash.nextAppt': { en: 'Next appointment', uk: 'Наступний запис' },
  'dash.inDays': { en: 'in {n} days', uk: 'через {n} дн.' },
  'dash.tomorrow': { en: 'Tomorrow', uk: 'Завтра' },
  'dash.today': { en: 'Today', uk: 'Сьогодні' },
  'dash.manage': { en: 'Manage', uk: 'Керувати' },
  'dash.noUpcoming': { en: 'No upcoming appointments.', uk: 'Немає запланованих записів.' },
  'dash.bookNow': { en: 'Book now', uk: 'Записатися' },
  'dash.offerCode': { en: 'Your code', uk: 'Ваш код' },
  'dash.copy': { en: 'Tap to copy', uk: 'Натисніть, щоб скопіювати' },
  'dash.copied': { en: 'Copied', uk: 'Скопійовано' },
  'dash.healthForms': { en: 'Health forms', uk: 'Анкети здоровʼя' },
  'dash.complete': { en: 'Complete', uk: 'Заповнити' },
  'dash.min': { en: 'min', uk: 'хв' },
  'dash.formsComplete': { en: 'All forms complete — thank you.', uk: 'Усі анкети заповнені — дякуємо.' },
  'dash.payments': { en: 'Recent payments', uk: 'Останні платежі' },
  'dash.noPayments': { en: 'No payments yet.', uk: 'Платежів ще немає.' },
  'dash.allPayments': { en: 'All payments & invoices', uk: 'Усі платежі та рахунки' },
  'dash.bookAnother': { en: 'Book another session', uk: 'Записатися ще раз' },
  'dash.bookAnotherBody': { en: 'Browse treatments and reserve your next visit in moments.', uk: 'Перегляньте процедури та забронюйте наступний візит за мить.' },
  'dash.explore': { en: 'Explore treatments', uk: 'Переглянути процедури' },
  'dash.statVisits': { en: 'Visits', uk: 'Візити' },
  'dash.statSince': { en: 'Member since', uk: 'Клієнт з' },
  'dash.statLast': { en: 'Last visit', uk: 'Останній візит' },
  'dash.profilePrompt': { en: 'Complete your profile', uk: 'Заповніть свій профіль' },
  'dash.profileBody': { en: 'Add a few details so we can tailor your care.', uk: 'Додайте кілька даних, щоб ми могли персоналізувати догляд.' },
  'dash.updateProfile': { en: 'Update profile', uk: 'Оновити профіль' },
  'dash.history': { en: 'Your treatment history', uk: 'Історія ваших процедур' },
  'dash.curatedEyebrow': { en: 'Curated for you', uk: 'Підібрано для вас' },
  'dash.curatedTitle': { en: 'Treatments you may love', uk: 'Процедури, які вам сподобаються' },
  'dash.ctaTitle': { en: 'Ready for your next visit?', uk: 'Готові до наступного візиту?' },
  'dash.ctaBody': { en: 'Reserve a treatment with our specialists — your welcome offer and history are saved to your account.', uk: 'Забронюйте процедуру в наших фахівців — ваша пропозиція та історія збережені у вашому акаунті.' },
  'dash.quickActions': { en: 'Quick actions', uk: 'Швидкі дії' },
  'dash.qaBook': { en: 'Book a treatment', uk: 'Записатися на процедуру' },
  'dash.qaForms': { en: 'Complete health forms', uk: 'Заповнити анкети' },
  'dash.qaInvoices': { en: 'View invoices', uk: 'Переглянути рахунки' },
  'dash.qaProfile': { en: 'Edit profile', uk: 'Редагувати профіль' },
  'dash.visitUs': { en: 'Visit us', uk: 'Завітайте до нас' },
  'dash.openToday': { en: 'Open today', uk: 'Сьогодні відкрито' },
  'dash.closedToday': { en: 'Closed today', uk: 'Сьогодні зачинено' },
  'dash.directions': { en: 'Get directions', uk: 'Прокласти маршрут' },
  'dash.needHelp': { en: 'Need a hand?', uk: 'Потрібна допомога?' },
  'dash.callUs': { en: 'Call the clinic', uk: 'Зателефонувати' },

  // Aftercare
  'after.eyebrow': { en: 'Aftercare', uk: 'Догляд' },
  'after.title': { en: 'Caring for your results', uk: 'Догляд за вашим результатом' },
  'after.intro': { en: 'Guidance for the treatments you’ve booked with us — revisit it any time. Your clinician’s personal instructions always come first.', uk: 'Поради щодо процедур, які ви забронювали — повертайтеся до них будь-коли. Особисті вказівки вашого клініциста завжди мають пріоритет.' },
  'after.forTreatment': { en: 'For your {treatment}', uk: 'Для вашої процедури «{treatment}»' },
  'after.empty': { en: 'Once you’ve booked a treatment, tailored aftercare guidance appears here.', uk: 'Щойно ви забронюєте процедуру, тут зʼявляться персональні поради з догляду.' },
  'after.exploreCta': { en: 'Explore treatments', uk: 'Переглянути процедури' },
  'after.questions': { en: 'Questions about your recovery?', uk: 'Питання щодо відновлення?' },
  'after.questionsBody': { en: 'Our team is always happy to help — call us and we’ll talk it through.', uk: 'Наша команда завжди рада допомогти — зателефонуйте, і ми все обговоримо.' },

  // Assessments list
  'asmt.eyebrow': { en: 'Health forms', uk: 'Анкети здоровʼя' },
  'asmt.title': { en: 'Your assessments', uk: 'Ваші анкети' },
  'asmt.intro': { en: 'Complete these before your appointment. Every answer is encrypted and seen only by your clinical team.', uk: 'Заповніть їх перед візитом. Кожна відповідь зашифрована й доступна лише вашій клінічній команді.' },
  'asmt.completedOn': { en: 'Completed {date}', uk: 'Заповнено {date}' },
  'asmt.about': { en: 'About {n} minutes', uk: 'Близько {n} хв' },
  'asmt.start': { en: 'Start', uk: 'Почати' },
  'asmt.update': { en: 'Update', uk: 'Оновити' },
  'asmt.done': { en: 'Completed', uk: 'Заповнено' },
  'asmt.todo': { en: 'To complete', uk: 'До заповнення' },
  'asmt.progress': { en: '{done} of {total} complete', uk: '{done} з {total} заповнено' },
  'asmt.allDone': { en: 'All your health forms are complete — thank you.', uk: 'Усі ваші анкети заповнені — дякуємо.' },
  'asmt.secure': { en: 'Encrypted · clinical team only', uk: 'Зашифровано · лише клінічна команда' },

  // Profile
  'profile.newPassword': { en: 'New password (optional)', uk: 'Новий пароль (необовʼязково)' },
  'profile.leaveBlank': { en: 'Leave blank to keep current', uk: 'Залиште порожнім, щоб не змінювати' },
  'profile.marketing': { en: 'Email me offers, events and skincare tips.', uk: 'Надсилайте пропозиції, події та поради по догляду.' },
  'profile.save': { en: 'Save changes', uk: 'Зберегти зміни' },
  'profile.saving': { en: 'Saving…', uk: 'Збереження…' },
  'profile.saved': { en: 'Saved ✓', uk: 'Збережено ✓' },
  'profile.couldNotSave': { en: 'Could not save.', uk: 'Не вдалося зберегти.' },
  'profile.title': { en: 'Your profile', uk: 'Ваш профіль' },

  // Appointments
  'appt.title': { en: 'Your visits', uk: 'Ваші візити' },
  'appt.bookNew': { en: 'Book new', uk: 'Новий запис' },
  'appt.upcoming': { en: 'Upcoming', uk: 'Майбутні' },
  'appt.past': { en: 'Past', uk: 'Минулі' },
  'appt.reschedule': { en: 'Reschedule / cancel', uk: 'Перенести / скасувати' },
  'appt.addCalendar': { en: 'Add to calendar', uk: 'Додати в календар' },
  'appt.none': { en: 'No upcoming appointments.', uk: 'Немає запланованих візитів.' },
  'appt.bookNow': { en: 'Book now', uk: 'Записатися' },
  'appt.noPast': { en: 'No past visits yet.', uk: 'Минулих візитів ще немає.' },
  'status.PENDING': { en: 'Awaiting confirmation', uk: 'Очікує підтвердження' },
  'status.CONFIRMED': { en: 'Confirmed', uk: 'Підтверджено' },
  'status.COMPLETED': { en: 'Completed', uk: 'Завершено' },
  'status.CANCELLED': { en: 'Cancelled', uk: 'Скасовано' },
  'status.NO_SHOW': { en: 'Missed', uk: 'Пропущено' },

  // Data & privacy
  'privacy.title': { en: 'Data & privacy', uk: 'Дані та конфіденційність' },
  'privacy.body': { en: 'Your data is encrypted and held securely. You can download a copy any time.', uk: 'Ваші дані зашифровані та зберігаються надійно. Ви можете завантажити копію будь-коли.' },
  'privacy.download': { en: 'Download my data', uk: 'Завантажити мої дані' },
  'privacy.erase': { en: 'To request deletion of your account, contact us — we’ll verify your identity and confirm.', uk: 'Щоб видалити акаунт, звʼяжіться з нами — ми підтвердимо вашу особу та виконаємо запит.' },
  'privacy.contact': { en: 'Contact the clinic', uk: 'Звʼязатися з клінікою' },

  // Invoices
  'inv.title': { en: 'Invoices & receipts', uk: 'Рахунки та квитанції' },
  'inv.eyebrow': { en: 'Payments', uk: 'Платежі' },
  'inv.ref': { en: 'Ref', uk: '№' },
  'inv.none': { en: 'No invoices yet. Receipts for treatments and any fees will appear here.', uk: 'Рахунків ще немає. Квитанції за процедури та збори зʼявлятимуться тут.' },
  'inv.reasonTreatment': { en: 'Treatment', uk: 'Процедура' },
  'inv.reasonLateFee': { en: 'Late-cancellation fee', uk: 'Збір за пізнє скасування' },
  'inv.total': { en: 'Total paid', uk: 'Сплачено всього' },
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
