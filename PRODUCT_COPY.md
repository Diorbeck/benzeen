# Benzeen B2C — Product Copy

Voice: short, human, confident, calm. Local and technological, never hypey.
All shipped strings live in `messages/{uz,ru,en}.json`; this doc is the rationale
and the single list of claims we may and may not make.

## Brand promise

> **Топливо приедет к вам.** Бензин к вашей машине по всему Ташкенту — по цене
> как на АЗС, с бесплатной доставкой и оплатой картой курьеру.

## Hero H1 — three variants (strongest is shipped)

1. **«Топливо приедет к вам»** ✅ *shipped* — shortest, benefit-first, works in all
   three languages, pairs with the map/route visual. Reads in <1s.
2. «Заправка без заезда на АЗС» — good but frames by the negative (what you avoid).
3. «Бензин к машине за пару минут до заказа» — leans on a time claim we don't
   want to promise numerically yet.

Shipped subtitle: *«Бензин к вашей машине по всему Ташкенту. Цена — как на АЗС,
видна до заказа. Доставка бесплатно.»*

## CTAs

- Primary: **Заказать бензин** / **Заказать топливо** (header, hero, services).
- Secondary: **Найти пропан** / **Найти ближайшую точку** (never «Открыть»).
- Order screen: **Заказать** (turns into inline **Подтвердить и заказать** after SMS).

## Step captions (order flow)

1. **Автомобиль** — госномер (+ марка, объём бака — необязательно).
2. **Топливо и объём** — АИ-92/95/100, 30/40/50/60 л или свой; «До полного бака».
3. **Адрес** — моя геолокация или точка на карте, комментарий-ориентир.

Full-tank note: *«Заправим до полного бака (примерно N л). Итог — по фактически
залитым литрам.»*

## Disabled-state reasons (always explain, never a silent grey button)

- no point → «Укажите адрес на карте»
- no car → «Добавьте автомобиль»
- volume < 30 → «Минимум 30 литров»
- full tank without capacity → «Укажите объём бака для „полного бака"»

## Errors

- Invalid phone → «Введите корректный номер +998XXXXXXXXX»
- SMS gateway down → «SMS временно недоступна, попробуйте позже» (honest, not «что-то пошло не так»)
- Invalid/expired code → «Неверный или просроченный код»
- Generic order failure → «Что-то пошло не так. Попробуйте ещё раз.»

## Empty / success

- Propane empty → «Точки скоро появятся. Мы готовим карту пропан-точек по Ташкенту.»
- Order success → the order page (number, live status, details, next action) — see M3.
- Draft restored → «Мы сохранили ваш заказ — продолжайте с того же места.»

## Claims we MAY show (owner-confirmed)

- Работаем 24/7.
- Покрытие — весь Ташкент.
- Цена как на АЗС (маржа в литре), видна до заказа.
- Доставка бесплатна.
- Оплата картой курьеру (терминал/QR).

## Claims we must NOT show yet (TODO — no fake data)

- **Онлайн-оплата (Payme)** — до выдачи merchant-ключей (`onlinePaymentEnabled=false`).
- **Числа/метрики**: конкретный ETA, «N заказов», «N курьеров», средняя цена — не выдумывать.
- **Отзывы, рейтинги, партнёры, лицензии, число/адреса пропан-точек** — только когда подтверждены.
- **Скидки/бонусы/рефералка** — веха M5.
