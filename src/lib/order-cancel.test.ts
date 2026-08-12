import { describe, expect, it } from 'vitest';
import { clientCancelVerdict, validateCancelInput } from './order-cancel';

describe('clientCancelVerdict', () => {
  it('RECEIVED и SCHEDULED можно отменить', () => {
    expect(clientCancelVerdict('RECEIVED')).toBe('ok');
    expect(clientCancelVerdict('SCHEDULED')).toBe('ok');
  });

  it('курьер в пути — отдельный вердикт для UI с телефоном поддержки', () => {
    expect(clientCancelVerdict('COURIER_ASSIGNED')).toBe('courier_on_way');
    expect(clientCancelVerdict('IN_DELIVERY')).toBe('courier_on_way');
  });

  it('терминальные и прочие статусы не отменяются', () => {
    for (const s of ['DELIVERED', 'CANCELLED', 'REJECTED', 'CLOSED', 'CREATED']) {
      expect(clientCancelVerdict(s)).toBe('not_cancellable');
    }
  });
});

describe('validateCancelInput', () => {
  it('валидная причина без комментария', () => {
    expect(validateCancelInput('CHANGED_MIND', undefined)).toEqual({
      ok: true,
      reason: 'CHANGED_MIND',
      comment: null,
    });
  });

  it('OTHER требует комментарий', () => {
    expect(validateCancelInput('OTHER', '')).toEqual({ ok: false });
    expect(validateCancelInput('OTHER', '  ')).toEqual({ ok: false });
    expect(validateCancelInput('OTHER', 'нашёл дешевле')).toEqual({
      ok: true,
      reason: 'OTHER',
      comment: 'нашёл дешевле',
    });
  });

  it('комментарий обрезается до 200 символов, мусорная причина отклоняется', () => {
    const long = 'а'.repeat(300);
    const res = validateCancelInput('PRICE', long);
    expect(res.ok && res.comment?.length).toBe(200);
    expect(validateCancelInput('HACK', 'x')).toEqual({ ok: false });
  });
});
