'use client';

import { useEffect, useRef, useState } from 'react';
import { inlineToHtml, htmlToInline } from '@/lib/blocks';

// A small WYSIWYG field: formatting renders live (bold shows bold as you type),
// while storage stays as our inline markdown. Used by the block editor's
// text-bearing blocks. contentEditable, dependency-free.
export function RichTextField({ value, onChange, className, placeholder, ariaLabel }: {
  value: string; onChange: (v: string) => void; className?: string; placeholder?: string; ariaLabel?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);

  // Sync external value in only when not actively editing (avoids caret jumps).
  useEffect(() => {
    const el = ref.current; if (!el || focused) return;
    const html = inlineToHtml(value || '');
    if (el.innerHTML !== html) el.innerHTML = html;
  }, [value, focused]);

  const emit = () => { if (ref.current) onChange(htmlToInline(ref.current.innerHTML)); };

  // execCommand keeps things simple and reliable for an internal admin tool.
  const exec = (cmd: string, arg?: string) => {
    ref.current?.focus();
    try { document.execCommand('styleWithCSS', false, 'false'); } catch { /* ignore */ }
    document.execCommand(cmd, false, arg);
    emit();
  };
  const link = () => {
    const sel = window.getSelection?.();
    if (!sel || sel.isCollapsed) { alert('Select some text first, then add a link.'); return; }
    const url = prompt('Link URL', 'https://');
    if (url) exec('createLink', url);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!(e.metaKey || e.ctrlKey)) return;
    const k = e.key.toLowerCase();
    if (k === 'b') { e.preventDefault(); exec('bold'); }
    else if (k === 'i') { e.preventDefault(); exec('italic'); }
    else if (k === 'k') { e.preventDefault(); link(); }
  };

  return (
    <div className="relative">
      {focused && (
        <div className="absolute -top-9 left-0 z-10 flex items-center gap-0.5 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-1 shadow-[var(--shadow-soft)]" onMouseDown={(e) => e.preventDefault()}>
          <button type="button" onClick={() => exec('bold')} title="Bold (⌘B)" className="grid h-7 w-7 place-items-center rounded hover:bg-[var(--color-bone)]"><b>B</b></button>
          <button type="button" onClick={() => exec('italic')} title="Italic (⌘I)" className="grid h-7 w-7 place-items-center rounded hover:bg-[var(--color-bone)]"><i>I</i></button>
          <button type="button" onClick={link} title="Link (⌘K)" className="grid h-7 w-7 place-items-center rounded hover:bg-[var(--color-bone)]">🔗</button>
          <button type="button" onClick={() => exec('removeFormat')} title="Clear formatting" className="grid h-7 w-7 place-items-center rounded text-[var(--color-stone)] hover:bg-[var(--color-bone)]">⌫</button>
        </div>
      )}
      <div
        ref={ref}
        role="textbox"
        aria-label={ariaLabel}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={emit}
        onBlur={() => { setFocused(false); emit(); }}
        onFocus={() => setFocused(true)}
        onKeyDown={onKeyDown}
        className={`rt-field outline-none ${className || ''}`}
      />
      <style>{`.rt-field:empty:before{content:attr(data-placeholder);color:var(--color-stone);}
.rt-field a{color:var(--color-gold);text-decoration:underline;}
.rt-field{white-space:pre-wrap;word-break:break-word;}`}</style>
    </div>
  );
}
