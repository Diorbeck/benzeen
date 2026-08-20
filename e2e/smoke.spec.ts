import { test, expect } from '@playwright/test';

// Гостевые smoke-сценарии (PR-B). БД в CI засеяна prisma/seed.ts:
// цены АИ-92/95/100 и две демо пропан-точки.

test.describe('Главная', () => {
  test('рендерится с hero и CTA', async ({ page }) => {
    await page.goto('/ru');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: /бензин/i }).first()).toBeVisible();
  });

  test('переключение тёмной темы', async ({ page }) => {
    await page.goto('/ru');
    await page.waitForLoadState('networkidle');
    const html = page.locator('html');
    // v2: тристейт-переключатель (светлая/тёмная/системная) — три кнопки в
    // группе «Тема» с явными подписями.
    const group = page.getByRole('group', { name: 'Тема' }).first();
    const darkBtn = group.getByRole('button', { name: 'Тёмная тема' });
    const lightBtn = group.getByRole('button', { name: 'Светлая тема' });
    // Клик внутри poll: первый клик может прийтись до гидрации React и
    // пройти в никуда — повторяем, пока класс не переключится.
    await expect
      .poll(
        async () => {
          await darkBtn.click();
          await page.waitForTimeout(300);
          return ((await html.getAttribute('class')) ?? '').includes('dark');
        },
        { timeout: 10_000 },
      )
      .toBe(true);
    await expect
      .poll(
        async () => {
          await lightBtn.click();
          await page.waitForTimeout(300);
          return ((await html.getAttribute('class')) ?? '').includes('dark');
        },
        { timeout: 10_000 },
      )
      .toBe(false);
  });
});

test.describe('/benzin — гость собирает заказ до подтверждения', () => {
  test('машина + топливо + объём → сумма считается, сабмит ждёт адрес', async ({ page }) => {
    await page.goto('/ru/benzin');

    // Шаг 1: новая машина — номер
    const plate = page.getByPlaceholder(/01\s?A|номер/i).first();
    await plate.fill('01A123BC');

    // Шаг 2: топливо АИ-95 и объём 50 л
    await page.getByRole('button', { name: 'АИ-95' }).click();
    await page.getByRole('button', { name: /^50/ }).click();

    // Итог посчитан (15 800 × 50). Сумма есть в трёх местах (мобильное
    // саммари, десктопное, нижний бар) — два из них скрыты медиа-запросом,
    // поэтому фильтруем по видимости.
    await expect(page.getByText(/790\s?000/).filter({ visible: true }).first()).toBeVisible();

    // Подтверждение недоступно, пока нет адреса — кнопка «Заказать» задизейблена
    const submit = page.getByRole('button', { name: /заказать/i }).last();
    await expect(submit).toBeDisabled();
  });
});

test.describe('/client-login', () => {
  test('рендер и валидация номера', async ({ page }) => {
    await page.goto('/ru/client-login');
    const phone = page.locator('#client-phone');
    await expect(phone).toBeVisible();

    // Слишком короткий номер не проходит: либо кнопка выключена, либо после
    // клика показывается ошибка и код-поле не появляется.
    await phone.fill('+998');
    const send = page.getByRole('button').filter({ hasText: /код|отправ/i }).first();
    if (await send.isEnabled()) {
      await send.click();
      await expect(page.locator('#client-code')).toHaveCount(0);
    } else {
      await expect(send).toBeDisabled();
    }
  });
});

test.describe('/propan', () => {
  test('открывается и показывает точки из сида', async ({ page }) => {
    await page.goto('/ru/propan');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText('Чиланзар', { exact: false })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Юнусабад', { exact: false })).toBeVisible();
  });
});

test.describe('/account без сессии', () => {
  test('редиректит на client-login', async ({ page }) => {
    await page.goto('/ru/account');
    await page.waitForURL(/client-login/);
    expect(page.url()).toContain('/client-login');
  });
});
