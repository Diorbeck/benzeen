"use client";

import { useEffect, useState } from "react";
import { B2CLanding } from "./landing";
import { MobileHome, type HomeClient } from "./mobile-home";

// Один URL — два главных экрана: на телефоне человек попадает в приложение
// (плитки действий, карта, таббар), на десктопе остаётся витринный лендинг.
// Ветвление по ширине окна на клиенте: рендерить оба сразу нельзя — карта
// MapLibre смонтировалась бы дважды.
export function HomeSwitch({
  locale,
  client,
}: {
  locale: string;
  client: HomeClient | null;
}) {
  const [desktop, setDesktop] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => setDesktop(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Один кадр до определения ширины — пустой холст в цвет фона, без прыжков.
  if (desktop === null) {
    return <div className="min-h-[100dvh] bg-canvas dark:bg-navy-950" />;
  }
  return desktop ? <B2CLanding /> : <MobileHome locale={locale} client={client} />;
}
