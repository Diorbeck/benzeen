# Telegram bot + Mini App (driver orders)

Drivers create fuel orders from a Telegram Mini App. This doc covers the
one-time setup you (the owner) do in Telegram + the env vars to set. The app
code is already shipped; everything is a **no-op until `TELEGRAM_BOT_TOKEN` is
set**, so nothing breaks if you skip this.

## 1. Create the channel (optional, for announcements)

In the Telegram app: **New Channel** → name it (e.g. "Benzeen"), set a public
link, add a description and logo. This is purely a marketing/announcements
channel and is independent of the bot below.

## 2. Create the bot

1. Open [@BotFather](https://t.me/BotFather) → `/newbot`.
2. Choose a name and a username ending in `bot` (e.g. `benzeen_bot`).
3. BotFather replies with a **token** like `123456:ABC-DEF...`. Keep it secret.
4. Set the token in the deployment env:
   - `TELEGRAM_BOT_TOKEN="123456:ABC-DEF..."`

## 3. Attach the Mini App

Tell BotFather where the Mini App lives so the "Open app" button works:

1. `/newapp` (or **Bot Settings → Menu Button → Configure menu button**).
2. Select your bot.
3. Set the Web App URL to: `https://benzeen.uz/tg`
4. (Optional) set a menu-button title like "Открыть приложение".

Env (only needed if the URL differs from `NEXT_PUBLIC_APP_URL` + `/tg`):

```
NEXT_PUBLIC_TG_MINIAPP_URL="https://benzeen.uz/tg"
```

## 4. Register the webhook

Pick a random secret and store it as `TELEGRAM_WEBHOOK_SECRET`. Then register
the webhook (run once, replace `<TOKEN>` and `<SECRET>`):

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://benzeen.uz/api/telegram/webhook" \
  -d "secret_token=<SECRET>"
```

The same `<SECRET>` must be set in the deployment env as
`TELEGRAM_WEBHOOK_SECRET`. Telegram sends it back in the
`X-Telegram-Bot-Api-Secret-Token` header and the webhook rejects anything that
doesn't match.

Verify: `curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"`.

## 5. How drivers use it

1. Driver opens the bot, taps **Open app** (or `/start`).
2. First time only: they enter their **phone + password** (the same driver
   credentials they use on the website). This links their Telegram account.
3. After that, the app opens straight to the dashboard — no login — because we
   stored their Telegram id (`User.telegramId`).
4. They can: create a fuel order, see their orders, see remaining limit, and
   they get a Telegram message when a courier accepts / departs / delivers.

## Security notes

- Every Mini App request carries Telegram `initData`, validated server-side via
  HMAC-SHA256 with the bot token (`src/lib/telegram.ts`). No cookies are used,
  which avoids issues inside Telegram's in-app WebView.
- `/tg` deliberately drops `X-Frame-Options` so Telegram can embed it; trust
  comes from the `initData` signature, not from blocking embedding.
- Linking is rate-limited (shared limiter with the main auth endpoints) and
  returns a generic error so phone numbers can't be enumerated.
