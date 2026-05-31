// Curated aftercare guidance, keyed by treatment group, in EN/UK. Shown to
// clients in the portal for the treatments they've booked or had — so they can
// revisit care advice any time after a visit. Editorial, reassuring, practical.
//
// This is general guidance the clinic stands behind; a clinician's specific
// instructions always take precedence (stated in the portal UI).
import type { Locale } from '@/lib/i18n';

export type AftercareItem = { icon: 'sun' | 'water' | 'no-touch' | 'cool' | 'rest' | 'clock' | 'sparkle' | 'alert'; en: string; uk: string };
export type AftercareGuide = {
  group: string;
  titleEn: string; titleUk: string;
  introEn: string; introUk: string;
  items: AftercareItem[];
};

const SKIN: AftercareGuide = {
  group: 'Laser & Skin',
  titleEn: 'Laser & skin aftercare', titleUk: 'Догляд після лазера та шкіри',
  introEn: 'Your skin is in a delicate, renewing state. Treat it gently for the next few days to get the very best result.',
  introUk: 'Ваша шкіра у делікатному стані відновлення. Поводьтеся з нею обережно кілька днів для найкращого результату.',
  items: [
    { icon: 'sun', en: 'Avoid direct sun and use SPF 50 daily for at least two weeks.', uk: 'Уникайте прямого сонця та щодня застосовуйте SPF 50 щонайменше два тижні.' },
    { icon: 'cool', en: 'Soothe any warmth or redness with a cool compress — it settles within hours.', uk: 'Заспокоюйте тепло чи почервоніння прохолодним компресом — минає за кілька годин.' },
    { icon: 'no-touch', en: 'Don’t pick, scratch or exfoliate the area while it heals.', uk: 'Не чіпайте, не чухайте та не відлущуйте ділянку під час загоєння.' },
    { icon: 'water', en: 'Keep skin hydrated with a gentle, fragrance-free moisturiser.', uk: 'Підтримуйте зволоження мʼяким засобом без ароматизаторів.' },
    { icon: 'alert', en: 'Skip saunas, hot yoga and swimming pools for 48 hours.', uk: 'Відмовтеся від саун, гарячої йоги та басейнів на 48 годин.' },
  ],
};

const INJECTABLES: AftercareGuide = {
  group: 'Injectables',
  titleEn: 'Injectables aftercare', titleUk: 'Догляд після інʼєкцій',
  introEn: 'A few simple steps in the first 24–48 hours help your results settle beautifully and evenly.',
  introUk: 'Кілька простих кроків у перші 24–48 годин допоможуть результату лягти рівно й гарно.',
  items: [
    { icon: 'no-touch', en: 'Avoid touching, rubbing or massaging the area for 24 hours.', uk: 'Не торкайтеся, не тріть і не масажуйте ділянку 24 години.' },
    { icon: 'rest', en: 'Stay upright for 4 hours and avoid strenuous exercise that day.', uk: 'Залишайтеся у вертикальному положенні 4 години й уникайте навантажень того дня.' },
    { icon: 'cool', en: 'A little swelling or bruising is normal — a cool compress helps.', uk: 'Невеликий набряк чи синець — це нормально, допоможе прохолодний компрес.' },
    { icon: 'alert', en: 'Avoid alcohol, saunas and facials for 24–48 hours.', uk: 'Уникайте алкоголю, саун і догляду за обличчям 24–48 годин.' },
    { icon: 'clock', en: 'Final results develop over 1–2 weeks — be patient with the settle.', uk: 'Остаточний результат проявляється за 1–2 тижні — наберіться терпіння.' },
  ],
};

const LIFTING: AftercareGuide = {
  group: 'Lifting',
  titleEn: 'Lifting & tightening aftercare', titleUk: 'Догляд після ліфтингу',
  introEn: 'Collagen renews gradually after lifting treatments — support it with gentle, consistent care.',
  introUk: 'Колаген оновлюється поступово після ліфтингу — підтримайте його обережним регулярним доглядом.',
  items: [
    { icon: 'water', en: 'Drink plenty of water to support collagen renewal.', uk: 'Пийте достатньо води для підтримки оновлення колагену.' },
    { icon: 'sun', en: 'Protect with SPF — new collagen is sensitive to UV.', uk: 'Захищайтеся SPF — новий колаген чутливий до УФ.' },
    { icon: 'no-touch', en: 'Mild tenderness can last a few days; avoid deep facial massage.', uk: 'Легка чутливість може тривати кілька днів; уникайте глибокого масажу обличчя.' },
    { icon: 'clock', en: 'Results build over 8–12 weeks as collagen rebuilds.', uk: 'Результат наростає протягом 8–12 тижнів у міру відновлення колагену.' },
  ],
};

