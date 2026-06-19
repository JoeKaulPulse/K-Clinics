'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────
type Trigger = 'SCHEDULE' | 'ON_TASK_COMPLETED';
type Freq = 'DAILY' | 'WEEKLY' | 'MONTHLY';
type Priority = 'LOW' | 'NORMAL' | 'HIGH';
type AssignMode = 'FIXED' | 'ROUND_ROBIN' | 'ALL';

type Staff = { id: string; name: string };

type Automation = {
  id: string;
  ref: string | null;
  name: string;
  description: string | null;
  enabled: boolean;
  trigger: Trigger;
  freq: Freq;
  interval: number;
  daysOfWeek: number[];
  dayOfMonth: number | null;
  timeOfDay: string;
  startsOn: string | null;
  endsOn: string | null;
  matchText: string | null;
  titleTemplate: string;
  detailTemplate: string | null;
  priority: Priority;
  dueInDays: number | null;
  assignMode: AssignMode;
  assigneeIds: string[];
  summary: string;
  nextRunAt: string | null;
  lastRunAt: string | null;
  runCount: number;
};

type ListResponse = { ok: true; staff: Staff[]; automations: Automation[] } | { ok: false; error?: string };
type MutateResponse = { ok: true; id?: string; ref?: string; created?: number } | { ok: false; error?: string };

const ENDPOINT = '/api/admin/tasks/automations';
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ── Shared class strings ─────────────────────────────────────────────────────
const field =
  'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]';
const labelCls = 'mb-1 block text-xs font-medium uppercase tracking-[0.14em] text-[var(--color-stone)]';
const primaryBtn =
  'rounded-full bg-[var(--color-gold)] px-5 py-2 text-sm font-medium text-white hover:bg-[var(--color-gold-deep)] disabled:opacity-50';
