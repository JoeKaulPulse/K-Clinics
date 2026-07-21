import { redirect } from 'next/navigation';
import { getSession, sessionCan } from '@/lib/auth';
import { WorkspaceClient } from '@/components/admin/WorkspaceClient';

// Dynamic so the per-request CSP nonce (middleware) is applied to this page's
// scripts. Route-segment config isn't honoured on a 'use client' page, so the
// page is a thin server wrapper around the client component. Every other /admin
// page is already dynamic; this was the lone static one, which broke under the
// strict /admin CSP because a per-request nonce can't be baked into cached HTML.
export const dynamic = 'force-dynamic';

// BLD-707: server-side permission gate — the middleware only proves a valid
// admin session; every other /admin page also checks the specific permission.
// Only settings.manage may open the workspace/integrations settings.
export default async function WorkspacePage() {
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) redirect('/admin');
  return <WorkspaceClient />;
}
