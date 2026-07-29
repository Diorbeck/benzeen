// Feature flags. Read from NEXT_PUBLIC_* env so the same value is available in
// the browser, server components, and edge middleware (inlined at build time).
//
// B2B is the legacy fleet product. During the B2C pivot it is turned OFF by
// default: an unset variable means the flag is false and every B2B surface
// (company cabinets, driver login, company registration/moderation, invoices)
// is hidden and redirected. The code is kept intact behind the flag so B2B can
// be re-enabled by setting NEXT_PUBLIC_FEATURE_B2B="true".
export const B2B_ENABLED = process.env.NEXT_PUBLIC_FEATURE_B2B === 'true';
