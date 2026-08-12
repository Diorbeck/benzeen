import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildSystemPrompt,
  ESCALATE_MARKER,
  getSupportAi,
  parseAiText,
  shouldAutoReply,
} from './support-ai';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('shouldAutoReply (гейт ИИ)', () => {
  it('жалоба (COMPLAINT) НИКОГДА не попадает к ИИ', () => {
    expect(shouldAutoReply({ type: 'COMPLAINT', status: 'OPEN', needsHuman: false })).toBe(false);
  });

  it('после эскалации ИИ молчит', () => {
    expect(shouldAutoReply({ type: 'QUESTION', status: 'OPEN', needsHuman: true })).toBe(false);
  });

  it('в закрытом диалоге (включая legacy RESOLVED) ответов нет', () => {
    expect(shouldAutoReply({ type: 'QUESTION', status: 'CLOSED', needsHuman: false })).toBe(false);
    expect(shouldAutoReply({ type: 'QUESTION', status: 'RESOLVED', needsHuman: false })).toBe(false);
  });

  it('открытый вопрос/предложение — отвечает', () => {
    expect(shouldAutoReply({ type: 'QUESTION', status: 'OPEN', needsHuman: false })).toBe(true);
    expect(shouldAutoReply({ type: 'SUGGESTION', status: 'ANSWERED', needsHuman: false })).toBe(true);
  });
});

describe('parseAiText', () => {
  it('маркер эскалации → escalate', () => {
    expect(parseAiText(ESCALATE_MARKER)).toEqual({ kind: 'escalate' });
    expect(parseAiText(`Хм. ${ESCALATE_MARKER}`)).toEqual({ kind: 'escalate' });
  });

  it('пустой ответ → escalate (безопасный дефолт)', () => {
    expect(parseAiText('   ')).toEqual({ kind: 'escalate' });
  });

  it('обычный текст → reply с тримом', () => {
    expect(parseAiText('  Минимальный заказ — 30 литров.  ')).toEqual({
      kind: 'reply',
      text: 'Минимальный заказ — 30 литров.',
    });
  });
});

describe('buildSystemPrompt', () => {
  it('содержит жёсткие запреты, маркер эскалации и FAQ', () => {
    const p = buildSystemPrompt('FAQ-CONTENT');
    expect(p).toContain('НЕ обещай компенсаций');
    expect(p).toContain('НЕ меняй, не отменяй');
    expect(p).toContain('НЕ выдумывай цены');
    expect(p).toContain('НЕ раскрывай внутреннее устройство');
    expect(p).toContain(ESCALATE_MARKER);
    expect(p).toContain('FAQ-CONTENT');
    expect(p).toContain('на языке клиента');
  });
});

describe('getSupportAi (env-гейт)', () => {
  it('без ANTHROPIC_API_KEY фича тихо выключена', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    const ai = getSupportAi();
    await expect(
      ai.decide([{ authorType: 'CLIENT', text: 'Привет' }]),
    ).resolves.toEqual({ kind: 'disabled' });
  });
});