const ghostBtn =
  'rounded-full px-4 py-2 text-sm text-[var(--color-stone)] hover:bg-[var(--color-bone)] disabled:opacity-50';

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatNextRun(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  // e.g. "Mon 22 Jun, 09:00"
  const date = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${date}, ${time}`;
}

async function mutate(payload: Record<string, unknown>): Promise<MutateResponse> {
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => ({}))) as MutateResponse;
    if (!res.ok && !('ok' in data)) return { ok: false, error: `Request failed (${res.status})` };
    return data;
  } catch {
    return { ok: false, error: 'Network error — please try again.' };
  }
}

// ── Form state ───────────────────────────────────────────────────────────────
type FormState = {
  name: string;
  description: string;
  trigger: Trigger;
  freq: Freq;
  interval: number;
  daysOfWeek: number[];
  dayOfMonth: number;
  timeOfDay: string;
  startsOn: string;
  endsOn: string;
  matchText: string;
  titleTemplate: string;
  detailTemplate: string;
  priority: Priority;
  dueInDays: string;
  assignMode: AssignMode;
  assigneeIds: string[];
};

function emptyForm(): FormState {
  return {
    name: '',
    description: '',
    trigger: 'SCHEDULE',
    freq: 'WEEKLY',
    interval: 1,
    daysOfWeek: [1],
    dayOfMonth: 1,
    timeOfDay: '09:00',
    startsOn: '',
    endsOn: '',
    matchText: '',
    titleTemplate: '',
    detailTemplate: '',
    priority: 'NORMAL',
    dueInDays: '',
    assignMode: 'FIXED',
    assigneeIds: [],
  };
}

function formFromAutomation(a: Automation): FormState {
  return {
    name: a.name,
    description: a.description ?? '',
    trigger: a.trigger,
    freq: a.freq,
    interval: a.interval || 1,
    daysOfWeek: [...a.daysOfWeek],
    dayOfMonth: a.dayOfMonth ?? 1,
    timeOfDay: a.timeOfDay || '09:00',
    startsOn: a.startsOn ? a.startsOn.slice(0, 10) : '',
    endsOn: a.endsOn ? a.endsOn.slice(0, 10) : '',
    matchText: a.matchText ?? '',
    titleTemplate: a.titleTemplate,
    detailTemplate: a.detailTemplate ?? '',
    priority: a.priority,
    dueInDays: a.dueInDays != null ? String(a.dueInDays) : '',
    assignMode: a.assignMode,
    assigneeIds: [...a.assigneeIds],
  };
}

/** Build the API payload from form state (shared by create + update). */
function toPayload(f: FormState): Record<string, unknown> {
  const isSchedule = f.trigger === 'SCHEDULE';
  const dueInDays = f.dueInDays.trim() === '' ? null : Number(f.dueInDays);
  return {
    name: f.name.trim(),
    description: f.description.trim() || null,
    trigger: f.trigger,
    freq: isSchedule ? f.freq : 'WEEKLY',
    interval: isSchedule ? Math.max(1, Math.round(f.interval || 1)) : 1,
    daysOfWeek: isSchedule && f.freq === 'WEEKLY' ? f.daysOfWeek : [],
    dayOfMonth: isSchedule && f.freq === 'MONTHLY' ? Math.min(28, Math.max(1, Math.round(f.dayOfMonth || 1))) : null,
    timeOfDay: f.timeOfDay || '09:00',
    startsOn: isSchedule && f.startsOn ? f.startsOn : null,
    endsOn: isSchedule && f.endsOn ? f.endsOn : null,
    matchText: !isSchedule ? f.matchText.trim() || null : null,
    titleTemplate: f.titleTemplate.trim(),
    detailTemplate: f.detailTemplate.trim() || null,
    priority: f.priority,
    dueInDays: dueInDays != null && Number.isFinite(dueInDays) ? dueInDays : null,
    assignMode: f.assignMode,
    assigneeIds: f.assigneeIds,
  };
}

// ── Manager (top-level) ──────────────────────────────────────────────────────
export function TaskAutomationsManager() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Editing state: null = closed, 'new' = create form, otherwise = id under edit.
  const [editing, setEditing] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const res = await fetch(ENDPOINT, { headers: { Accept: 'application/json' } });
      const data = (await res.json().catch(() => ({}))) as ListResponse;
      if (!data || !('ok' in data) || !data.ok) {
        setLoadError((data && 'error' in data && data.error) || 'Could not load automations.');
        return;
      }
      setStaff(data.staff || []);
      setAutomations(data.automations || []);
    } catch {
      setLoadError('Could not load automations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const staffById = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of staff) m.set(s.id, s.name);
    return m;
  }, [staff]);

  const closeForm = useCallback(() => {
    setEditing(null);
    setActionError('');
  }, []);

  const onSaved = useCallback(async () => {
    closeForm();
    await load();
  }, [closeForm, load]);

  // Card-level actions ────────────────────────────────────────────────────────
  const handleToggle = useCallback(
    async (a: Automation) => {
      setActionError('');
      const r = await mutate({ op: 'toggle', id: a.id, enabled: !a.enabled });
      if (!r.ok) {
        setActionError(r.error || 'Could not update this automation.');
        return;
      }
      await load();
    },
    [load],
  );

  const handleRunNow = useCallback(
    async (a: Automation) => {
      setActionError('');
      const r = await mutate({ op: 'runNow', id: a.id });
      if (!r.ok) {
        setActionError(r.error || 'Could not run this automation.');
        return;
      }
      await load();
    },
    [load],
  );

  const handleDelete = useCallback(
    async (a: Automation) => {
      if (!confirm(`Delete the automation "${a.name}"? This cannot be undone.`)) return;
      setActionError('');
      const r = await mutate({ op: 'delete', id: a.id });
      if (!r.ok) {
        setActionError(r.error || 'Could not delete this automation.');
        return;
      }
      if (editing === a.id) closeForm();
      await load();
    },
    [load, editing, closeForm],
  );

  if (loading) {
    return <p className="text-sm text-[var(--color-stone)]">Loading automations…</p>;
  }

  if (loadError) {
    return (
      <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
        <p className="text-sm text-[var(--color-ink-soft)]">{loadError}</p>
        <button onClick={() => void load()} className={`mt-3 ${ghostBtn}`}>
          Try again
        </button>
      </div>
    );
  }

  const editingAutomation = editing && editing !== 'new' ? automations.find((a) => a.id === editing) ?? null : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-[var(--color-stone)]">
          {automations.length === 1 ? '1 automation' : `${automations.length} automations`}
        </p>
        {editing === null && (
          <button onClick={() => { setActionError(''); setEditing('new'); }} className={primaryBtn}>
            + New automation
          </button>
        )}
      </div>

      {actionError && (
        <p className="rounded-[var(--radius-sm)] bg-[var(--color-blush)]/20 px-3 py-2 text-sm text-[var(--color-ink-soft)]">
          {actionError}
        </p>
      )}

      {/* New automation form */}
      {editing === 'new' && (
        <AutomationForm
          key="new"
          staff={staff}
          initial={emptyForm()}
          mode="create"
          onCancel={closeForm}
          onSaved={onSaved}
        />
      )}

      {/* Empty state */}
      {automations.length === 0 && editing === null && (
        <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-line)] bg-[var(--color-porcelain)] p-10 text-center">
          <h2 className="font-[family-name:var(--font-display)] text-2xl">No automations yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--color-stone)]">
            This is where you set up recurring work and repeat events for the team. Create one to have tasks appear
            automatically — on a schedule, or whenever another task is completed.
          </p>
          <button onClick={() => { setActionError(''); setEditing('new'); }} className={`mt-5 ${primaryBtn}`}>
            + New automation
          </button>
        </div>
      )}

      {/* Cards */}
      {automations.length > 0 && (
        <div className="space-y-4">
          {automations.map((a) =>
            editing === a.id && editingAutomation ? (
              <AutomationForm
                key={a.id}
                staff={staff}
                initial={formFromAutomation(editingAutomation)}
                mode="edit"
                automationId={a.id}
                onCancel={closeForm}
                onSaved={onSaved}
              />
            ) : (
              <AutomationCard
                key={a.id}
                automation={a}
                staffById={staffById}
                disabled={editing !== null}
                onToggle={() => void handleToggle(a)}
                onRunNow={() => void handleRunNow(a)}
                onEdit={() => { setActionError(''); setEditing(a.id); }}
                onDelete={() => void handleDelete(a)}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}

// ── Card ─────────────────────────────────────────────────────────────────────
function describeAssignment(a: Automation, staffById: Map<string, string>): string {
  const names = a.assigneeIds.map((id) => staffById.get(id)).filter((n): n is string => !!n);
  const count = a.assigneeIds.length;
  if (a.assignMode === 'FIXED') {
    return names[0] ? `to ${names[0]}` : 'unassigned';
  }
  if (a.assignMode === 'ROUND_ROBIN') {
    return `round-robin across ${count} ${count === 1 ? 'person' : 'people'}`;
  }
  return `to all ${count} ${count === 1 ? 'person' : 'people'}`;
}

function AutomationCard({
  automation: a,
  staffById,
  disabled,
  onToggle,
  onRunNow,
  onEdit,
  onDelete,
}: {
  automation: Automation;
  staffById: Map<string, string>;
  disabled: boolean;
  onToggle: () => void;
  onRunNow: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [busy, setBusy] = useState<null | 'toggle' | 'run'>(null);
  const next = formatNextRun(a.nextRunAt);

  const run = async (kind: 'toggle' | 'run', fn: () => void) => {
    setBusy(kind);
    try {
      await Promise.resolve(fn());
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className={`rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4 shadow-[var(--shadow-lift)] ${
        a.enabled ? '' : 'opacity-60'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {a.ref && (
              <span className="rounded bg-[var(--color-bone)] px-1.5 py-0.5 font-mono text-[0.7rem] text-[var(--color-stone)]">
                {a.ref}
              </span>
            )}
            <span className="text-base font-medium text-[var(--color-ink)]">{a.name}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[0.6rem] uppercase tracking-wide ${
                a.enabled
                  ? 'bg-[var(--color-jade)]/15 text-[var(--color-jade)]'
                  : 'bg-[var(--color-bone)] text-[var(--color-stone)]'
              }`}
            >
              {a.enabled ? 'Active' : 'Paused'}
            </span>
          </div>

          <p className="mt-1 text-sm text-[var(--color-stone)]">{a.summary}</p>

          <div className="mt-2 space-y-0.5 text-sm text-[var(--color-ink-soft)]">
            <p>
              <span className="text-[var(--color-stone)]">Creates: </span>
              {a.titleTemplate || '—'} <span className="text-[var(--color-stone)]">({describeAssignment(a, staffById)})</span>
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-[var(--color-stone)]">
              {a.trigger === 'SCHEDULE' && next && <span>Next: {next}</span>}
              {a.trigger === 'ON_TASK_COMPLETED' && (
                <span>Triggers when a completed task matches{a.matchText ? ` “${a.matchText}”` : ''}</span>
              )}
              <span>Fired {a.runCount} {a.runCount === 1 ? 'time' : 'times'}</span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <button
            type="button"
            role="switch"
            aria-checked={a.enabled}
            aria-label={a.enabled ? 'Pause automation' : 'Enable automation'}
            disabled={disabled || busy !== null}
            onClick={() => void run('toggle', onToggle)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
              a.enabled ? 'bg-[var(--color-gold)]' : 'bg-[var(--color-sand)]'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                a.enabled ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
          <button type="button" onClick={() => void run('run', onRunNow)} disabled={disabled || busy !== null} className={ghostBtn}>
            {busy === 'run' ? 'Running…' : 'Run now'}
          </button>
          <button type="button" onClick={onEdit} disabled={disabled} className={ghostBtn}>
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={disabled}
            className="rounded-full px-4 py-2 text-sm text-[var(--color-stone)] hover:bg-[var(--color-blush)]/20 hover:text-[var(--color-ink)] disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Form (create + edit) ─────────────────────────────────────────────────────
function AutomationForm({
  staff,
  initial,
  mode,
  automationId,
  onCancel,
  onSaved,
}: {
  staff: Staff[];
  initial: FormState;
  mode: 'create' | 'edit';
  automationId?: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleWeekday = (day: number) =>
    setForm((f) => ({
      ...f,
      daysOfWeek: f.daysOfWeek.includes(day)
        ? f.daysOfWeek.filter((d) => d !== day)
        : [...f.daysOfWeek, day].sort((a, b) => a - b),
    }));

  const toggleAssignee = (id: string) =>
    setForm((f) => ({
      ...f,
      assigneeIds: f.assigneeIds.includes(id)
        ? f.assigneeIds.filter((x) => x !== id)
        : [...f.assigneeIds, id],
    }));

  const submit = async () => {
    if (!form.name.trim()) {
      setError('Give the automation a name.');
      return;
    }
    if (!form.titleTemplate.trim()) {
      setError('Add a task title for what this automation creates.');
      return;
    }
    if (form.trigger === 'SCHEDULE' && form.freq === 'WEEKLY' && form.daysOfWeek.length === 0) {
      setError('Pick at least one day of the week.');
      return;
    }
    setBusy(true);
    setError('');
    const payload = toPayload(form);
    const r = await mutate(mode === 'create' ? { op: 'create', ...payload } : { op: 'update', id: automationId, ...payload });
    setBusy(false);
    if (!r.ok) {
      setError(r.error || 'Could not save this automation.');
      return;
    }
    onSaved();
  };

  const isSchedule = form.trigger === 'SCHEDULE';

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-6 shadow-[var(--shadow-lift)]">
      <h2 className="mb-5 font-[family-name:var(--font-display)] text-2xl">
        {mode === 'create' ? 'New automation' : 'Edit automation'}
      </h2>

      <div className="space-y-6">
        {/* Name + description */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Name</label>
            <input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Weekly stock check"
              className={field}
            />
          </div>
          <div>
            <label className={labelCls}>Description (optional)</label>
            <input
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="A short note about what this is for"
              className={field}
            />
          </div>
        </div>

        {/* Trigger choice */}
        <div>
          <label className={labelCls}>When should it run?</label>
          <div className="flex flex-wrap gap-2">
            {([
              ['SCHEDULE', 'Repeat on a schedule'],
              ['ON_TASK_COMPLETED', 'When a task is completed'],
            ] as const).map(([value, lbl]) => (
              <button
                key={value}
                type="button"
                onClick={() => set('trigger', value)}
                className={`rounded-full px-4 py-2 text-sm transition-colors ${
                  form.trigger === value
                    ? 'bg-[var(--color-ink)] text-[var(--color-porcelain)]'
                    : 'border border-[var(--color-line)] text-[var(--color-ink-soft)] hover:bg-[var(--color-bone)]'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {/* Schedule fields */}
        {isSchedule && (
          <div className="space-y-4 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className={labelCls}>How often</label>
                <select value={form.freq} onChange={(e) => set('freq', e.target.value as Freq)} className={field}>
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Every</label>
                <input
                  type="number"
                  min={1}
                  value={form.interval}
                  onChange={(e) => set('interval', Math.max(1, Number(e.target.value) || 1))}
                  className={field}
                />
              </div>
              <div>
                <label className={labelCls}>Time of day</label>
                <input type="time" value={form.timeOfDay} onChange={(e) => set('timeOfDay', e.target.value)} className={field} />
              </div>
            </div>

            {form.freq === 'WEEKLY' && (
              <div>
                <label className={labelCls}>On these days</label>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAYS.map((wd, i) => {
                    const on = form.daysOfWeek.includes(i);
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => toggleWeekday(i)}
                        className={`h-9 w-12 rounded-[var(--radius-sm)] text-sm transition-colors ${
                          on
                            ? 'bg-[var(--color-ink)] text-[var(--color-porcelain)]'
                            : 'border border-[var(--color-line)] text-[var(--color-ink-soft)] hover:bg-[var(--color-bone)]'
                        }`}
                      >
                        {wd}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {form.freq === 'MONTHLY' && (
              <div className="max-w-[12rem]">
                <label className={labelCls}>Day of the month</label>
                <input
                  type="number"
                  min={1}
                  max={28}
                  value={form.dayOfMonth}
                  onChange={(e) => set('dayOfMonth', Math.min(28, Math.max(1, Number(e.target.value) || 1)))}
                  className={field}
                />
                <p className="mt-1 text-xs text-[var(--color-stone)]">1–28, so it lands every month.</p>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Starts on (optional)</label>
                <input type="date" value={form.startsOn} onChange={(e) => set('startsOn', e.target.value)} className={field} />
              </div>
              <div>
                <label className={labelCls}>Ends on (optional)</label>
                <input type="date" value={form.endsOn} onChange={(e) => set('endsOn', e.target.value)} className={field} />
              </div>
            </div>
          </div>
        )}

        {/* Trigger-on-completed fields */}
        {!isSchedule && (
          <div className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4">
            <label className={labelCls}>When a completed task&apos;s title contains…</label>
            <input
              value={form.matchText}
              onChange={(e) => set('matchText', e.target.value)}
              placeholder="e.g. consultation"
              className={field}
            />
            <p className="mt-1 text-xs text-[var(--color-stone)]">Leave blank to fire for every completed task.</p>
          </div>
        )}

        {/* Task template */}
        <div className="space-y-4 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4">
          <h3 className="font-[family-name:var(--font-display)] text-lg">The task it creates</h3>
          <div>
            <label className={labelCls}>Task title</label>
            <input
              value={form.titleTemplate}
              onChange={(e) => set('titleTemplate', e.target.value)}
              placeholder="e.g. Stock check for {weekday}"
              className={field}
            />
            <p className="mt-1 text-xs text-[var(--color-stone)]">
              You can use <code className="font-mono">{'{date}'}</code>, <code className="font-mono">{'{weekday}'}</code> and{' '}
              <code className="font-mono">{'{day}'}</code> — they fill in automatically when the task is made.
            </p>
          </div>
          <div>
            <label className={labelCls}>Details (optional)</label>
            <textarea
              value={form.detailTemplate}
              onChange={(e) => set('detailTemplate', e.target.value)}
              rows={3}
              placeholder="Any notes to include on the task"
              className={field}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Priority</label>
              <select value={form.priority} onChange={(e) => set('priority', e.target.value as Priority)} className={field}>
                <option value="LOW">Low</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Due (optional)</label>
              <input
                type="number"
                min={0}
                value={form.dueInDays}
                onChange={(e) => set('dueInDays', e.target.value)}
                placeholder="N"
                className={field}
              />
              <p className="mt-1 text-xs text-[var(--color-stone)]">Due N days after it&apos;s created.</p>
            </div>
          </div>

          {/* Assignment */}
          <div>
            <label className={labelCls}>Who gets it</label>
            <select value={form.assignMode} onChange={(e) => set('assignMode', e.target.value as AssignMode)} className={field}>
              <option value="FIXED">A specific person</option>
              <option value="ROUND_ROBIN">Take turns</option>
              <option value="ALL">Everyone gets a copy</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>People</label>
            {staff.length === 0 ? (
              <p className="text-sm text-[var(--color-stone)]">No staff available to assign.</p>
            ) : (
              <div className="grid gap-1.5 sm:grid-cols-2">
                {staff.map((s) => {
                  const checked = form.assigneeIds.includes(s.id);
                  return (
                    <label
                      key={s.id}
                      className={`flex cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] border px-3 py-2 text-sm transition-colors ${
                        checked
                          ? 'border-[var(--color-gold)] bg-white'
                          : 'border-[var(--color-line)] bg-white hover:bg-[var(--color-bone)]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAssignee(s.id)}
                        className="h-4 w-4 accent-[var(--color-gold)]"
                      />
                      <span className="text-[var(--color-ink-soft)]">{s.name}</span>
                    </label>
                  );
                })}
              </div>
            )}
            {form.assignMode === 'FIXED' && (
              <p className="mt-1 text-xs text-[var(--color-stone)]">The first person you tick is the one it&apos;s assigned to.</p>
            )}
          </div>
        </div>

        {error && (
          <p className="rounded-[var(--radius-sm)] bg-[var(--color-blush)]/20 px-3 py-2 text-sm text-[var(--color-ink-soft)]">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button type="button" onClick={() => void submit()} disabled={busy} className={primaryBtn}>
            {busy ? 'Saving…' : mode === 'create' ? 'Create automation' : 'Save changes'}
          </button>
          <button type="button" onClick={onCancel} disabled={busy} className={ghostBtn}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
