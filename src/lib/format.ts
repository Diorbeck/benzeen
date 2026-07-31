// Locale-aware formatting (design-pass). UZS amounts via Intl.NumberFormat;
// liters with correct plural forms per locale (Intl.PluralRules).

export type AppLocale = 'uz' | 'ru' | 'en';

const LOCALE_TAG: Record<AppLocale, string> = {
  uz: 'uz-UZ',
  ru: 'ru-RU',
  en: 'en-US',
};

function tag(locale: string): string {
  return LOCALE_TAG[(locale as AppLocale)] ?? 'ru-RU';
}

/** Grouped UZS amount, e.g. 1074400 → "1 074 400". Unit word comes from i18n. */
export function formatMoney(amount: number, locale: string): string {
  const n = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat(tag(locale)).format(n);
}

// Liter unit forms. ru uses one/few/many; en one/other; uz is invariant.
const LITER_FORMS: Record<AppLocale, { one: string; few: string; many: string; other: string }> = {
  ru: { one: 'литр', few: 'литра', many: 'литров', other: 'литров' },
  uz: { one: 'litr', few: 'litr', many: 'litr', other: 'litr' },
  en: { one: 'liter', few: 'liters', many: 'liters', other: 'liters' },
};

/** Just the liter unit word for a count, e.g. (2,'ru') → "литра". */
export function litersUnit(count: number, locale: string): string {
  const l = (locale as AppLocale) in LITER_FORMS ? (locale as AppLocale) : 'ru';
  const rule = new Intl.PluralRules(tag(l)).select(count);
  const forms = LITER_FORMS[l];
  return forms[rule as keyof typeof forms] ?? forms.other;
}

/** Count + localized liter unit, e.g. (30,'ru') → "30 литров". */
export function formatLiters(count: number, locale: string): string {
  const n = Number.isFinite(count) ? count : 0;
  return `${new Intl.NumberFormat(tag(locale)).format(n)} ${litersUnit(n, locale)}`;
}
