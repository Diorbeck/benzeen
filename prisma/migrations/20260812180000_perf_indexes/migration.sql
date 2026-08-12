-- PR-C: индексы под горячие выборки. Аддитивно + идемпотентно.
-- Order(status, assignedToId) и PropaneBooking(pointId, slotStart[, status])
-- уже существуют с прошлых миграций — не дублируем.

-- История заказов клиента (кабинет, админ-карточка, lastOrder-префилл):
-- WHERE clientId = ? ORDER BY createdAt DESC.
CREATE INDEX IF NOT EXISTS "Order_clientId_createdAt_idx"
  ON "Order"("clientId", "createdAt");

-- Диспатч: курьеры со свежей локацией (WHERE updatedAt >= now()-'15 min').
CREATE INDEX IF NOT EXISTS "CourierLocation_updatedAt_idx"
  ON "CourierLocation"("updatedAt");

-- Бонусный баланс: агрегация строк пользователя в статусе POSTED на каждом
-- открытии /benzin и кабинета (WHERE userId = ? AND status = 'POSTED').
CREATE INDEX IF NOT EXISTS "BonusLedger_userId_status_idx"
  ON "BonusLedger"("userId", "status");
