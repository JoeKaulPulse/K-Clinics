import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { StudentActions } from '@/components/admin/StudentActions';
import { EnrolInCourse } from '@/components/admin/EnrolInCourse';
import { BadgeIcon } from '@/components/academy/BadgeIcon';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

const money = (p: number) => (p > 0 ? `£${(p / 100).toLocaleString('en-GB')}` : '£0');
const fmt = (d: Date | null) => (d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const fmtDT = (d: Date | null) => (d ? d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const STATE_BADGE: Record<string, string> = { PAID: 'bg-emerald-100 text-emerald-800', SCHEDULED: 'bg-[var(--color-line)] text-[var(--color-stone)]', PENDING: 'bg-amber-100 text-amber-800', FAILED: 'bg-red-100 text-red-800', REFUNDED: 'bg-[var(--color-line)] text-[var(--color-stone)]', CANCELLED: 'bg-[var(--color-line)] text-[var(--color-stone)]' };
const HW_LABEL: Record<string, string> = { SUBMITTED: 'Submitted', REVIEWED: 'Reviewed', APPROVED: 'Approved', NEEDS_REVISION: 'Needs revision' };

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
      <div className="mb-3 flex items-center justify-between gap-2"><h2 className="font-[family-name:var(--font-display)] text-lg">{title}</h2>{action}</div>
      {children}
    </section>
  );
}

