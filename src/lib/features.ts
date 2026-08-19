// Feature flags. Read from NEXT_PUBLIC_* env so the same value is available in
// the browser, server components, and edge middleware (inlined at build time).
//
// B2B is the legacy fleet product. During the B2C pivot it is turned OFF by
// default: an unset variable means the flag is false and every B2B surface
// (company cabinets, driver login, company registration/moderation, invoices)
// is hidden and redirected. The code is kept intact behind the flag so B2B can
// be re-enabled by setting NEXT_PUBLIC_FEATURE_B2B="true".
export const B2B_ENABLED = process.env.NEXT_PUBLIC_FEATURE_B2B === 'true';

// Заправка на стационарной АЗС (Модуль 3 ТЗ v2) в браузере выключена: сценарий у
// колонки — BLE-определение колонки, пуш «вы у колонки №X», работа при
// заблокированном экране — технически принадлежит мобильному приложению.
// Серверные API заправки остаются включёнными: с ними работает приложение.
// Флаг оставлен, чтобы включать веб-версию точечно на пилотной АЗС для отладки.
export const STATION_FUELING_WEB_ENABLED =
  process.env.NEXT_PUBLIC_FEATURE_STATION_FUELING_WEB === 'true';

// Модуль 3, уровень «камера» (распознавание номера). До согласования формы
// согласия по закону «О персональных данных» РУз (раздел 5 ТЗ) режим CAMERA
// недоступен владельцам АЗС: включает его только платформа.
export const CAMERA_IDENTIFICATION_ENABLED =
  process.env.NEXT_PUBLIC_FEATURE_CAMERA_IDENTIFICATION === 'true';
