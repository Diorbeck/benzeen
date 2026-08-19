import { describe, expect, it } from "vitest";
import {
  BILLING_DAYS_PER_MONTH,
  generateControllerKey,
  onboardingDailyCostUzs,
  onboardingMonthlyEstimateUzs,
  parseOnboardingInput,
} from "./station-onboarding";

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    name: "АЗС Юнусабад-2",
    address: "Ташкент, ул. Амира Темура, 120",
    lat: 41.32,
    lng: 69.28,
    tanks: [
      { label: "Р-1", fuelType: "AI_92", capacityL: 20000, minLevelL: 2000 },
    ],
    dispensers: [{ number: 1, fuelTypes: ["AI_92"], billed: true }],
    ...overrides,
  };
}

function codes(raw: unknown): string[] {
  const result = parseOnboardingInput(raw);
  return result.ok ? [] : result.errors.map((e) => e.code);
}

describe("подключение АЗС: проверка формы", () => {
  it("принимает заполненную форму", () => {
    const result = parseOnboardingInput(validBody());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.tanks).toHaveLength(1);
    expect(result.value.dispensers[0].billed).toBe(true);
    expect(result.value.tin).toBeNull();
  });

  it("требует хотя бы один резервуар: датчик — ядро продукта", () => {
    expect(codes(validBody({ tanks: [] }))).toContain("tanksRequired");
  });

  it("колонки необязательны", () => {
    const result = parseOnboardingInput(validBody({ dispensers: [] }));
    expect(result.ok).toBe(true);
  });

  it("отбивает координаты вне Узбекистана", () => {
    expect(codes(validBody({ lat: 55.7, lng: 37.6 }))).toEqual(
      expect.arrayContaining(["lat", "lng"]),
    );
  });

  it("читает координаты с запятой из формы", () => {
    const result = parseOnboardingInput(
      validBody({ lat: "41,32", lng: "69,28" }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.lat).toBeCloseTo(41.32);
  });

  it("проверяет ИНН из девяти цифр, но разрешает пустой", () => {
    expect(codes(validBody({ tin: "12345" }))).toContain("tin");
    expect(parseOnboardingInput(validBody({ tin: "301234567" })).ok).toBe(true);
    expect(parseOnboardingInput(validBody({ tin: "" })).ok).toBe(true);
  });

  it("не принимает объём резервуара вне разумных границ", () => {
    expect(
      codes(
        validBody({
          tanks: [{ label: "Р-1", fuelType: "AI_92", capacityL: 10 }],
        }),
      ),
    ).toContain("capacity");
  });

  it("не даёт поставить критический порог выше объёма", () => {
    expect(
      codes(
        validBody({
          tanks: [
            {
              label: "Р-1",
              fuelType: "AI_92",
              capacityL: 20000,
              minLevelL: 25000,
            },
          ],
        }),
      ),
    ).toContain("minLevel");
  });

  it("не принимает неизвестный вид топлива и пропан", () => {
    expect(
      codes(
        validBody({
          tanks: [{ label: "Р-1", fuelType: "PROPANE", capacityL: 20000 }],
        }),
      ),
    ).toContain("fuelType");
  });

  it("ловит два резервуара с одним серийником датчика", () => {
    expect(
      codes(
        validBody({
          tanks: [
            {
              label: "Р-1",
              fuelType: "AI_92",
              capacityL: 20000,
              sensorSerial: "S-1",
            },
            {
              label: "Р-2",
              fuelType: "AI_95",
              capacityL: 20000,
              sensorSerial: "S-1",
            },
          ],
        }),
      ),
    ).toContain("sensorDuplicate");
  });

  it("ловит две колонки с одним номером", () => {
    expect(
      codes(
        validBody({
          dispensers: [
            { number: 3, fuelTypes: ["AI_92"] },
            { number: 3, fuelTypes: ["AI_95"] },
          ],
        }),
      ),
    ).toContain("numberDuplicate");
  });

  it("требует у колонки хотя бы один вид топлива", () => {
    expect(
      codes(validBody({ dispensers: [{ number: 1, fuelTypes: [] }] })),
    ).toContain("fuelTypes");
  });

  it("возвращает все ошибки сразу, а не первую", () => {
    const result = parseOnboardingInput({
      name: "А",
      address: "ул",
      tanks: [],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.length).toBeGreaterThanOrEqual(4);
  });
});

describe("подключение АЗС: тариф и ключ", () => {
  it("считает сутки: резервуары по 25 000, платные колонки по 10 000", () => {
    const daily = onboardingDailyCostUzs({
      tanks: [{}, {}, {}],
      dispensers: [{ billed: true }, { billed: false }],
    });
    expect(daily).toBe(3 * 25_000 + 10_000);
  });

  it("оценка за месяц — суточная ставка на 30 дней", () => {
    const input = { tanks: [{}], dispensers: [] };
    expect(onboardingMonthlyEstimateUzs(input)).toBe(
      25_000 * BILLING_DAYS_PER_MONTH,
    );
  });

  it("ключ контроллера с префиксом и каждый раз новый", () => {
    const a = generateControllerKey();
    const b = generateControllerKey();
    expect(a).toMatch(/^bz_ctrl_[0-9a-f]{32}$/);
    expect(a).not.toBe(b);
  });
});