export default async function AdminAcademyStudentPage({ params }: { params: Promise<{ id: string }> }) {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) redirect('/admin');
  const { id } = await params;

  const { db } = await import('@/lib/db');
  const student = await db.academyStudent.findUnique({ where: { id } });
  if (!student) notFound();
  // BLD-528: linked clinic CRM client (same person), if any.
  const client = student.clientId ? await db.client.findUnique({ where: { id: student.clientId }, select: { id: true, firstName: true, lastName: true } }) : null;

  const [enrolments, payments, lessonRows, quizRows, practiceRows, homeworkRows, badgeRows, passkeys, timeAgg, standing, allCourses] = await Promise.all([
    db.enrolment.findMany({ where: { studentId: id }, orderBy: { createdAt: 'desc' }, include: { course: { select: { id: true, title: true, slug: true } }, cohort: { select: { startAt: true, name: true } } } }),
    db.enrolmentPayment.findMany({ where: { enrolment: { studentId: id } }, orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }] }),
    db.lessonProgress.findMany({ where: { studentId: id }, orderBy: { completedAt: 'desc' }, take: 60, include: { lesson: { select: { title: true, module: { select: { course: { select: { title: true } } } } } } } }),
    db.quizAttempt.findMany({ where: { studentId: id }, orderBy: { createdAt: 'desc' }, take: 60, include: { quiz: { select: { title: true } } } }),
    db.practiceAttempt.findMany({ where: { studentId: id }, orderBy: { createdAt: 'desc' }, take: 40 }),
    db.homeworkSubmission.findMany({ where: { studentId: id }, orderBy: { updatedAt: 'desc' }, take: 40, include: { lesson: { select: { title: true } } } }),
    db.studentBadge.findMany({ where: { studentId: id }, orderBy: { awardedAt: 'desc' } }),
    db.studentPasskey.findMany({ where: { studentId: id }, orderBy: { createdAt: 'desc' } }),
    db.lessonProgress.aggregate({ where: { studentId: id }, _sum: { secondsSpent: true } }),
    (await import('@/lib/academy-gamification')).studentStanding(id).catch(() => null),
    db.course.findMany({ where: { active: true }, orderBy: { order: 'asc' }, select: { id: true, title: true, level: true } }),
  ]);

  // Courses this student can still be enrolled on (active, not already enrolled
  // unless their only enrolment there was cancelled) — matches the duplicate
  // guard in enrolStudentManually so the dropdown never offers a course that fails.
  const liveCourseIds = new Set(enrolments.filter((e) => e.status !== 'CANCELLED').map((e) => e.course.id));
  const enrolCandidates = allCourses.filter((c) => !liveCourseIds.has(c.id));

  const { academyLevel } = await import('@/lib/academy-levels');
  const { BADGES } = await import('@/lib/academy-gamification');
  const badgeByKey = new Map(BADGES.map((b) => [b.key, b]));
  const lvl = academyLevel(student.xp);
  const totalMin = Math.round((timeAgg._sum.secondsSpent ?? 0) / 60);
  const paymentsByEnrol = new Map<string, typeof payments>();
  for (const p of payments) { const a = paymentsByEnrol.get(p.enrolmentId) ?? []; a.push(p); paymentsByEnrol.set(p.enrolmentId, a); }
  const quizzesPassed = new Set(quizRows.filter((q) => q.passed).map((q) => q.quizId)).size;
  const age = student.dob ? Math.floor((Date.now() - +student.dob) / 31557600000) : null;

  const can = await sessionPermissions();
  const locale = await getLocale();

  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <Link href="/admin/academy/students" className="text-sm text-[var(--color-stone)] hover:text-[var(--color-ink)]">← Trainees</Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl">{student.firstName} {student.lastName ?? ''}{!student.portalActive && <span className="ml-2 align-middle rounded-full bg-[var(--color-blush)]/15 px-2 py-0.5 text-xs text-[var(--color-blush-deep)]">Suspended</span>}</h1>
          <p className="mt-1 text-sm text-[var(--color-stone)]">{student.email}{student.phone ? ` · ${student.phone}` : ''}</p>
          <p className="mt-1 text-xs text-[var(--color-stone)]">Clinic client: {client ? <Link href={`/admin/clients/${client.id}`} className="text-[var(--color-gold-deep)] hover:underline">{client.firstName} {client.lastName ?? ''} →</Link> : <span>not linked</span>}</p>
        </div>
        <StudentActions studentId={student.id} email={student.email} portalActive={student.portalActive} hasClient={!!client} />
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <Card title="Profile">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div><dt className="text-xs uppercase tracking-wide text-[var(--color-stone)]">Joined</dt><dd>{fmt(student.createdAt)}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-[var(--color-stone)]">Last login</dt><dd>{fmt(student.lastLoginAt)}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-[var(--color-stone)]">Onboarded</dt><dd>{student.onboardedAt ? fmt(student.onboardedAt) : 'Not yet'}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-[var(--color-stone)]">Age</dt><dd>{age != null ? `${age}` : '—'}</dd></div>
          </dl>
          {student.goals && <p className="mt-3 text-sm"><span className="text-xs uppercase tracking-wide text-[var(--color-stone)]">Goals</span><br />{student.goals}</p>}
          {student.notes && <p className="mt-3 rounded-[var(--radius-sm)] bg-[var(--color-bone)] p-2 text-sm"><span className="text-xs uppercase tracking-wide text-[var(--color-stone)]">Staff note</span><br />{student.notes}</p>}
        </Card>

        <Card title="Progress &amp; gamification">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-[var(--color-gold-deep)] font-[family-name:var(--font-display)] text-lg text-white">{lvl.level}</span>
              <div><p className="font-medium">{lvl.title}</p><p className="text-xs text-[var(--color-stone)]">Level {lvl.level}</p></div>
            </div>
            {[['XP', student.xp.toLocaleString()], ['Rank', standing ? `#${standing.rank}` : '—'], ['Time', totalMin >= 60 ? `${Math.floor(totalMin / 60)}h ${totalMin % 60}m` : `${totalMin}m`], ['Lessons', String(lessonRows.length)], ['Quizzes passed', String(quizzesPassed)]].map(([l, v]) => (
              <div key={l}><p className="font-[family-name:var(--font-display)] text-xl">{v}</p><p className="text-[0.65rem] uppercase tracking-wide text-[var(--color-stone)]">{l}</p></div>
            ))}
          </div>
          {badgeRows.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {badgeRows.map((b) => { const d = badgeByKey.get(b.badgeKey); return <span key={b.id} title={d?.description} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-line)] bg-white px-2.5 py-1 text-xs"><BadgeIcon name={d?.icon} className="h-3.5 w-3.5 text-[var(--color-gold-deep)]" /> {d?.name ?? b.badgeKey}</span>; })}
            </div>
          )}
        </Card>
      </div>

      <div className="mt-5">
        <Card title="Enrolments &amp; payments" action={<div className="flex items-center gap-3"><EnrolInCourse studentEmail={student.email} studentName={`${student.firstName}${student.lastName ? ` ${student.lastName}` : ''}`} courses={enrolCandidates} /><Link href="/admin/academy/enrolments" className="text-xs text-[var(--color-gold-deep)] hover:underline">Manage in pipeline →</Link></div>}>
          {enrolments.length === 0 ? <p className="text-sm text-[var(--color-stone)]">No enrolments.</p> : (
            <div className="space-y-3">
              {enrolments.map((e) => {
                const ps = paymentsByEnrol.get(e.id) ?? [];
                const fee = e.agreedFeePence ?? e.pricePence; // BLD-850: settle against the locked agreed fee when stamped
                const outstanding = Math.max(0, fee - e.paidPence);
                return (
                  <div key={e.id} className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <Link href={`/admin/academy/${e.course.id}`} className="font-medium hover:text-[var(--color-gold-deep)] hover:underline">{e.course.title}</Link>
                        <span className="ml-2 rounded-full bg-[var(--color-bone)] px-2 py-0.5 text-[0.65rem] uppercase tracking-wide text-[var(--color-stone)]">{e.status}</span>
                        <span className="block text-xs text-[var(--color-stone)]">{money(e.paidPence)} of {money(fee)} paid{outstanding > 0 ? ` · ${money(outstanding)} due` : ' · paid in full'}{e.cohort ? ` · cohort ${e.cohort.name || fmt(e.cohort.startAt)}` : ''}{e.preCourseAckAt ? ' · pre-course read ✓' : ''}</span>
                      </div>
                      <Link href={`/academy/learn/${e.course.slug}`} className="text-xs text-[var(--color-gold-deep)] hover:underline">View course →</Link>
                    </div>
                    {ps.length > 0 && (
                      <ul className="mt-2 space-y-1 border-t border-[var(--color-line)] pt-2 text-xs">
                        {ps.map((p) => (
                          <li key={p.id} className="flex items-center justify-between gap-2">
                            <span>{money(p.amountPence)} · {p.kind.toLowerCase()}{p.method ? ` · ${p.method}` : ''} · {p.state === 'PAID' && p.paidAt ? `paid ${fmt(p.paidAt)}` : p.dueAt ? `due ${fmt(p.dueAt)}` : ''}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[0.6rem] font-medium ${STATE_BADGE[p.state] ?? STATE_BADGE.SCHEDULED}`}>{p.state}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card title="Homework" action={<Link href="/admin/academy/homework" className="text-xs text-[var(--color-gold-deep)] hover:underline">Review queue →</Link>}>
          {homeworkRows.length === 0 ? <p className="text-sm text-[var(--color-stone)]">No homework submitted.</p> : (
            <ul className="space-y-1.5 text-sm">
              {homeworkRows.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{h.lesson.title}</span>
                  <span className="shrink-0 text-xs text-[var(--color-stone)]">{HW_LABEL[h.status] ?? h.status} · {fmt(h.updatedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Recent assessments">
          {quizRows.length === 0 && practiceRows.length === 0 ? <p className="text-sm text-[var(--color-stone)]">No quiz or practice attempts yet.</p> : (
            <ul className="space-y-1.5 text-sm">
              {quizRows.slice(0, 8).map((q) => (
                <li key={q.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{q.quiz.title}</span>
                  <span className={`shrink-0 text-xs ${q.passed ? 'text-emerald-700' : 'text-[var(--color-stone)]'}`}>{q.scorePct}% {q.passed ? '✓' : ''} · {fmt(q.createdAt)}</span>
                </li>
              ))}
              {practiceRows.slice(0, 5).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 text-[var(--color-stone)]">
                  <span className="truncate">Practice{p.topic ? ` · ${p.topic}` : ''}</span>
                  <span className="shrink-0 text-xs">{p.correct}/{p.total} · {fmt(p.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Recent lessons completed">
          {lessonRows.length === 0 ? <p className="text-sm text-[var(--color-stone)]">No lessons completed yet.</p> : (
            <ul className="space-y-1.5 text-sm">
              {lessonRows.slice(0, 10).map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{l.lesson.title}<span className="text-xs text-[var(--color-stone)]"> · {l.lesson.module.course.title}</span></span>
                  <span className="shrink-0 text-xs text-[var(--color-stone)]">{fmt(l.completedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Security &amp; sign-in">
          <p className="text-sm">Passkeys: <strong>{passkeys.length}</strong></p>
          {passkeys.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-[var(--color-stone)]">
              {passkeys.map((k) => <li key={k.id}>{k.deviceName || 'Passkey'} · added {fmt(k.createdAt)}{k.lastUsedAt ? ` · last used ${fmtDT(k.lastUsedAt)}` : ''}</li>)}
            </ul>
          )}
          <p className="mt-3 text-xs text-[var(--color-stone)]">Password set: {student.passwordHash ? 'yes' : 'no (passwordless / not yet activated)'}</p>
        </Card>
      </div>
    </AdminShell>
  );
}
