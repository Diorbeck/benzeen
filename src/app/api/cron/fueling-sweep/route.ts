import { NextResponse } from 'next/server';
import { sweepStaleFuelingSessions } from '@/lib/fueling-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Разбор зависших заправок — Модуль 4 ТЗ v2, офлайн-режим.
//
// Формальная подстраховка по расписанию. Основной путь разбора — сами тики с
// колонки: каждый финальный пакет закрывает сессию сразу. Этот обход нужен для
// случая, когда контроллер замолчал совсем: без него замороженные деньги клиента
// остались бы висеть, а продукт обещает обратное. Раз в сутки на тарифе Vercel
// Hobby — минимум, который допускает платформа; на пилоте объекта частоту надо
// поднять до 5 минут, иначе резерв разморозится не через полчаса, а через сутки.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const result = await sweepStaleFuelingSessions();
  return NextResponse.json({ ok: true, ...result });
}
