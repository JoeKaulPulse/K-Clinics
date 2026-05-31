// Ukrainian display overlay for the health questionnaires. The English
// definitions in lib/questionnaires.ts remain canonical (answer *values* are
// stored against them, and the versioned English wording maps stored answers
// for staff). This overlay only changes what the CLIENT sees when their portal
// language is Ukrainian — it never alters stored values or versions.
//
// Keyed by questionnaire key, then by field. Options are keyed by their value.
import type { Questionnaire } from '@/lib/questionnaires';
import type { Locale } from '@/lib/i18n';

type FieldT = { prompt?: string; help?: string; placeholder?: string; options?: Record<string, string> };
type QT = { title?: string; intro?: string; fields?: Record<string, FieldT> };

const UK: Record<string, QT> = {
  'medical-history': {
    title: 'Медична історія',
    intro: 'Кілька конфіденційних запитань, щоб наші клініцисти могли спланувати найбезпечніше та найефективніше лікування для вас. Усе зашифровано й доступне лише вашій команді догляду.',
    fields: {
      general_health: {
        prompt: 'Як би ви описали свій загальний стан здоровʼя?',
        options: { excellent: 'Відмінний', good: 'Добрий', fair: 'Задовільний', managing: 'Контролюю захворювання' },
      },
      conditions: {
        prompt: 'Чи стосується вас щось із переліченого?',
        help: 'Оберіть усе, що підходить — або «Нічого з цього».',
        options: {
          diabetes: 'Діабет', heart: 'Захворювання серця / тиску', epilepsy: 'Епілепсія або судоми',
          autoimmune: 'Аутоімунне захворювання', skin: 'Захворювання шкіри (екзема, псоріаз…)',
          keloid: 'Келоїдні / аномальні рубці', cancer: 'Онкологія (зараз або в минулому)',
          bleeding: 'Порушення згортання крові', none: 'Нічого з цього',
        },
      },
      conditions_detail: {
        prompt: 'Чи є щось, що ви хотіли б повідомити клініцисту про це?',
        placeholder: 'Необовʼязково — достатньо одного-двох речень.',
      },
      medications: { prompt: 'Чи приймаєте ви зараз якісь ліки?', options: { no: 'Ні', yes: 'Так' } },
      medications_list: {
        prompt: 'Які ліки ви приймаєте?',
        placeholder: 'Зокрема регулярні, напр. Роакутан, антикоагулянти, протизаплідні…',
      },
      allergies: {
        prompt: 'Чи маєте ви алергії?',
        help: 'Зокрема на ліки, анестетики, латекс або інгредієнти косметики.',
        options: { no: 'Ні', yes: 'Так' },
      },
      allergies_list: { prompt: 'На що у вас алергія?', placeholder: 'напр. лідокаїн, пеніцилін, горіхи…' },
      pregnancy: {
        prompt: 'Чи ви вагітні або годуєте грудьми?',
        help: 'Деякі процедури відкладаються під час вагітності та грудного вигодовування.',
        options: { no: 'Ні', pregnant: 'Вагітна', breastfeeding: 'Годую грудьми', na: 'Не застосовно' },
      },
      skin_recent: {
        prompt: 'Чи було у вас щось із переліченого за останні 4 тижні?',
        help: 'Важливо для лазерних і шкірних процедур.',
        options: {
          sun: 'Значне перебування на сонці / засмага', retinoids: 'Ретиноїди / кислоти на ділянці',
          fillers: 'Інʼєкції або філери', antibiotics: 'Антибіотики', none: 'Нічого з цього',
        },
      },
      consent_accuracy: {
        prompt: 'Чи підтверджуєте ви, що надана інформація є точною?',
        help: 'Ваші відповіді є частиною конфіденційного клінічного запису.',
        options: { no: 'Ще ні', yes: 'Підтверджую' },
      },
    },
  },
  'treatment-consent': {
    title: 'Згода на лікування',
    intro: 'Інформована згода на майбутню процедуру. Будь ласка, прочитайте кожен пункт — клініцист також обговорить їх із вами особисто.',
    fields: {
      understands_procedure: {
        prompt: 'Чи були процедура, очікувані результати та догляд пояснені вам належним чином?',
        options: { no: 'У мене є запитання', yes: 'Так' },
      },
      understands_risks: {
        prompt: 'Чи розумієте ви, що результати різняться й існують певні ризики / побічні ефекти?',
        options: { no: 'Не впевнений(а)', yes: 'Розумію' },
      },
      photos: {
        prompt: 'Чи можемо ми робити конфіденційні фото «до і після» для вашого клінічного запису?',
        options: { record_only: 'Так — лише для клінічного запису', marketing_ok: 'Так — і анонімно для маркетингу', no: 'Ні' },
      },
      questions: { prompt: 'Чи є запитання до клініциста перед візитом?', placeholder: 'Необовʼязково.' },
      consent_final: {
        prompt: 'Чи погоджуєтесь ви продовжити узгоджене лікування?',
        options: { no: 'Ще ні', yes: 'Погоджуюсь' },
      },
    },
  },
};

/** Return a display-localized copy of a questionnaire. English passes through
 *  unchanged; values/version/ids are never touched. */
export function localizeQuestionnaire(q: Questionnaire, locale: Locale): Questionnaire {
  if (locale === 'en') return q;
  const o = UK[q.key];
  if (!o) return q;
  return {
    ...q,
    title: o.title ?? q.title,
    intro: o.intro ?? q.intro,
    questions: q.questions.map((qq) => {
      const f = o.fields?.[qq.id];
      if (!f) return qq;
      return {
        ...qq,
        prompt: f.prompt ?? qq.prompt,
        help: f.help ?? qq.help,
        placeholder: f.placeholder ?? qq.placeholder,
        options: qq.options?.map((opt) => ({ ...opt, label: f.options?.[opt.value] ?? opt.label })),
      };
    }),
  };
}
