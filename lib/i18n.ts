// ─────────────────────────────────────────────────────────────────────────────
// Staff CRM internationalisation.
//
// British English is the canonical source language for the whole project. This
// dictionary translates the CRM (admin) UI only — the public/marketing site is
// intentionally NOT affected here.
//
// Pure data + a tiny `t()` helper, safe to import on client and server.
// To add a language: add its code to LOCALES and a column to each entry.
// To translate a new string: add a key here and use t(locale, 'key').
// ─────────────────────────────────────────────────────────────────────────────

export const LOCALES = ['en', 'uk'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  uk: 'Українська',
};

export function isLocale(v: unknown): v is Locale {
  return typeof v === 'string' && (LOCALES as readonly string[]).includes(v);
}

// key → { en, uk }. Keep keys namespaced by area (nav.*, common.*, timeoff.*).
type Entry = Record<Locale, string>;

export const DICT: Record<string, Entry> = {
  // ── Navigation ──
  'nav.overview': { en: 'Overview', uk: 'Огляд' },
  'nav.myday': { en: 'My day', uk: 'Мій день' },
  'nav.tasks': { en: 'Tasks', uk: 'Завдання' },
  'nav.calendar': { en: 'Calendar', uk: 'Календар' },
  'nav.bookings': { en: 'Bookings', uk: 'Записи' },
  'nav.consultations': { en: 'Consultations', uk: 'Консультації' },
  'nav.clients': { en: 'Clients', uk: 'Клієнти' },
  'nav.discounts': { en: 'Discounts', uk: 'Знижки' },
  'nav.reviews': { en: 'Reviews', uk: 'Відгуки' },
  'nav.rewards': { en: 'Rewards', uk: 'Винагороди' },
  'nav.membership': { en: 'Membership', uk: 'Членство' },
  'nav.schedule': { en: 'Schedules', uk: 'Розклади' },
  'nav.timeoff': { en: 'Time off', uk: 'Відпустки' },
  'nav.services': { en: 'Services & pricing', uk: 'Послуги та ціни' },
  'nav.products': { en: 'Products', uk: 'Товари' },
  'nav.pages': { en: 'Pages', uk: 'Сторінки' },
  'nav.blocks': { en: 'Reusable blocks', uk: 'Багаторазові блоки' },
  'nav.journal': { en: 'Journal', uk: 'Журнал' },
  'nav.media': { en: 'Media library', uk: 'Медіатека' },
  'nav.academy': { en: 'Academy', uk: 'Академія' },
  'nav.careers': { en: 'Careers', uk: 'Кар’єра' },
  'nav.gallery': { en: 'Before & after', uk: 'До та після' },
  'nav.gift': { en: 'Gift vouchers', uk: 'Подарункові' },
  'nav.inventory': { en: 'Inventory', uk: 'Склад' },
  'nav.suppliers': { en: 'Suppliers', uk: 'Постачальники' },
  'nav.reorder': { en: 'Reorder', uk: 'Замовлення' },
  'nav.sops': { en: 'SOPs', uk: 'Стандарти (SOP)' },
  'nav.consent': { en: 'Consent forms', uk: 'Форми згоди' },
  'nav.dayclose': { en: 'Day close', uk: 'Закриття дня' },
  'nav.build': { en: 'Build & issues', uk: 'Розробка та задачі' },
  'nav.marketing': { en: 'Marketing hub', uk: 'Маркетинг' },
  'nav.brand': { en: 'Brand kit', uk: 'Бренд-кіт' },
  'nav.audiences': { en: 'Audiences', uk: 'Аудиторії' },
  'nav.campaigns': { en: 'Campaigns', uk: 'Кампанії' },
  'nav.email': { en: 'Email marketing', uk: 'Email-маркетинг' },
  'nav.templates': { en: 'Email templates', uk: 'Шаблони листів' },
  'nav.ab': { en: 'A/B testing', uk: 'A/B тести' },
  'nav.insights': { en: 'Behaviour insights', uk: 'Поведінкова аналітика' },
  'nav.performance': { en: 'Performance & forecast', uk: 'Результати та прогноз' },
  'nav.connections': { en: 'Connections', uk: 'Інтеграції' },
  'nav.automations': { en: 'Automations', uk: 'Автоматизації' },
  'nav.qr': { en: 'QR codes', uk: 'QR-коди' },
  'nav.activity': { en: 'Activity log', uk: 'Журнал дій' },
  'nav.staff': { en: 'Staff & access', uk: 'Персонал і доступ' },
  'nav.orders': { en: 'Orders', uk: 'Замовлення' },
  'nav.pos': { en: 'Till (POS)', uk: 'Каса (POS)' },
  'nav.cashflow': { en: 'Cashflow', uk: 'Грошовий потік' },
  'nav.reports': { en: 'Reports', uk: 'Звіти' },
  'nav.site': { en: 'Site & globals', uk: 'Сайт і глобальні' },
  'nav.locations': { en: 'Locations', uk: 'Локації' },
  'nav.seo': { en: 'SEO & AI search', uk: 'SEO та AI-пошук' },
  'nav.redirects': { en: 'Redirects', uk: 'Перенаправлення' },
  'nav.integrations': { en: 'Integrations', uk: 'Інтеграції' },
  'nav.settings': { en: 'Settings', uk: 'Налаштування' },

  // ── Shell / common ──
  'shell.crm': { en: 'KClinics CRM', uk: 'KClinics CRM' },
  'shell.signOut': { en: 'Sign out', uk: 'Вийти' },
  'shell.profile': { en: 'My profile', uk: 'Мій профіль' },
  'shell.menu': { en: 'Menu', uk: 'Меню' },
  'shell.language': { en: 'Language', uk: 'Мова' },
  'shell.searchClients': { en: 'Search clients…', uk: 'Пошук клієнтів…' },
  'shell.search': { en: 'Search everything…', uk: 'Пошук усюди…' },
  'nav.group.today': { en: 'Today', uk: 'Сьогодні' },
  'nav.security': { en: 'Security centre', uk: 'Безпека' },
  'nav.golive': { en: 'Go live', uk: 'Запуск' },
  'nav.promotions': { en: 'Promotions', uk: 'Промокоди' },
  'nav.chat': { en: 'Live chat', uk: 'Онлайн-чат' },
  'nav.calls': { en: 'Calls', uk: 'Дзвінки' },
  'nav.group.clients': { en: 'Clients & bookings', uk: 'Клієнти та записи' },
  'nav.group.catalogue': { en: 'Catalogue', uk: 'Каталог' },
  'nav.group.operations': { en: 'Operations', uk: 'Операції' },
  'nav.group.marketing': { en: 'Marketing', uk: 'Маркетинг' },
  'nav.group.finance': { en: 'Finance', uk: 'Фінанси' },
  'nav.group.admin': { en: 'Administration', uk: 'Адміністрування' },
  'common.save': { en: 'Save', uk: 'Зберегти' },
  'common.saving': { en: 'Saving…', uk: 'Збереження…' },
  'common.saved': { en: 'Saved ✓', uk: 'Збережено ✓' },
  'common.cancel': { en: 'Cancel', uk: 'Скасувати' },
  'common.from': { en: 'From', uk: 'З' },
  'common.to': { en: 'To', uk: 'До' },
  'common.reason': { en: 'Reason', uk: 'Причина' },
  'common.optional': { en: 'optional', uk: 'необовʼязково' },
  'common.type': { en: 'Type', uk: 'Тип' },
  'common.couldNotSave': { en: 'Could not save', uk: 'Не вдалося зберегти' },

  // ── Time off ──
  'timeoff.title': { en: 'Time off', uk: 'Відпустки' },
  'timeoff.request': { en: 'Request time off', uk: 'Запросити відпустку' },
  'timeoff.book': { en: 'Book time off', uk: 'Забронювати відпустку' },
  'timeoff.allDay': { en: 'All day', uk: 'Весь день' },
  'timeoff.my': { en: 'My time off', uk: 'Мої відпустки' },
  'timeoff.none': { en: 'No time off booked yet.', uk: 'Відпусток ще не заброньовано.' },
  'timeoff.pending': { en: 'Pending approvals', uk: 'Очікують підтвердження' },
  'timeoff.noPending': { en: 'Nothing awaiting approval.', uk: 'Немає запитів на підтвердження.' },
  'timeoff.approve': { en: 'Approve', uk: 'Підтвердити' },
  'timeoff.decline': { en: 'Decline', uk: 'Відхилити' },
  'timeoff.team': { en: 'Team time off — upcoming', uk: 'Відпустки команди — найближчі' },
  'timeoff.noTeam': { en: 'No approved time off coming up.', uk: 'Немає підтверджених відпусток найближчим часом.' },
  'timeoff.submitting': { en: 'Submitting…', uk: 'Надсилання…' },
  'timeoff.requested': { en: 'Requested ✓ — awaiting approval', uk: 'Запит надіслано ✓ — очікує підтвердження' },
  'timeoff.booked': { en: 'Booked ✓', uk: 'Заброньовано ✓' },
  'kind.HOLIDAY': { en: 'Holiday', uk: 'Відпустка' },
  'kind.SICK': { en: 'Sick leave', uk: 'Лікарняний' },
  'kind.TRAINING': { en: 'Training', uk: 'Навчання' },
  'kind.PERSONAL': { en: 'Personal / appointment', uk: 'Особисте / запис' },
  'kind.BLOCKED': { en: 'Blocked', uk: 'Заблоковано' },
  'status.PENDING': { en: 'pending', uk: 'очікує' },
  'status.APPROVED': { en: 'approved', uk: 'підтверджено' },
  'status.DECLINED': { en: 'declined', uk: 'відхилено' },
  'status.CANCELLED': { en: 'cancelled', uk: 'скасовано' },
};

/** Translate a key for a locale, falling back to English then the key itself.
 *  Supports {var} interpolation. */
export function t(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  const entry = DICT[key];
  let out = entry ? entry[locale] ?? entry[DEFAULT_LOCALE] : key;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
  return out;
}

/** Bind a locale to get a `t(key)` function. */
export function translator(locale: Locale) {
  return (key: string, vars?: Record<string, string | number>) => t(locale, key, vars);
}
