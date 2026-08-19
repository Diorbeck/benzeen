import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/admin-auth";
import { writeAuditLog } from "@/lib/audit";
import { pushSoliqReceipt } from "@/lib/fueling-service";
import { MAX_SOLIQ_ATTEMPTS } from "@/lib/soliq-retry";

// Модуль 7 ТЗ v2, инцидент-борд: ручная переотправка чека в Солик.
//
// Автоматика сдаётся после MAX_SOLIQ_ATTEMPTS попыток — дальше нужен человек,
// который разобрался с причиной (не заполнен ИНН объекта, отказ провайдера,
// сломанный состав чека) и решил, что повтор теперь имеет смысл. Кнопка
// обнуляет счётчик попыток и делает одну попытку немедленно; результат
// возвращается вызывающему, чтобы борд не пришлось перезагружать вслепую.

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const guard = await requireSuperAdmin();
  if ("error" in guard) {
    return Response.json({ error: guard.error }, { status: guard.status });
  }

  const body = (await req.json().catch(() => ({}))) as { sessionId?: unknown };
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  if (!sessionId)
    return Response.json({ error: "sessionId обязателен" }, { status: 400 });

  const session = await prisma.fuelingSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      status: true,
      soliqSyncedAt: true,
      soliqAttempts: true,
      stationId: true,
    },
  });
  if (!session)
    return Response.json({ error: "Заправка не найдена" }, { status: 404 });
  if (session.soliqSyncedAt) return Response.json({ status: "ALREADY_SENT" });

  // Обнуляем счётчик и выдержку: иначе очередь снова сочтёт чек застрявшим.
  await prisma.fuelingSession.update({
    where: { id: session.id },
    data: { soliqAttempts: 0, soliqLastAttemptAt: null },
  });

  const result = await pushSoliqReceipt(session.id);

  await writeAuditLog({
    action: "SOLIQ_RECEIPT_RETRY",
    targetType: "FuelingSession",
    targetId: session.id,
    actorId: guard.actorId,
    actorEmail: guard.actorEmail,
    metadata: {
      stationId: session.stationId,
      attemptsBefore: session.soliqAttempts,
      maxAttempts: MAX_SOLIQ_ATTEMPTS,
      result: result.status,
    },
  });

  return Response.json({
    status: result.status,
    fiscalId: result.fiscalId ?? null,
  });
}
