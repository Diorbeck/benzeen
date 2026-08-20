"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

// Кнопка ручной переотправки чека в Солик с инцидент-борда (Модуль 7 ТЗ v2).
// Результат показывается тут же: администратор должен понимать, ушёл чек или
// провайдер снова отказал, не перезагружая страницу вслепую.

type Props = {
  sessionId: string;
  labels: {
    retry: string;
    sending: string;
    sent: string;
    failed: string;
    skipped: string;
  };
};

export function ReceiptRetryButton({ sessionId, labels }: Props) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">(
    "idle",
  );

  const run = async () => {
    setState("sending");
    try {
      const res = await fetch("/api/admin/receipts/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = (await res.json().catch(() => ({}))) as { status?: string };
      const ok =
        res.ok && (data.status === "SENT" || data.status === "ALREADY_SENT");
      setState(ok ? "sent" : "failed");
      if (ok) router.refresh();
    } catch {
      setState("failed");
    }
  };

  if (state === "sent") {
    return (
      <span className="text-xs font-medium text-success-600 dark:text-success-500">
        {labels.sent}
      </span>
    );
  }

  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        onClick={run}
        disabled={state === "sending"}
        className="inline-flex items-center gap-1.5 rounded-control bg-primary-500 px-3 py-1.5 text-xs font-medium text-primary-950 transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        <RefreshCw
          className={
            state === "sending" ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"
          }
        />
        {state === "sending" ? labels.sending : labels.retry}
      </button>
      {state === "failed" && (
        <span className="text-xs font-medium text-warning-600">
          {labels.failed}
        </span>
      )}
    </span>
  );
}
