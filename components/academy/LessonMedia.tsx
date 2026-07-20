'use client';

import { useEffect, useRef } from 'react';
import type { LessonView, AttachmentRef } from '@/lib/lms';
import { ATTACHMENT_KINDS, kindLabel, DEFAULT_KIND } from '@/components/academy/attachment-kinds';

// BLD-529: type-aware primary media for a lesson — native uploaded video/audio
// (with resume + auto-complete), YouTube/Vimeo embeds, third-party iframe embeds,
// and a downloads list. Falls back gracefully: any lesson with a videoUrl renders
// video regardless of `type`, so existing YouTube lessons are unchanged.

function ytId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}
function vimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m ? m[1] : null;
}
// Native = something the <video>/<audio> tag can play directly (uploaded Blob, mp4…),
// i.e. not a known embed provider and not a plain search/watch link.
function isNativeMedia(url: string): boolean {
  return /\.(mp4|webm|ogg|mov|m4v|mp3|m4a|wav|aac)(\?|$)/i.test(url) || /\.public\.blob\.vercel-storage\.com\//i.test(url);
}

function savePosition(lessonId: string, positionSec: number) {
  // Best-effort, fire-and-forget; keepalive lets it survive a navigation.
  try {
    fetch('/api/academy/lesson', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lessonId, positionSec }), keepalive: true,
    }).catch(() => {});
  } catch { /* ignore */ }
}

function ResumableMedia({ kind, src, startAt, lessonId, poster, captions, onEnded }: {
  kind: 'video' | 'audio'; src: string; startAt: number; lessonId: string; poster?: string | null; captions?: string | null; onEnded?: () => void;
}) {
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const lastSaved = useRef(0);

  // Flush the current position on unmount and when the tab is hidden/closed.
  useEffect(() => {
    const flush = () => { const el = mediaRef.current; if (el && el.currentTime > 0) savePosition(lessonId, Math.floor(el.currentTime)); };
    window.addEventListener('pagehide', flush);
    return () => { window.removeEventListener('pagehide', flush); flush(); };
  }, [lessonId]);

  const onLoaded = (e: React.SyntheticEvent<HTMLMediaElement>) => {
    const el = e.currentTarget;
    if (startAt > 1 && (!el.duration || startAt < el.duration - 5)) el.currentTime = startAt;
  };
  const onTime = (e: React.SyntheticEvent<HTMLMediaElement>) => {
    const t = Math.floor(e.currentTarget.currentTime);
    if (t - lastSaved.current >= 10) { lastSaved.current = t; savePosition(lessonId, t); }
  };
  const onEnd = () => { savePosition(lessonId, 0); onEnded?.(); };

  if (kind === 'audio') {
    return (
      <audio
        ref={(el) => { mediaRef.current = el; }}
        src={src} controls preload="metadata" className="w-full"
        onLoadedMetadata={onLoaded} onTimeUpdate={onTime} onEnded={onEnd}
      />
    );
  }
  return (
    <video
      ref={(el) => { mediaRef.current = el; }}
      src={src} controls playsInline preload="metadata" poster={poster ?? undefined}
      crossOrigin={captions ? 'anonymous' : undefined}
      className="aspect-video w-full rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-black"
      onLoadedMetadata={onLoaded} onTimeUpdate={onTime} onEnded={onEnd}
    >
      {/* BLD-904: WebVTT captions when the lesson has them (set in the curriculum editor). */}
      {captions && <track kind="captions" src={captions} srcLang="en" label="English" default />}
    </video>
  );
}

function fmtSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function DownloadLink({ a }: { a: AttachmentRef }) {
  return (
    <a href={a.url} download target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-[var(--color-ink-soft)] link-underline">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
      {a.label}{fmtSize(a.sizeBytes) ? <span className="text-[var(--color-stone)]"> · {fmtSize(a.sizeBytes)}</span> : null} ↓
    </a>
  );
}

// Grouped by file type (Lesson material / Homework / …) so learners see at a
// glance what each file is for. Unknown/absent kinds fall under "Lesson material".
export function Downloads({ items }: { items: AttachmentRef[] }) {
  if (!items.length) return null;
  const order = ATTACHMENT_KINDS.map((k) => k.value) as string[];
  const groups = order
    .map((kind) => ({ kind, files: items.filter((a) => (a.kind && order.includes(a.kind) ? a.kind : DEFAULT_KIND) === kind) }))
    .filter((g) => g.files.length);
  return (
    <div className="mt-7 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bone)] p-5">
      <p className="eyebrow mb-3">Lesson files</p>
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.kind}>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-stone)]">{kindLabel(g.kind)}</p>
            <ul className="space-y-2">
              {g.files.map((a, i) => <li key={i}><DownloadLink a={a} /></li>)}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The lesson's primary media block (above the body text). Returns null for a
 *  pure-text lesson. `onComplete` (optional) is fired when native video/audio
 *  plays to the end, matching Thinkific's auto-complete behaviour. */
export function LessonMedia({ lesson, onComplete }: { lesson: LessonView; onComplete?: () => void }) {
  // Video first (covers existing YouTube lessons regardless of `type`).
  if (lesson.videoUrl) {
    const yt = ytId(lesson.videoUrl);
    const vim = vimeoId(lesson.videoUrl);
    if (isNativeMedia(lesson.videoUrl)) {
      return (
        <div className="mt-6">
          <p className="eyebrow mb-2 text-xs">Watch first</p>
          <ResumableMedia kind="video" src={lesson.videoUrl} startAt={lesson.videoPositionSec} lessonId={lesson.id} poster={lesson.imageUrl} captions={lesson.captionsUrl} onEnded={onComplete} />
        </div>
      );
    }
    if (yt || vim) {
      return (
        <div className="mt-6">
          <p className="eyebrow mb-2 text-xs">Watch first</p>
          <div className="aspect-video w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)]">
            <iframe className="h-full w-full" src={yt ? `https://www.youtube-nocookie.com/embed/${yt}` : `https://player.vimeo.com/video/${vim}`} title={lesson.title} loading="lazy" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
          </div>
        </div>
      );
    }
    // A non-embeddable link (e.g. a search) — keep the existing button.
    return (
      <div className="mt-6">
        <p className="eyebrow mb-2 text-xs">Watch first</p>
        <a href={lesson.videoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-[var(--color-line)] px-5 py-2.5 text-sm font-medium hover:border-[var(--color-gold)] hover:text-[var(--color-gold-deep)]">▶ Watch explainer videos</a>
      </div>
    );
  }

  if (lesson.audioUrl) {
    return (
      <div className="mt-6">
        <p className="eyebrow mb-2 text-xs">Listen</p>
        <ResumableMedia kind="audio" src={lesson.audioUrl} startAt={lesson.videoPositionSec} lessonId={lesson.id} onEnded={onComplete} />
      </div>
    );
  }

  if (lesson.embedUrl) {
    return (
      <div className="mt-6">
        <div className="aspect-video w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)]">
          <iframe className="h-full w-full" src={lesson.embedUrl} title={lesson.title} loading="lazy" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen />
        </div>
      </div>
    );
  }

  return null;
}