const FACE: AftercareGuide = {
  group: 'Face Treatments',
  titleEn: 'Facial aftercare', titleUk: 'Догляд після процедур для обличчя',
  introEn: 'Your skin is freshly resurfaced and glowing. Keep it simple and protected for a day or two.',
  introUk: 'Ваша шкіра оновлена та сяє. Кілька днів дотримуйтеся простого догляду й захисту.',
  items: [
    { icon: 'sparkle', en: 'Let your skin breathe — go make-up free for the rest of the day.', uk: 'Дайте шкірі дихати — не використовуйте макіяж до кінця дня.' },
    { icon: 'sun', en: 'Apply SPF before going outside.', uk: 'Наносьте SPF перед виходом на вулицю.' },
    { icon: 'water', en: 'Hydrate and avoid active ingredients (retinol, acids) for 48 hours.', uk: 'Зволожуйте та уникайте активних інгредієнтів (ретинол, кислоти) 48 годин.' },
    { icon: 'cool', en: 'Avoid heat — saunas, steam and hot showers — for 24 hours.', uk: 'Уникайте тепла — саун, пари та гарячого душу — 24 години.' },
  ],
};

const BODY: AftercareGuide = {
  group: 'Body',
  titleEn: 'Body treatment aftercare', titleUk: 'Догляд після процедур для тіла',
  introEn: 'Help your body respond beautifully with hydration, movement and gentle care.',
  introUk: 'Допоможіть тілу відреагувати найкраще зволоженням, рухом і дбайливим доглядом.',
  items: [
    { icon: 'water', en: 'Drink extra water for 48 hours to support the lymphatic system.', uk: 'Пийте більше води 48 годин для підтримки лімфатичної системи.' },
    { icon: 'rest', en: 'Light movement (a gentle walk) helps — avoid intense workouts for a day.', uk: 'Легкий рух (прогулянка) корисний — уникайте інтенсивних тренувань добу.' },
    { icon: 'sparkle', en: 'Eat light and avoid alcohol to maximise results.', uk: 'Їжте легку їжу й уникайте алкоголю для кращого результату.' },
    { icon: 'clock', en: 'Results appear gradually over the days following your session.', uk: 'Результат проявляється поступово протягом днів після сеансу.' },
  ],
};

const DENTAL: AftercareGuide = {
  group: 'Dentistry',
  titleEn: 'Dental aftercare', titleUk: 'Догляд після стоматології',
  introEn: 'Care for your new smile so it stays comfortable, healthy and bright.',
  introUk: 'Подбайте про свою нову усмішку, щоб вона залишалася комфортною, здоровою та яскравою.',
  items: [
    { icon: 'clock', en: 'Avoid very hot or cold food/drink while any numbness wears off.', uk: 'Уникайте дуже гарячого чи холодного, поки минає оніміння.' },
    { icon: 'sparkle', en: 'For whitening, avoid staining foods (coffee, red wine, curry) for 48 hours.', uk: 'Після відбілювання уникайте барвних продуктів (кава, червоне вино, карі) 48 годин.' },
    { icon: 'no-touch', en: 'Brush gently and keep up a soft oral-hygiene routine.', uk: 'Чистіть зуби обережно та дотримуйтеся мʼякої гігієни.' },
    { icon: 'alert', en: 'Mild sensitivity is normal and settles within a few days.', uk: 'Легка чутливість — це нормально й минає за кілька днів.' },
  ],
};

const GENERAL: AftercareGuide = {
  group: 'General',
  titleEn: 'General aftercare', titleUk: 'Загальний догляд',
  introEn: 'A few gentle habits help you get the most from any treatment.',
  introUk: 'Кілька простих звичок допоможуть отримати максимум від будь-якої процедури.',
  items: [
    { icon: 'water', en: 'Stay well hydrated and rest well in the first 24 hours.', uk: 'Пийте достатньо води та добре відпочивайте перші 24 години.' },
    { icon: 'sun', en: 'Protect treated skin from the sun with SPF.', uk: 'Захищайте оброблену шкіру від сонця за допомогою SPF.' },
    { icon: 'no-touch', en: 'Avoid touching or irritating the treated area.', uk: 'Уникайте дотиків і подразнення обробленої ділянки.' },
    { icon: 'alert', en: 'Contact us if anything feels unexpected — we’re here to help.', uk: 'Звʼяжіться з нами, якщо щось турбує — ми завжди поруч.' },
  ],
};

const GUIDES: AftercareGuide[] = [SKIN, INJECTABLES, LIFTING, FACE, BODY, DENTAL];

// Map a treatment group → its aftercare guide (Dental/Dentistry & Wellness fold in).
export function guideForGroup(group: string | undefined): AftercareGuide {
  if (!group) return GENERAL;
  if (group === 'Dental') return DENTAL;
  if (group === 'Wellness') return BODY;
  return GUIDES.find((g) => g.group === group) ?? GENERAL;
}

export function aftercareTitle(g: AftercareGuide, l: Locale) { return l === 'uk' ? g.titleUk : g.titleEn; }
export function aftercareIntro(g: AftercareGuide, l: Locale) { return l === 'uk' ? g.introUk : g.introEn; }
export function aftercareText(it: AftercareItem, l: Locale) { return l === 'uk' ? it.uk : it.en; }
