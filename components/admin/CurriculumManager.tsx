'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ATTACHMENT_KINDS, DEFAULT_KIND } from '@/components/academy/attachment-kinds';

type Link = { label: string; url: string };
type Attachment = { label: string; url: string; sizeBytes?: number; kind?: string };
type Lesson = { id: string; title: string; type: string; durationMin: number | null; minSeconds: number | null; videoUrl: string | null; audioUrl: string | null; embedUrl: string | null; attachments: Attachment[]; imageUrl: string | null; body: string; keyPoints: string[]; objectives: string[]; studyTips: string[]; homework: string | null; examRefs: string[]; citations: Link[]; resources: Link[]; pdfUrls: string[]; pdfNoDownload: string[]; requiresHomework: boolean; preview: boolean };
const LESSON_TYPES: { value: string; label: string }[] = [
  { value: 'TEXT', label: 'Text / reading' },
  { value: 'VIDEO', label: 'Video' },
  { value: 'AUDIO', label: 'Audio' },
  { value: 'PDF', label: 'PDF' },
  { value: 'DOWNLOAD', label: 'Download' },
  { value: 'EMBED', label: 'Embed (iframe)' },
];
type Question = { id: string; prompt: string; type: string; options: string[]; correct: number[]; acceptedAnswers: string[]; explanation: string | null; tip: string | null; imageUrl: string | null };
type Quiz = { id: string; title: string; passMark: number; timeLimitMin: number | null; maxAttempts: number | null; shuffleQuestions: boolean; shuffleOptions: boolean; poolSize: number | null; isSurvey: boolean; questions: Question[] };
type Module = { id: string; title: string; summary: string | null; lessons: Lesson[]; quiz: Quiz | null };
type Course = { id: string; title: string; objectives: string[]; welcome: string | null; preCourseInfo: string | null; portfolioTarget: number | null; modules: Module[] };

const field = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]';
const label = 'block text-xs font-medium text-[var(--color-stone)]';
const btnDark = 'rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-xs font-medium text-[var(--color-porcelain)] disabled:opacity-50';
const btnGhost = 'rounded-full border border-[var(--color-line)] px-3 py-1.5 text-xs hover:border-[var(--color-gold)]';

async function post(payload: object) {
  const r = await fetch('/api/admin/lms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return r.json().catch(() => ({ ok: false }));
}
const linksToText = (a: Link[]) => a.map((x) => `${x.label} | ${x.url}`).join('\n');
const textToLinks = (t: string): Link[] => t.split('\n').map((l) => { const i = l.indexOf('|'); if (i < 0) return null; const label = l.slice(0, i).trim(); const url = l.slice(i + 1).trim(); return label && url ? { label, url } : null; }).filter(Boolean) as Link[];
const listToText = (a: string[]) => a.join('\n');
const textToList = (t: string) => t.split('\n').map((s) => s.trim()).filter(Boolean);

export function CurriculumManager({ course }: { course: Course }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function act(payload: object) { setBusy(true); const r = await post(payload); setBusy(false); if (r.ok) router.refresh(); else alert(r.error || 'Failed.'); return r; }
  const moveModule = (i: number, dir: number) => { const ids = course.modules.map((m) => m.id); const j = i + dir; if (j < 0 || j >= ids.length) return; [ids[i], ids[j]] = [ids[j], ids[i]]; act({ op: 'reorderModules', ids }); };

  return (
    <div className="space-y-5">
      <CourseMeta course={course} busy={busy} act={act} />
      {course.modules.map((m, i) => (
        <ModuleCard key={m.id} module={m} index={i} total={course.modules.length} busy={busy} act={act} onMove={(d) => moveModule(i, d)} />
      ))}
      <button onClick={() => act({ op: 'createModule', courseId: course.id, title: `Module ${course.modules.length + 1}` })} disabled={busy} className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-line)] px-5 py-3 text-sm text-[var(--color-stone)] hover:border-[var(--color-gold)] hover:text-[var(--color-ink)]">+ Add module</button>
    </div>
  );
}

