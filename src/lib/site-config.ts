// Single source of marketing truth (design-pass). Only owner-confirmed facts
// are enabled here; the actual copy lives in next-intl messages. Unconfirmed
// claims stay off and are tracked as TODOs in PRODUCT_COPY.md — never shown.

export const siteConfig = {
  appName: 'Benzeen',
  // Support phone shown in header/footer (already used in the codebase).
  supportPhone: '+998970808880',
  // Confirmed, showable facts. Text is localized; these flags gate visibility.
  facts: {
    available247: true, // работаем 24/7
    coversAllTashkent: true, // покрытие — весь Ташкент
    priceAsStation: true, // цена как на АЗС
    freeDelivery: true, // доставка бесплатна
    cardToCourier: true, // оплата картой курьеру (терминал/QR)
  },
  // Online payment (Payme) — не обещаем в UI, пока нет merchant-ключей.
  onlinePaymentEnabled: false,
  // Legal/utility links (routes already exist).
  links: {
    terms: '/terms',
    privacy: '/privacy',
  },
} as const;

export type SiteConfig = typeof siteConfig;
