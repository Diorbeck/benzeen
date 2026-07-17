# Переезд B2B-портала на b2b.benzeen.uz

Приложение полностью управляется переменными окружения — код менять не нужно.
Переезд выполняется в 5 шагов, без даунтайма: оба домена могут работать
параллельно, пока benzeen.uz не будет отдан новому B2C-проекту (Neo-Oil).

## 1. Добавить домен в Vercel
Vercel → проект **benzeen** → Settings → **Domains** → Add → `b2b.benzeen.uz`.
Vercel покажет, какую DNS-запись создать (обычно CNAME на `cname.vercel-dns.com`).

## 2. DNS
У регистратора домена benzeen.uz добавить запись:

```
b2b   CNAME   cname.vercel-dns.com
```

Подождать, пока Vercel покажет домен как Valid (минуты–часы).

## 3. Переменные окружения (Vercel → Settings → Environment Variables, Production)

| Переменная | Новое значение |
|---|---|
| `NEXTAUTH_URL` | `https://b2b.benzeen.uz` |
| `NEXT_PUBLIC_APP_URL` | `https://b2b.benzeen.uz` |
| `NEXT_PUBLIC_TG_MINIAPP_URL` | `https://b2b.benzeen.uz/tg` (или удалить — возьмётся из APP_URL) |

После изменения переменных — **Redeploy** (Deployments → верхний → ⋯ → Redeploy).

## 4. Перерегистрировать Telegram-вебхук
Бот должен слать обновления на новый домен. Выполнить один раз (подставить
токен бота и секрет из env; команда одной строкой, без угловых скобок):

```
curl "https://api.telegram.org/bot<TOKEN>/setWebhook" -d "url=https://b2b.benzeen.uz/api/telegram/webhook" -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

Проверить: `curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"` — в url
должен быть b2b-домен, поле last_error_message пустое.

Также в BotFather обновить Mini App URL (меню бота), если он задан явно.

## 5. Проверка
- `https://b2b.benzeen.uz` открывается, вход по логину/паролю работает
  (NextAuth куки привязаны к домену — всем придётся войти заново, это норма).
- Заказ из Mini App проходит, уведомления бота приходят.
- Пуш-уведомления: старые подписки останутся на benzeen.uz-scope —
  пользователи переподпишутся при первом заходе на новый домен.

## Когда B2C-проект будет готов
benzeen.uz в Vercel открепляется от этого проекта и добавляется в новый
проект Neo-Oil. B2B продолжает жить на b2b.benzeen.uz без изменений.