function CourseMeta({ course, busy, act }: { course: Course; busy: boolean; act: Act }) {
  const [open, setOpen] = useState(false);
  const [objectives, setObjectives] = useState(listToText(course.objectives));
  const [welcome, setWelcome] = useState(course.welcome ?? '');
  const [preCourseInfo, setPreCourseInfo] = useState(course.preCourseInfo ?? '');
  const [portfolioTarget, setPortfolioTarget] = useState(course.portfolioTarget != null ? String(course.portfolioTarget) : '');
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
      <div className="flex items-center gap-3 p-4">
        <button onClick={() => setOpen((v) => !v)} className="text-[var(--color-stone)]">{open ? '▾' : '▸'}</button>
        <span className="flex-1 font-[family-name:var(--font-display)] text-lg">Course goals &amp; welcome</span>
        <span className="text-xs text-[var(--color-stone)]">{course.objectives.length} objective(s){course.welcome ? ' · welcome set' : ''}</span>
      </div>
      {open && (
        <div className="space-y-3 border-t border-[var(--color-line)] p-4">
          <label className={label}>Welcome message (shown when a trainee first opens the course)<textarea rows={3} className={`${field} mt-1`} value={welcome} onChange={(e) => setWelcome(e.target.value)} placeholder="Welcome to your Level 4 course. Over the next weeks you'll…" /></label>
          <label className={label}>Course objectives / goals (one per line)<textarea rows={4} className={`${field} mt-1`} value={objectives} onChange={(e) => setObjectives(e.target.value)} placeholder={'Understand laser–tissue interaction\nPass the VTCT Level 4 external exam'} /></label>
          <label className={label}>Pre-course information — mandatory; learners must read &amp; acknowledge before any lessons (BLD-445). Leave blank for no gate.<textarea rows={6} className={`${field} mt-1`} value={preCourseInfo} onChange={(e) => setPreCourseInfo(e.target.value)} placeholder={'Important — please read before starting your course.\n\nAcademy information, learner responsibilities, course requirements, policies and terms…'} /></label>
          <label className={label}>Portfolio target — number of approved case studies needed to complete this course (BLD-538). Leave blank for no target.<input type="number" min={0} max={100} className={`${field} mt-1 max-w-[8rem]`} value={portfolioTarget} onChange={(e) => setPortfolioTarget(e.target.value)} placeholder="e.g. 5" /></label>
          <button onClick={() => act({ op: 'updateCourseMeta', courseId: course.id, objectives: textToList(objectives), welcome, preCourseInfo, portfolioTarget })} disabled={busy} className={btnDark}>Save course goals</button>
        </div>
      )}
    </div>
  );
}

type Act = (payload: object) => Promise<{ ok: boolean; id?: string; error?: string }>;

function ModuleCard({ module: m, index, total, busy, act, onMove }: { module: Module; index: number; total: number; busy: boolean; act: Act; onMove: (d: number) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(m.title);
  const [summary, setSummary] = useState(m.summary ?? '');

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
      <div className="flex flex-wrap items-center gap-3 p-4">
        <button onClick={() => setOpen((v) => !v)} className="text-[var(--color-stone)]">{open ? '▾' : '▸'}</button>
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-stone)]">Module {index + 1}</span>
        <span className="flex-1 font-[family-name:var(--font-display)] text-lg">{m.title}</span>
        <span className="text-xs text-[var(--color-stone)]">{m.lessons.length} lessons · {m.quiz ? `${m.quiz.questions.length} Q` : 'no quiz'}</span>
        <button onClick={() => onMove(-1)} disabled={busy || index === 0} className={btnGhost}>↑</button>
        <button onClick={() => onMove(1)} disabled={busy || index === total - 1} className={btnGhost}>↓</button>
        <button onClick={() => { if (confirm('Delete this module and all its lessons/quiz?')) act({ op: 'deleteModule', id: m.id }); }} disabled={busy} className="text-xs text-[var(--color-blush)] hover:underline">Delete</button>
      </div>

      {open && (
        <div className="space-y-5 border-t border-[var(--color-line)] p-4">
          {/* Module fields */}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={label}>Title<input className={`${field} mt-1`} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
            <label className={label}>Summary<input className={`${field} mt-1`} value={summary} onChange={(e) => setSummary(e.target.value)} /></label>
          </div>
          <button onClick={() => act({ op: 'updateModule', id: m.id, title, summary })} disabled={busy} className={btnDark}>Save module</button>

          {/* Lessons */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-stone)]">Lessons</p>
            <div className="space-y-2">
              {m.lessons.map((l, li) => <LessonRow key={l.id} lesson={l} index={li} total={m.lessons.length} busy={busy} act={act} lessonIds={m.lessons.map((x) => x.id)} />)}
            </div>
            <button onClick={() => act({ op: 'createLesson', moduleId: m.id })} disabled={busy} className="mt-2 text-xs font-medium text-[var(--color-gold)] hover:underline">+ Add lesson</button>
          </div>

          {/* Quiz */}
          <QuizBlock module={m} busy={busy} act={act} />
        </div>
      )}
    </div>
  );
}

