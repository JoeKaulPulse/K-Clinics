// Feature flag. The CRM (DB + email + admin) only runs where a server and
// database exist (Vercel). On the static GitHub Pages demo it is disabled and
// forms fall back to mailto. Controlled by NEXT_PUBLIC_CRM_ENABLED.
export const crmEnabled =
  process.env.NEXT_PUBLIC_CRM_ENABLED === 'true' || process.env.CRM_ENABLED === 'true';
