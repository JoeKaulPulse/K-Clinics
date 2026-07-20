'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { ROLES, PERMISSIONS, PERMISSION_GROUPS, roleDefaults, type Role } from '@/lib/permissions';
import { useDialogBehaviours } from '@/components/ui/Dialog';

type Profile = { publicProfile: boolean; title: string; photoUrl: string; publicPhone: string; bio: string; credentials: string; yearsExperience: number | null; profileOrder: number; isClinician: boolean };
type Staff = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  active: boolean;
  permGrant: string[];
  permRevoke: string[];
  lastLoginAt: string | null;
  googleEmail?: string;
  googleLinked?: boolean;
  pendingGoogle?: boolean;
  profile?: Profile;
};

export function StaffManager({ staff, canManage, actorRole }: { staff: Staff[]; canManage: boolean; actorRole: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Staff | 'new' | null>(null);
  const [profileFor, setProfileFor] = useState<Staff | null>(null);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">Administration</p>
          <h1 className="font-[family-name:var(--font-display)] text-3xl">Staff &amp; access control</h1>
          <p className="mt-1 text-sm text-[var(--color-stone)]">Set roles and fine-tune exactly what each person can do.</p>
        </div>
        {canManage && (
          <button onClick={() => setEditing('new')} className="rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-sm font-medium text-[var(--color-porcelain)] hover:bg-[var(--color-espresso)]">
            + Add staff
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-line)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--color-bone)] text-xs uppercase tracking-[0.14em] text-[var(--color-stone)]">
            <tr>
              <th scope="col" className="px-5 py-3 font-medium">Name</th>
              <th scope="col" className="px-5 py-3 font-medium">Role</th>
              <th scope="col" className="px-5 py-3 font-medium">Custom access</th>
              <th scope="col" className="px-5 py-3 font-medium">Status</th>
              <th scope="col" className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-line)]">
            {staff.map((s) => {
              const custom = s.permGrant.length + s.permRevoke.length;
              return (
                <tr key={s.id} className="bg-[var(--color-porcelain)]">
                  <td className="px-5 py-3">
                    <p className="font-medium">{s.name || '—'}</p>
                    <p className="text-xs text-[var(--color-stone)]">{s.email}</p>
                  </td>
                  <td className="px-5 py-3">{ROLES.find((r) => r.value === s.role)?.label ?? s.role}</td>
                  <td className="px-5 py-3 text-[var(--color-stone)]">
                    {custom ? `${custom} override${custom > 1 ? 's' : ''}` : 'Role default'}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs ${s.active ? 'bg-[var(--color-gold)]/20 text-[var(--color-ink)]' : s.pendingGoogle ? 'bg-[var(--color-bone)] text-[var(--color-ink)]' : 'bg-[var(--color-blush)]/25 text-[var(--color-ink)]'}`}>
                      {s.active ? 'active' : s.pendingGoogle ? 'pending approval' : 'deactivated'}
                    </span>
                    {s.googleLinked && <span className="ml-1.5 rounded-full bg-[var(--color-bone)] px-2 py-0.5 text-[0.6rem] uppercase tracking-wide text-[var(--color-stone)]" title="Linked to a Google sign-in">Google</span>}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {canManage && (
                      <span className="inline-flex items-center gap-3">
                        <button onClick={() => setProfileFor(s)} className="text-sm font-medium text-[var(--color-stone)] hover:underline" title="Public team-page profile">
                          Profile{s.profile?.publicProfile ? ' ✓' : ''}
                        </button>
                        <button onClick={() => setEditing(s)} className="text-sm font-medium text-[var(--color-gold-deep)] hover:underline">
                          Edit
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {profileFor && (
          <ProfileEditor key={`p-${profileFor.id}`} staff={profileFor} onClose={() => setProfileFor(null)} onSaved={() => { setProfileFor(null); router.refresh(); }} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editing && (
          <Editor
            key={editing === 'new' ? 'new' : editing.id}
            staff={editing === 'new' ? null : editing}
            actorRole={actorRole}
            onClose={() => setEditing(null)}
            onSaved={() => { setEditing(null); router.refresh(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function Editor({ staff, actorRole, onClose, onSaved }: { staff: Staff | null; actorRole: string; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(staff?.name ?? '');
  const [email, setEmail] = useState(staff?.email ?? '');
  const [role, setRole] = useState<Role>((staff?.role as Role) ?? 'STAFF');
  const [password, setPassword] = useState('');
  const [active, setActive] = useState(staff?.active ?? true);
  const [googleEmail, setGoogleEmail] = useState(staff?.googleEmail ?? '');
  const [grant, setGrant] = useState<Set<string>>(new Set(staff?.permGrant ?? []));
  const [revoke, setRevoke] = useState<Set<string>>(new Set(staff?.permRevoke ?? []));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  // Modal behaviours (focus-in, Tab trap, Escape, focus restore) — shared Dialog primitive (BLD-849/BLD-803).
  const { panelRef, onKeyDown } = useDialogBehaviours(onClose);

  const defaults = useMemo(() => new Set(roleDefaults(role)), [role]);
  const isOwnerTarget = staff?.role === 'OWNER';

  // Effective state per permission: default ∪ grant − revoke.
  const stateOf = (key: string): 'on' | 'off' => {
    if (revoke.has(key)) return 'off';
    if (grant.has(key)) return 'on';
    return defaults.has(key) ? 'on' : 'off';
  };
  const toggle = (key: string) => {
    const isOn = stateOf(key) === 'on';
    const isDefault = defaults.has(key);
    const g = new Set(grant);
    const r = new Set(revoke);
    g.delete(key); r.delete(key);
    if (isOn) {
      // turn off
      if (isDefault) r.add(key);
    } else {
      // turn on
      if (!isDefault) g.add(key);
    }
    setGrant(g); setRevoke(r);
  };

  async function save() {
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: staff?.id,
          email: staff ? undefined : email,
          name,
          role,
          password: password || undefined,
          grant: [...grant],
          revoke: [...revoke],
          active,
          ...(staff ? { googleEmail } : {}),
        }),
      });
      const json = await res.json();
      if (json.ok) onSaved();
      else setError(json.error || 'Could not save.');
    } catch {
      setError('Network error.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onKeyDown={onKeyDown} className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6">
      <motion.div
        ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="staff-editor-title" tabIndex={-1}
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-[var(--radius-xl)] bg-[var(--color-porcelain)] p-6 shadow-[var(--shadow-lift)] sm:rounded-[var(--radius-xl)] md:p-8"
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <h2 id="staff-editor-title" className="font-[family-name:var(--font-display)] text-2xl">{staff ? 'Edit staff member' : 'Add staff member'}</h2>
          <button onClick={onClose} aria-label="Close" className="text-[var(--color-stone)] hover:text-[var(--color-ink)]"><span aria-hidden="true">✕</span></button>
        </div>

        {staff?.pendingGoogle && (
          <p className="mb-5 rounded-[var(--radius-sm)] border border-[var(--color-gold)]/40 bg-[var(--color-bone)] px-4 py-3 text-sm text-[var(--color-ink)]">
            This account was created from a Google sign-in and is waiting for approval. Set the role below and tick <strong>Account active</strong> to grant access.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name"><input className={field} value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Email"><input className={field} type="email" value={email} disabled={!!staff} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Role">
            <select className={field} value={role} onChange={(e) => setRole(e.target.value as Role)} disabled={isOwnerTarget && actorRole !== 'OWNER'}>
              {ROLES.filter((r) => r.value !== 'OWNER' || actorRole === 'OWNER').map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </Field>
          <Field label={staff ? 'Reset password (optional)' : 'Temporary password'}>
            <input className={field} type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={staff ? 'Leave blank to keep' : 'min 8 characters'} />
          </Field>
        </div>

        {staff && (
          <label className="mt-4 flex items-center gap-3 text-sm">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-[var(--color-gold)]" />
            Account active (uncheck to revoke all access)
          </label>
        )}

        {staff && (
          <div className="mt-4">
            <Field label="Google sign-in email (optional)">
              <input className={field} type="email" value={googleEmail} onChange={(e) => setGoogleEmail(e.target.value)} placeholder="name@kclinics.co.uk" />
            </Field>
            <p className="mt-1 text-xs text-[var(--color-stone)]">If this person signs in with Google using a different address than their login email above, enter it here to link the two so their account merges. Clear it to unlink Google sign-in.</p>
          </div>
        )}

        <div className="mt-7">
          <p className="eyebrow mb-1">Access control</p>
          <p className="mb-4 text-sm text-[var(--color-stone)]">
            Defaults come from the role; toggles below override them for this person.{' '}
            {role === 'OWNER' && <span className="text-[var(--color-gold-deep)]">Owners always have full access.</span>}
          </p>
          <div className="space-y-5">
            {PERMISSION_GROUPS.map((group) => (
              <div key={group}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-stone)]">{group}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {PERMISSIONS.filter((p) => p.group === group).map((p) => {
                    const on = role === 'OWNER' ? true : stateOf(p.key) === 'on';
                    const overridden = grant.has(p.key) || revoke.has(p.key);
                    return (
                      <button
                        key={p.key}
                        type="button"
                        disabled={role === 'OWNER'}
                        onClick={() => toggle(p.key)}
                        className={`flex items-start justify-between gap-3 rounded-[var(--radius-md)] border p-3 text-left transition-colors ${on ? 'border-[var(--color-gold)]/60 bg-[var(--color-bone)]' : 'border-[var(--color-line)]'} ${role === 'OWNER' ? 'opacity-70' : ''}`}
                      >
                        <span>
                          <span className="flex items-center gap-1.5 text-sm font-medium">
                            {p.label}
                            {p.sensitive && <span className="rounded bg-[var(--color-blush)]/30 px-1.5 py-0.5 text-[0.6rem] uppercase tracking-wide">sensitive</span>}
                            {overridden && <span className="text-[0.6rem] text-[var(--color-gold-deep)]">• custom</span>}
                          </span>
                          <span className="mt-0.5 block text-xs text-[var(--color-stone)]">{p.description}</span>
                        </span>
                        <span className={`mt-0.5 grid h-5 w-9 shrink-0 items-center rounded-full px-0.5 transition-colors ${on ? 'bg-[var(--color-gold)]' : 'bg-[var(--color-sand)]'}`}>
                          <span className={`h-4 w-4 rounded-full bg-white transition-transform ${on ? 'translate-x-4' : ''}`} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {error && <p role="alert" aria-live="assertive" className="mt-5 rounded-[var(--radius-sm)] bg-[var(--color-blush)]/25 px-4 py-2.5 text-sm">{error}</p>}
        <div className="mt-7 flex flex-wrap items-center justify-end gap-3">
          {staff && (
            <button
              type="button"
              onClick={async () => { if (confirm('Reset this member’s two-factor authentication? They’ll set it up again on next sign-in.')) { await fetch('/api/admin/staff', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'reset2fa', id: staff.id }) }); alert('2FA reset.'); } }}
              className="mr-auto text-sm text-[var(--color-blush-deep)] hover:underline"
            >
              Reset 2FA
            </button>
          )}
          <button onClick={onClose} className="px-4 py-2.5 text-sm text-[var(--color-stone)]">Cancel</button>
          <button onClick={save} disabled={saving} className="rounded-full bg-[var(--color-gold)] px-6 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-ink)] disabled:opacity-60">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

const field = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--color-gold)] disabled:opacity-60';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-[var(--color-stone)]">{label}</span>
      {children}
    </label>
  );
}

function ProfileEditor({ staff, onClose, onSaved }: { staff: Staff; onClose: () => void; onSaved: () => void }) {
  const p = staff.profile;
  const [f, setF] = useState({
    publicProfile: p?.publicProfile ?? false,
    title: p?.title ?? '',
    photoUrl: p?.photoUrl ?? '',
    publicPhone: p?.publicPhone ?? '',
    credentials: p?.credentials ?? '',
    yearsExperience: p?.yearsExperience != null ? String(p.yearsExperience) : '',
    profileOrder: p ? String(p.profileOrder) : '0',
    bio: p?.bio ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  // Modal behaviours (focus-in, Tab trap, Escape, focus restore) — shared Dialog primitive (BLD-849/BLD-803).
  const { panelRef, onKeyDown } = useDialogBehaviours(onClose);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const field = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]';

  async function save() {
    setBusy(true); setErr('');
    const res = await fetch('/api/admin/staff', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'profile', id: staff.id, ...f, yearsExperience: f.yearsExperience === '' ? '' : Number(f.yearsExperience), profileOrder: Number(f.profileOrder) }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) onSaved(); else setErr(j.error || 'Could not save.');
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onKeyDown={onKeyDown} className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6">
      <motion.div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="staff-profile-title" tabIndex={-1} initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-[var(--radius-lg)] bg-[var(--color-porcelain)] p-6 sm:rounded-[var(--radius-lg)]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 id="staff-profile-title" className="font-[family-name:var(--font-display)] text-xl">Public team profile</h2>
            <p className="text-sm text-[var(--color-stone)]">{staff.name || staff.email} · shows on the /team page{p?.isClinician ? ' (clinical)' : ' (support)'}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-[var(--color-stone)] hover:text-[var(--color-ink)]"><span aria-hidden="true">✕</span></button>
        </div>
        <label className="mb-4 flex items-center gap-3 text-sm">
          <input type="checkbox" checked={f.publicProfile} onChange={(e) => set('publicProfile', e.target.checked)} className="h-4 w-4 accent-[var(--color-gold)]" />
          Show this person on the public team page
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-[var(--color-stone)]">Job title<br /><input className={field} value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Aesthetic Doctor" /></label>
          <label className="text-xs text-[var(--color-stone)]">Years’ experience<br /><input className={field} value={f.yearsExperience} onChange={(e) => set('yearsExperience', e.target.value)} placeholder="10" /></label>
          <label className="text-xs text-[var(--color-stone)] sm:col-span-2">Headshot URL<br /><input className={field} value={f.photoUrl} onChange={(e) => set('photoUrl', e.target.value)} placeholder="https://…" /></label>
          <label className="text-xs text-[var(--color-stone)]">Public phone<br /><input className={field} value={f.publicPhone} onChange={(e) => set('publicPhone', e.target.value)} placeholder="+44 …" /></label>
          <label className="text-xs text-[var(--color-stone)]">Display order<br /><input className={field} value={f.profileOrder} onChange={(e) => set('profileOrder', e.target.value)} /></label>
          <label className="text-xs text-[var(--color-stone)] sm:col-span-2">Credentials<br /><input className={field} value={f.credentials} onChange={(e) => set('credentials', e.target.value)} placeholder="GMC reg. · Aesthetic Medicine" /></label>
          <label className="text-xs text-[var(--color-stone)] sm:col-span-2">Bio<br /><textarea rows={4} className={field} value={f.bio} onChange={(e) => set('bio', e.target.value)} /></label>
        </div>
        <p className="mt-3 text-xs text-[var(--color-stone)]">Services shown on the card come from this person’s competencies (set in Schedules), and the star rating is calculated from their published reviews.</p>
        {err && <p role="alert" aria-live="assertive" className="mt-3 text-sm text-[var(--color-blush-deep)]">{err}</p>}
        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2.5 text-sm text-[var(--color-stone)]">Cancel</button>
          <button onClick={save} disabled={busy} className="rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-sm text-[var(--color-porcelain)] disabled:opacity-60">{busy ? 'Saving…' : 'Save profile'}</button>
        </div>
      </motion.div>
    </motion.div>
  );
}