function LessonRow({ lesson: l, index, total, busy, act, lessonIds }: { lesson: Lesson; index: number; total: number; busy: boolean; act: Act; lessonIds: string[] }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: l.title, type: l.type || 'TEXT', durationMin: l.durationMin ?? '', minSeconds: l.minSeconds ?? '', videoUrl: l.videoUrl ?? '', audioUrl: l.audioUrl ?? '', embedUrl: l.embedUrl ?? '', attachments: l.attachments ?? [], imageUrl: l.imageUrl ?? '', body: l.body, keyPoints: listToText(l.keyPoints), objectives: listToText(l.objectives), studyTips: listToText(l.studyTips), homework: l.homework ?? '', examRefs: listToText(l.examRefs), citations: linksToText(l.citations), resources: linksToText(l.resources), pdfUrls: l.pdfUrls, pdfNoDownload: l.pdfNoDownload ?? [], requiresHomework: l.requiresHomework, preview: l.preview ?? false });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const move = (d: number) => { const ids = [...lessonIds]; const j = index + d; if (j < 0 || j >= ids.length) return; [ids[index], ids[j]] = [ids[j], ids[index]]; act({ op: 'reorderLessons', ids }); };
  const [uploading, setUploading] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  // BLD-485: onUploadProgress is intentionally omitted. The @vercel/blob/client v2
  // streaming path (ReadableStream + duplex:'half' fetch) hangs on Safari and
  // certain Chrome versions. Without it the SDK falls back to a plain File-body
  // fetch which is reliable across all browsers; progress shows "Uploading…".
  async function putFile(file: File, folder: string): Promise<string> {
    // Server-side route for normal files (reliable — no CSP/CORS); client-direct
    // fallback only for files above the ~4.5 MB serverless cap (large HD videos).
    const { uploadBlob } = await import('@/lib/upload-client');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 180_000);
    try {
      return await uploadBlob(file, { folder, clientUploadUrl: '/api/admin/academy/blob-token', signal: controller.signal });
    } finally { clearTimeout(timer); }
  }
  const uploadErr = (e: unknown) => ((e as Error)?.name === 'AbortError' ? 'timed out after 3 min — check the connection or file size' : (e as Error)?.message || 'unknown');
  // Build the full save payload from a given form state snapshot.
  function lessonSavePayload(s: typeof f) {
    return { op: 'updateLesson', id: l.id, title: s.title, type: s.type, durationMin: s.durationMin, minSeconds: s.minSeconds, videoUrl: s.videoUrl, audioUrl: s.audioUrl, embedUrl: s.embedUrl, attachments: s.attachments, imageUrl: s.imageUrl, body: s.body, keyPoints: textToList(s.keyPoints), objectives: textToList(s.objectives), studyTips: textToList(s.studyTips), homework: s.homework, examRefs: textToList(s.examRefs), citations: textToLinks(s.citations), resources: textToLinks(s.resources), pdfUrls: s.pdfUrls, pdfNoDownload: s.pdfNoDownload, requiresHomework: s.requiresHomework, preview: s.preview };
  }
  async function uploadVideo(file: File) {
    setUploading(true);
    try {
      const url = await putFile(file, 'academy');
      // BLD-588: persist immediately. Previously the URL only lived in local state,
      // so a video uploaded but was lost unless staff also clicked "Save lesson" —
      // they reported it as "video not uploading". Auto-save mirrors uploadPdf/uploadAttachment.
      const updated = { ...f, videoUrl: url };
      setF(updated);
      await act(lessonSavePayload(updated));
    }
    catch (e) { alert('Upload failed: ' + uploadErr(e)); }
    finally { setUploading(false); }
  }
  async function uploadAudio(file: File) {
    setUploadingAudio(true);
    try {
      const url = await putFile(file, 'academy/audio');
      // BLD-588: auto-save the uploaded audio for the same reason as video above.
      const updated = { ...f, audioUrl: url };
      setF(updated);
      await act(lessonSavePayload(updated));
    }
    catch (e) { alert('Audio upload failed: ' + uploadErr(e)); }
    finally { setUploadingAudio(false); }
  }
  async function uploadAttachment(file: File) {
    setUploadingFile(true);
    try {
      const url = await putFile(file, 'academy/files');
      const label = file.name.replace(/^\d+-/, '');
      const updated = { ...f, attachments: [...f.attachments, { label, url, sizeBytes: file.size, kind: DEFAULT_KIND }] };
      setF(updated);
      await act(lessonSavePayload(updated));
    }
    catch (e) { alert('File upload failed: ' + uploadErr(e)); }
    finally { setUploadingFile(false); }
  }
  async function uploadPdf(file: File) {
    setUploadingPdf(true);
    try {
      const url = await putFile(file, 'academy/pdf');
      // Build updated state directly so we can auto-save without waiting for React's async state flush (BLD-485).
      const updated = { ...f, pdfUrls: [...f.pdfUrls, url] };
      setF(updated);
      await act(lessonSavePayload(updated));
    }
    catch (e) { alert('PDF upload failed: ' + uploadErr(e)); }
    finally { setUploadingPdf(false); }
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white">
      <div className="flex items-center gap-2 p-2.5">
        <button onClick={() => setOpen((v) => !v)} className="text-[var(--color-stone)]">{open ? '▾' : '▸'}</button>
        <span className="flex-1 text-sm">{l.title}</span>
        <button onClick={() => move(-1)} disabled={busy || index === 0} className={btnGhost}>↑</button>
        <button onClick={() => move(1)} disabled={busy || index === total - 1} className={btnGhost}>↓</button>
        <button onClick={() => { if (confirm('Delete this lesson?')) act({ op: 'deleteLesson', id: l.id }); }} disabled={busy} className="text-xs text-[var(--color-blush)] hover:underline">Delete</button>
      </div>
      {open && (
        <div className="space-y-3 border-t border-[var(--color-line)] p-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className={label}>Title<input className={`${field} mt-1`} value={f.title} onChange={(e) => set('title', e.target.value)} /></label>
            <label className={label}>Lesson type
              <select className={`${field} mt-1`} value={f.type} onChange={(e) => set('type', e.target.value)}>
                {LESSON_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </label>
            <label className={label}>Duration (min, shown to learner)<input type="number" className={`${field} mt-1`} value={f.durationMin} onChange={(e) => set('durationMin', e.target.value as never)} /></label>
            <label className={label}>Min. time before complete (sec)<input type="number" min={0} className={`${field} mt-1`} value={f.minSeconds} onChange={(e) => set('minSeconds', e.target.value as never)} placeholder="e.g. 30 — stops skipping" /></label>
            <label className={label}>Video (YouTube/Vimeo link, or upload a file)
              <div className="mt-1 flex gap-2">
                <input className={`${field} flex-1`} value={f.videoUrl} onChange={(e) => set('videoUrl', e.target.value)} placeholder="https://youtube… or upload →" />
                <label className={`shrink-0 cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-line)] px-3 py-1.5 text-xs ${uploading ? 'opacity-60' : 'hover:border-[var(--color-gold)]'}`}>
                  {uploading ? 'Uploading...' : 'Upload'}
                  <input type="file" accept="video/*,image/*" className="hidden" disabled={uploading} onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadVideo(file); e.currentTarget.value = ''; }} />
                </label>
              </div>
            </label>
            <label className={label}>Audio (MP3 link, or upload a file)
              <div className="mt-1 flex gap-2">
                <input className={`${field} flex-1`} value={f.audioUrl} onChange={(e) => set('audioUrl', e.target.value)} placeholder="https://… or upload →" />
                <label className={`shrink-0 cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-line)] px-3 py-1.5 text-xs ${uploadingAudio ? 'opacity-60' : 'hover:border-[var(--color-gold)]'}`}>
                  {uploadingAudio ? 'Uploading...' : 'Upload'}
                  <input type="file" accept="audio/*" className="hidden" disabled={uploadingAudio} onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadAudio(file); e.currentTarget.value = ''; }} />
                </label>
              </div>
            </label>
            <label className={label}>Embed URL (iframe — slides, form, interactive)<input className={`${field} mt-1`} value={f.embedUrl} onChange={(e) => set('embedUrl', e.target.value)} placeholder="https://… (shown in an iframe)" /></label>
            <label className={label}>Image URL (optional)<input className={`${field} mt-1`} value={f.imageUrl} onChange={(e) => set('imageUrl', e.target.value)} /></label>
          </div>
          <label className={label}>Lesson content (Markdown: ## headings, - bullets, **bold**)<textarea rows={8} className={`${field} mt-1 font-mono text-xs`} value={f.body} onChange={(e) => set('body', e.target.value)} /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={label}>Learning objectives — &ldquo;by the end you will…&rdquo; (one per line)<textarea rows={3} className={`${field} mt-1`} value={f.objectives} onChange={(e) => set('objectives', e.target.value)} placeholder={'Describe the three layers of the skin\nExplain why the epidermis is avascular'} /></label>
            <label className={label}>Study &amp; exam tips (one per line, Duolingo-style)<textarea rows={3} className={`${field} mt-1`} value={f.studyTips} onChange={(e) => set('studyTips', e.target.value)} placeholder={'Examiners love the 28-day turnover figure\nRemember: melanocytes MAKE melanin'} /></label>
          </div>
          <label className={label}>Homework / assignment (Markdown, shown after the lesson)<textarea rows={3} className={`${field} mt-1`} value={f.homework} onChange={(e) => set('homework', e.target.value)} placeholder="Label a diagram of the skin layers and bring it to the practical day." /></label>
          <label className="flex items-center gap-2 text-xs text-[var(--color-stone)]"><input type="checkbox" checked={f.requiresHomework} onChange={(e) => set('requiresHomework', e.target.checked)} /> Require learners to submit homework files for this lesson (BLD-446)</label>
          <label className="flex items-center gap-2 text-xs text-[var(--color-stone)]"><input type="checkbox" checked={f.preview} onChange={(e) => set('preview', e.target.checked)} /> Free taster — anyone can view this lesson before enrolling (shown on the public course page)</label>
          <label className={label}>Key points (one per line)<textarea rows={3} className={`${field} mt-1`} value={f.keyPoints} onChange={(e) => set('keyPoints', e.target.value)} /></label>
          <label className={label}>Maps to exam / syllabus (one per line — e.g. &ldquo;VTCT Level 4 Unit UV40539, LO1&rdquo;)<textarea rows={2} className={`${field} mt-1`} value={f.examRefs} onChange={(e) => set('examRefs', e.target.value)} /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={label}>References (one per line: Label | https://url)<textarea rows={3} className={`${field} mt-1 text-xs`} value={f.citations} onChange={(e) => set('citations', e.target.value)} /></label>
            <div>
              <p className={label}>PDF attachments &amp; further reading (Label | URL, one per line)</p>
              <textarea rows={3} className={`${field} mt-1 text-xs`} value={f.resources} onChange={(e) => set('resources', e.target.value)} placeholder="My Guide | https://…" />
              <label className={`mt-1.5 inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[var(--color-line)] px-3 py-1 text-xs ${uploadingPdf ? 'opacity-60 pointer-events-none' : 'hover:border-[var(--color-gold)]'}`}>
                {uploadingPdf ? 'Uploading...' : '↑ Upload PDF'}
                <input type="file" accept="application/pdf" className="hidden" disabled={uploadingPdf} onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadPdf(file); e.currentTarget.value = ''; }} />
              </label>
            </div>
          </div>
          <div>
            <p className={`${label} mb-1.5`}>PDF attachments (learners can view / download)</p>
            <div className="space-y-1.5">
              {f.pdfUrls.map((url, i) => {
                const name = decodeURIComponent(url.split('/').pop() ?? url).replace(/^\d+-/, '');
                const canDownload = !f.pdfNoDownload.includes(url);
                return (
                  <div key={url} className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-3 py-1.5 text-xs">
                    <span className="flex-1 truncate text-[var(--color-stone)]">{name}</span>
                    {/* BLD-443: per-file download permission (off = view only). */}
                    <label className="flex shrink-0 items-center gap-1 text-[var(--color-stone)]" title="Let learners download this file (unticked = view only)">
                      <input type="checkbox" checked={canDownload} onChange={(e) => setF((s) => ({ ...s, pdfNoDownload: e.target.checked ? s.pdfNoDownload.filter((u) => u !== url) : [...s.pdfNoDownload, url] }))} />
                      Download
                    </label>
                    <a href={url} target="_blank" rel="noreferrer" className="shrink-0 text-[var(--color-gold)] hover:underline">View</a>
                    <button type="button" onClick={() => setF((s) => ({ ...s, pdfUrls: s.pdfUrls.filter((_, j) => j !== i), pdfNoDownload: s.pdfNoDownload.filter((u) => u !== url) }))} className="shrink-0 text-[var(--color-blush)] hover:underline">Remove</button>
                  </div>
                );
              })}
              <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-[var(--radius-sm)] border border-dashed border-[var(--color-line)] px-3 py-1.5 text-xs ${uploadingPdf ? 'opacity-60' : 'hover:border-[var(--color-gold)]'}`}>
                {uploadingPdf ? 'Uploading...' : '+ Attach PDF'}
                <input type="file" accept="application/pdf" className="hidden" disabled={uploadingPdf} onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadPdf(file); e.currentTarget.value = ''; }} />
              </label>
            </div>
          </div>
          <div>
            <p className={`${label} mb-1.5`}>Lesson files &amp; homework (any file type — learners download these)</p>
            <p className="mb-2 text-xs text-[var(--color-stone)]">Upload a file, then pick what it is (e.g. <strong>Homework</strong> or <strong>Lesson material</strong>) so learners see at a glance what each one is for.</p>
            <div className="space-y-1.5">
              {f.attachments.map((a, i) => (
                <div key={`${a.url}-${i}`} className="flex flex-wrap items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-3 py-1.5 text-xs">
                  <select value={a.kind ?? DEFAULT_KIND} onChange={(e) => setF((s) => ({ ...s, attachments: s.attachments.map((x, j) => j === i ? { ...x, kind: e.target.value } : x) }))} className={`${field} shrink-0`} aria-label="File type">
                    {ATTACHMENT_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                  </select>
                  <input className={`${field} min-w-[10rem] flex-1`} value={a.label} onChange={(e) => setF((s) => ({ ...s, attachments: s.attachments.map((x, j) => j === i ? { ...x, label: e.target.value } : x) }))} placeholder="File label shown to learner" />
                  <a href={a.url} target="_blank" rel="noreferrer" className="shrink-0 text-[var(--color-gold)] hover:underline">View</a>
                  <button type="button" onClick={() => setF((s) => ({ ...s, attachments: s.attachments.filter((_, j) => j !== i) }))} className="shrink-0 text-[var(--color-blush)] hover:underline">Remove</button>
                </div>
              ))}
              <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-[var(--radius-sm)] border border-dashed border-[var(--color-line)] px-3 py-1.5 text-xs ${uploadingFile ? 'opacity-60' : 'hover:border-[var(--color-gold)]'}`}>
                {uploadingFile ? 'Uploading...' : '+ Attach a file (material or homework)'}
                <input type="file" className="hidden" disabled={uploadingFile} onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadAttachment(file); e.currentTarget.value = ''; }} />
              </label>
            </div>
          </div>
          <button onClick={() => act(lessonSavePayload(f))} disabled={busy} className={btnDark}>Save lesson</button>
        </div>
      )}
    </div>
  );
}

