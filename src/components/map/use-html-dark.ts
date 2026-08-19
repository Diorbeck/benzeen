'use client';

import { useEffect, useState } from 'react';

/**
 * Следит за классом `dark` на <html> — источник правды о текущей теме.
 *
 * Тему читаем прямо с <html>, а не через resolvedTheme: next-themes ставит
 * класс до первой отрисовки, а состояние хука на клиенте может отстать на кадр —
 * карта не должна мигать светлой подложкой в тёмном интерфейсе.
 */
export function useHtmlDark(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setDark(root.classList.contains('dark'));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return dark;
}
