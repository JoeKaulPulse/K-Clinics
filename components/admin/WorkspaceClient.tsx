'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { AdminShell } from '@/components/admin/AdminShell';
import { WorkspaceSeatAudit } from '@/components/admin/WorkspaceSeatAudit';

type WorkspaceUser = {
  email: string;
  name: string;
  suspended: boolean;
  isAdmin: boolean;
  lastLoginTime?: string;
  aliases?: string[];
};

type WorkspaceGroup = {
  email: string;
  name: string;
  description?: string;
  directMembersCount?: number;
};

type Tab = 'users' | 'groups';

export function WorkspaceClient() {
  const [tab, setTab] = useState<Tab>('users');
  const [users, setUsers] = useState<WorkspaceUser[]>([]);
  const [groups, setGroups] = useState<WorkspaceGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);

  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserFirst, setNewUserFirst] = useState('');
  const [newUserLast, setNewUserLast] = useState('');
  const [newUserPass, setNewUserPass] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [aliasTarget, setAliasTarget] = useState<string | null>(null);
  const [aliasValue, setAliasValue] = useState('');
  const [aliasError, setAliasError] = useState<string | null>(null);

  const [newGroupEmail, setNewGroupEmail] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [createGroupError, setCreateGroupError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch('/api/admin/integrations/google-workspace/users');
    const j = await res.json().catch(() => ({}));
    if (j.ok) {
      setUsers(j.users ?? []);
      setConfigured(true);
    } else {
      setError(j.error ?? 'Failed to load users.');
      if (j.configured === false) setConfigured(false);
    }
    setLoading(false);
  }, []);

  const loadGroups = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch('/api/admin/integrations/google-workspace/groups');
    const j = await res.json().catch(() => ({}));
    if (j.ok) {
      setGroups(j.groups ?? []);
      setConfigured(true);
    } else {
      setError(j.error ?? 'Failed to load groups.');
      if (j.configured === false) setConfigured(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (tab === 'users') loadUsers();
    else loadGroups();
  }, [tab, loadUsers, loadGroups]);

  async function suspendUser(email: string, suspend: boolean) {
    await fetch(`/api/admin/integrations/google-workspace/users/${encodeURIComponent(email)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suspended: suspend }),
    });
    await loadUsers();
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    const res = await fetch('/api/admin/integrations/google-workspace/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newUserEmail, firstName: newUserFirst, lastName: newUserLast, password: newUserPass }),
    });
    const j = await res.json().catch(() => ({}));
    if (j.ok) {
      setNewUserEmail(''); setNewUserFirst(''); setNewUserLast(''); setNewUserPass('');
      await loadUsers();
    } else {
      setCreateError(j.error ?? 'Could not create user.');
    }
    setCreating(false);
  }

  async function addAlias(email: string) {
    if (!aliasValue.trim()) return;
    setAliasError(null);
    const res = await fetch(`/api/admin/integrations/google-workspace/users/${encodeURIComponent(email)}/aliases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alias: aliasValue.trim() }),
    });
    const j = await res.json().catch(() => ({}));
    if (j.ok) { setAliasTarget(null); setAliasValue(''); await loadUsers(); }
    else setAliasError(j.error ?? 'Could not add alias.');
  }

  async function removeAlias(userEmail: string, alias: string) {
    await fetch(`/api/admin/integrations/google-workspace/users/${encodeURIComponent(userEmail)}/aliases`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alias }),
    });
    await loadUsers();
  }

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    setCreatingGroup(true);
    setCreateGroupError(null);
    const res = await fetch('/api/admin/integrations/google-workspace/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newGroupEmail, name: newGroupName, description: newGroupDesc || undefined }),
    });
    const j = await res.json().catch(() => ({}));
    if (j.ok) {
      setNewGroupEmail(''); setNewGroupName(''); setNewGroupDesc('');
      await loadGroups();
    } else {
      setCreateGroupError(j.error ?? 'Could not create group.');
    }
    setCreatingGroup(false);
  }

  const inputCls = 'border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm bg-[var(--color-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]';
  const btnCls = 'px-4 py-2 rounded-lg text-sm font-medium transition-colors';

  return (
    <AdminShell>
      <div className="max-w-5xl mx-auto py-6 px-4 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Google Workspace</h1>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            Manage @kclinics.co.uk mailboxes, aliases and shared inboxes via the Directory API.
          </p>
        </div>

        <WorkspaceSeatAudit />

        {configured === false && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <strong>Not configured.</strong> Set <code>GOOGLE_WORKSPACE_SA_KEY</code> and{' '}
            <code>GOOGLE_WORKSPACE_ADMIN_EMAIL</code> in{' '}
            <Link href="/admin/settings/credentials" className="underline">Admin &gt; Credentials</Link>.
            See <a href="/docs/GOOGLE_WORKSPACE_MIGRATION.md" className="underline">the setup guide</a> (§10.1) for the service account steps.
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-[var(--color-border)]">
          {(['users', 'groups'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t ? 'border-[var(--color-gold)] text-[var(--color-ink)]' : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)]'}`}
            >
              {t === 'users' ? 'Users' : 'Groups & shared inboxes'}
            </button>
          ))}
        </div>

        {loading && <p className="text-sm text-[var(--color-muted)]">Loading…</p>}
        {error && !loading && <p className="text-sm text-red-600">{error}</p>}

        {/* Users tab */}
        {tab === 'users' && !loading && !error && (
          <div className="space-y-6">
            {/* Create user form */}
            <details className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
              <summary className="px-4 py-3 text-sm font-medium cursor-pointer">Create new Workspace user</summary>
              <form onSubmit={handleCreateUser} className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input className={inputCls} placeholder="First name" aria-label="First name" value={newUserFirst} onChange={(e) => setNewUserFirst(e.target.value)} required />
                  <input className={inputCls} placeholder="Last name" aria-label="Last name" value={newUserLast} onChange={(e) => setNewUserLast(e.target.value)} required />
                </div>
                <input className={`${inputCls} w-full`} type="email" placeholder="user@kclinics.co.uk" aria-label="Email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} required />
                <input className={`${inputCls} w-full`} type="password" placeholder="Temporary password" aria-label="Temporary password" value={newUserPass} onChange={(e) => setNewUserPass(e.target.value)} required minLength={8} />
                {createError && <p className="text-xs text-red-600">{createError}</p>}
                <button type="submit" disabled={creating} className={`${btnCls} bg-[var(--color-ink)] text-[var(--color-parchment)] disabled:opacity-50`}>
                  {creating ? 'Creating…' : 'Create user'}
                </button>
              </form>
            </details>

            {/* User list */}
            <div className="rounded-lg border border-[var(--color-border)] overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-surface-alt,#f9f5f0)] text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Last login</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {users.map((u) => (
                    <tr key={u.email} className="hover:bg-[var(--color-surface-alt,#faf8f5)]">
                      <td className="px-4 py-3">
                        <div>{u.email}</div>
                        {u.aliases && u.aliases.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {u.aliases.map((a) => (
                              <span key={a} className="inline-flex items-center gap-1 text-xs bg-[var(--color-surface-alt,#f3ece4)] rounded px-1.5 py-0.5">
                                {a}
                                <button
                                  type="button"
                                  onClick={() => removeAlias(u.email, a)}
                                  className="text-[var(--color-muted)] hover:text-red-500 leading-none"
                                  aria-label={`Remove alias ${a}`}
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                        {aliasTarget === u.email ? (
                          <div className="mt-2 flex gap-2">
                            <input
                              className={inputCls}
                              placeholder="alias@kclinics.co.uk"
              aria-label="Email alias"
                              value={aliasValue}
                              onChange={(e) => setAliasValue(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAlias(u.email); } }}
                            />
                            <button type="button" onClick={() => addAlias(u.email)} className={`${btnCls} bg-[var(--color-gold-deep)] text-white text-xs`}>Add</button>
                            <button type="button" onClick={() => setAliasTarget(null)} className={`${btnCls} border border-[var(--color-border)] text-xs`}>Cancel</button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => { setAliasTarget(u.email); setAliasValue(''); setAliasError(null); }} className="mt-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-ink)] underline underline-offset-2">
                            + alias
                          </button>
                        )}
                        {aliasTarget === u.email && aliasError && <p className="text-xs text-red-600 mt-1">{aliasError}</p>}
                      </td>
                      <td className="px-4 py-3">
                        {u.name}
                        {u.isAdmin && <span className="ml-1 text-xs text-amber-600 font-medium">(admin)</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${u.suspended ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {u.suspended ? 'Suspended' : 'Active'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">
                        {u.lastLoginTime ? new Date(u.lastLoginTime).toLocaleDateString('en-GB') : 'Never'}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => suspendUser(u.email, !u.suspended)}
                          className={`${btnCls} text-xs border border-[var(--color-border)] hover:bg-[var(--color-surface-alt,#f3ece4)]`}
                        >
                          {u.suspended ? 'Restore' : 'Suspend'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-6 text-center text-[var(--color-muted)] text-sm">No users found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Groups tab */}
        {tab === 'groups' && !loading && !error && (
          <div className="space-y-6">
            <details className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
              <summary className="px-4 py-3 text-sm font-medium cursor-pointer">Create new group / shared inbox</summary>
              <form onSubmit={handleCreateGroup} className="p-4 space-y-3">
                <input className={`${inputCls} w-full`} type="email" placeholder="support@kclinics.co.uk" aria-label="Group email" value={newGroupEmail} onChange={(e) => setNewGroupEmail(e.target.value)} required />
                <input className={`${inputCls} w-full`} placeholder="Display name (e.g. Front desk)" aria-label="Display name" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} required />
                <input className={`${inputCls} w-full`} placeholder="Description (optional)" aria-label="Description" value={newGroupDesc} onChange={(e) => setNewGroupDesc(e.target.value)} />
                {createGroupError && <p className="text-xs text-red-600">{createGroupError}</p>}
                <button type="submit" disabled={creatingGroup} className={`${btnCls} bg-[var(--color-ink)] text-[var(--color-parchment)] disabled:opacity-50`}>
                  {creatingGroup ? 'Creating…' : 'Create group'}
                </button>
              </form>
            </details>

            <div className="rounded-lg border border-[var(--color-border)] overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-surface-alt,#f9f5f0)] text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium">Address</th>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Description</th>
                    <th className="px-4 py-3 font-medium">Members</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {groups.map((g) => (
                    <tr key={g.email} className="hover:bg-[var(--color-surface-alt,#faf8f5)]">
                      <td className="px-4 py-3 font-mono text-xs">{g.email}</td>
                      <td className="px-4 py-3">{g.name}</td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">{g.description ?? '—'}</td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">{g.directMembersCount ?? '—'}</td>
                    </tr>
                  ))}
                  {groups.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-6 text-center text-[var(--color-muted)] text-sm">No groups found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