function QuizBlock({ module: m, busy, act }: { module: Module; busy: boolean; act: Act }) {
  const [title, setTitle] = useState(m.quiz?.title ?? `${m.title} assessment`);
  const [passMark, setPassMark] = useState(m.quiz?.passMark ?? 70);
  const [timeLimitMin, setTimeLimit] = useState<string>(m.quiz?.timeLimitMin ? String(m.quiz.timeLimitMin) : '');
  const [maxAttempts, setMaxAttempts] = useState<string>(m.quiz?.maxAttempts ? String(m.quiz.maxAttempts) : '');
  const [poolSize, setPoolSize] = useState<string>(m.quiz?.poolSize ? String(m.quiz.poolSize) : '');
  const [shuffleQuestions, setShuffleQ] = useState(m.quiz?.shuffleQuestions ?? false);
  const [shuffleOptions, setShuffleO] = useState(m.quiz?.shuffleOptions ?? false);
  const [isSurvey, setIsSurvey] = useState(m.quiz?.isSurvey ?? false);
  const settings = { timeLimitMin, maxAttempts, poolSize, shuffleQuestions, shuffleOptions, isSurvey };
  if (!m.quiz) {
    return (
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-stone)]">Assessment</p>
        <button onClick={() => act({ op: 'upsertQuiz', moduleId: m.id, title, passMark, ...settings })} disabled={busy} className="text-xs font-medium text-[var(--color-gold)] hover:underline">+ Add a quiz to this module</button>
      </div>
    );
  }
  const q = m.quiz;
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-stone)]">Assessment</p>
      <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className={`${label} flex-1`}>Quiz title<input className={`${field} mt-1`} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
          <label className={label}>Pass mark %<input type="number" min={1} max={100} disabled={isSurvey} className={`${field} mt-1 w-24 ${isSurvey ? 'opacity-50' : ''}`} value={passMark} onChange={(e) => setPassMark(Number(e.target.value))} /></label>
          <button onClick={() => act({ op: 'upsertQuiz', moduleId: m.id, title, passMark, ...settings })} disabled={busy} className={btnDark}>Save</button>
          <button onClick={() => { if (confirm('Delete this quiz and its questions?')) act({ op: 'deleteQuiz', id: q.id }); }} disabled={busy} className="text-xs text-[var(--color-blush)] hover:underline">Delete quiz</button>
        </div>
        {/* BLD-529 assessment settings */}
        <div className="mt-3 grid gap-3 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-3 sm:grid-cols-3">
          <label className={label}>Time limit (min, blank = none)<input type="number" min={1} className={`${field} mt-1`} value={timeLimitMin} onChange={(e) => setTimeLimit(e.target.value)} placeholder="e.g. 20" /></label>
          <label className={label}>Max attempts (blank = unlimited)<input type="number" min={1} className={`${field} mt-1`} value={maxAttempts} onChange={(e) => setMaxAttempts(e.target.value)} placeholder="e.g. 3" /></label>
          <label className={label}>Question pool (blank = all)<input type="number" min={1} className={`${field} mt-1`} value={poolSize} onChange={(e) => setPoolSize(e.target.value)} placeholder={`draw N of ${q.questions.length}`} /></label>
          <label className="flex items-center gap-2 text-xs text-[var(--color-stone)]"><input type="checkbox" checked={shuffleQuestions} onChange={(e) => setShuffleQ(e.target.checked)} /> Shuffle question order</label>
          <label className="flex items-center gap-2 text-xs text-[var(--color-stone)]"><input type="checkbox" checked={shuffleOptions} onChange={(e) => setShuffleO(e.target.checked)} /> Shuffle answer options</label>
          <label className="flex items-center gap-2 text-xs text-[var(--color-stone)]"><input type="checkbox" checked={isSurvey} onChange={(e) => setIsSurvey(e.target.checked)} /> Survey (ungraded — no pass/fail)</label>
          <p className="text-[0.7rem] text-[var(--color-stone)] sm:col-span-3">Click <strong>Save</strong> above to apply these settings.</p>
        </div>
        <div className="mt-3 space-y-2">
          {q.questions.map((qq, qi) => <QuestionRow key={qq.id} q={qq} index={qi} total={q.questions.length} busy={busy} act={act} ids={q.questions.map((x) => x.id)} isSurvey={isSurvey} />)}
        </div>
        <button onClick={() => act({ op: 'createQuestion', quizId: q.id })} disabled={busy} className="mt-2 text-xs font-medium text-[var(--color-gold)] hover:underline">+ Add question</button>
      </div>
    </div>
  );
}

function QuestionRow({ q, index, total, busy, act, ids, isSurvey = false }: { q: Question; index: number; total: number; busy: boolean; act: Act; ids: string[]; isSurvey?: boolean }) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState(q.prompt);
  const [type, setType] = useState(q.type);
  const [explanation, setExplanation] = useState(q.explanation ?? '');
  const [tip, setTip] = useState(q.tip ?? '');
  const [options, setOptions] = useState<string[]>(q.options.length ? q.options : ['', '']);
  const [correct, setCorrect] = useState<number[]>(q.correct);
  const [acceptedAnswers, setAcceptedAnswers] = useState(listToText(q.acceptedAnswers ?? []));
  const [imageUrl, setImageUrl] = useState(q.imageUrl ?? '');
  const [uploadingImg, setUploadingImg] = useState(false);

  // Image upload for the question (pictures only) — reuses the academy Blob client.
  async function uploadImage(file: File) {
    setUploadingImg(true);
    try {
      const { uploadBlob } = await import('@/lib/upload-client');
      const url = await uploadBlob(file, { folder: 'academy/quiz', clientUploadUrl: '/api/admin/academy/blob-token' });
      setImageUrl(url);
    } catch (e) { alert('Image upload failed: ' + ((e as Error)?.message || 'unknown')); }
    finally { setUploadingImg(false); }
  }

  const move = (d: number) => { const a = [...ids]; const j = index + d; if (j < 0 || j >= a.length) return; [a[index], a[j]] = [a[j], a[index]]; act({ op: 'reorderQuestions', ids: a }); };
  const setOpt = (i: number, v: string) => setOptions((o) => o.map((x, k) => (k === i ? v : x)));
  const addOpt = () => setOptions((o) => [...o, '']);
  const delOpt = (i: number) => { setOptions((o) => o.filter((_, k) => k !== i)); setCorrect((c) => c.filter((k) => k !== i).map((k) => (k > i ? k - 1 : k))); };
  const toggleCorrect = (i: number) => {
    if (type === 'MULTI') setCorrect((c) => (c.includes(i) ? c.filter((k) => k !== i) : [...c, i]));
    else setCorrect([i]);
  };
  const changeType = (t: string) => {
    setType(t);
    if (t === 'TRUEFALSE') { setOptions(['True', 'False']); setCorrect((c) => (c[0] === 1 ? [1] : [0])); }
    else if (t === 'SINGLE') setCorrect((c) => (c.length ? [c[0]] : [0]));
  };

  return (
    <div className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-bone)]">
      <div className="flex items-center gap-2 p-2.5">
        <button onClick={() => setOpen((v) => !v)} className="text-[var(--color-stone)]">{open ? '▾' : '▸'}</button>
        <span className="flex-1 text-sm">{index + 1}. {q.prompt}</span>
        <span className="rounded-full bg-[var(--color-porcelain)] px-2 py-0.5 text-[0.6rem] uppercase tracking-wide text-[var(--color-stone)]">{q.type}</span>
        <button onClick={() => move(-1)} disabled={busy || index === 0} className={btnGhost}>↑</button>
        <button onClick={() => move(1)} disabled={busy || index === total - 1} className={btnGhost}>↓</button>
        <button onClick={() => { if (confirm('Delete this question?')) act({ op: 'deleteQuestion', id: q.id }); }} disabled={busy} className="text-xs text-[var(--color-blush)] hover:underline">Delete</button>
      </div>
      {open && (
        <div className="space-y-3 border-t border-[var(--color-line)] p-3">
          <label className={label}>Question<textarea rows={2} className={`${field} mt-1`} value={prompt} onChange={(e) => setPrompt(e.target.value)} /></label>
          <div className="flex items-center gap-3">
            <label className={label}>Type
              <select className={`${field} mt-1 w-44`} value={type} onChange={(e) => changeType(e.target.value)}>
                <option value="SINGLE">Single answer</option>
                <option value="MULTI">Multiple answers</option>
                <option value="TRUEFALSE">True / False</option>
                <option value="SHORT">Short answer (typed)</option>
              </select>
            </label>
            <span className="self-end pb-2 text-xs text-[var(--color-stone)]">{type === 'SHORT' ? 'Learner types an answer' : type === 'MULTI' ? 'Tick all correct answers' : 'Select the one correct answer'}</span>
          </div>
          {type === 'SHORT' ? (
            <label className={label}>Accepted answers (one per line — a typed answer matching any of these, ignoring case, is marked correct)
              <textarea rows={3} className={`${field} mt-1`} value={acceptedAnswers} onChange={(e) => setAcceptedAnswers(e.target.value)} placeholder={'epidermis\nthe epidermis'} />
            </label>
          ) : (
          <div>
            <p className={label}>Options{isSurvey && <span className="ml-2 font-normal normal-case text-[var(--color-stone)]">(survey — the “correct” tick is ignored)</span>}</p>
            <div className="mt-1 space-y-2">
              {options.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input type={type === 'MULTI' ? 'checkbox' : 'radio'} checked={correct.includes(i)} onChange={() => toggleCorrect(i)} className="h-4 w-4 accent-[var(--color-gold)]" />
                  <input className={field} value={o} onChange={(e) => setOpt(i, e.target.value)} disabled={type === 'TRUEFALSE'} />
                  {type !== 'TRUEFALSE' && options.length > 2 && <button onClick={() => delOpt(i)} className="text-xs text-[var(--color-blush)]">✕</button>}
                </div>
              ))}
            </div>
            {type !== 'TRUEFALSE' && <button onClick={addOpt} className="mt-2 text-xs font-medium text-[var(--color-gold)] hover:underline">+ Add option</button>}
          </div>
          )}
          <div>
            <p className={label}>Image (optional — a picture shown with the question)</p>
            {imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="" className="mt-1.5 max-h-40 rounded-[var(--radius-sm)] border border-[var(--color-line)]" />
            )}
            <div className="mt-1.5 flex items-center gap-2">
              <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--color-line)] px-3 py-1.5 text-xs ${uploadingImg ? 'opacity-60 pointer-events-none' : 'hover:border-[var(--color-gold)]'}`}>
                {uploadingImg ? 'Uploading…' : imageUrl ? '↑ Replace image' : '↑ Upload image'}
                <input type="file" accept="image/*" className="hidden" disabled={uploadingImg} onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadImage(file); e.currentTarget.value = ''; }} />
              </label>
              {imageUrl && <button onClick={() => setImageUrl('')} className="text-xs text-[var(--color-blush)] hover:underline">Remove</button>}
            </div>
          </div>
          <label className={label}>Hint (optional — a nudge the learner can reveal before answering)<input className={`${field} mt-1`} value={tip} onChange={(e) => setTip(e.target.value)} placeholder="Think about which layer has no blood supply." /></label>
          <label className={label}>Explanation (shown after answering)<textarea rows={2} className={`${field} mt-1`} value={explanation} onChange={(e) => setExplanation(e.target.value)} /></label>
          <button onClick={() => act({ op: 'updateQuestion', id: q.id, prompt, type, options, correct, acceptedAnswers: textToList(acceptedAnswers), explanation, tip, imageUrl })} disabled={busy} className={btnDark}>Save question</button>
        </div>
      )}
    </div>
  );
}
