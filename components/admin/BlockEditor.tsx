'use client';

import { useEffect, useRef, useState } from 'react';
import { type Block, type BlockType, BLOCK_LABELS, emptyBlock, inlineToHtml } from '@/lib/blocks';
import { sanitizeHtml } from '@/lib/sanitize';
import { RichTextField } from '@/components/admin/RichTextField';

// A block-based content editor for the Journal. Click-to-edit with a live
// typographic preview, inline markdown (**bold** _italic_ `code` [text](url)),
// drag-to-reorder, and an elegant block inserter — styled to the KClinics system.

const TYPES: BlockType[] = ['paragraph', 'heading', 'list', 'image', 'quote', 'callout', 'cta', 'divider', 'html'];
const GLYPH: Record<BlockType, string> = {
  paragraph: '¶', heading: 'H', list: '•', image: '⊡', quote: '“', callout: '★', cta: '⊕', divider: '—', html: '</>',
};
const TEXTY = new Set<BlockType>(['paragraph', 'heading', 'quote', 'callout']);

export function BlockEditor({ blocks, onChange }: { blocks: Block[]; onChange: (b: Block[]) => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const taRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const update = (id: string, patch: Partial<Block>) =>
    onChange(blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b)));
  const remove = (id: string) => { onChange(blocks.filter((b) => b.id !== id)); if (activeId === id) setActiveId(null); };
  // Slash command: convert the current (empty) block into another type in place.
  const convert = (id: string, type: BlockType) => onChange(blocks.map((b) => (b.id === id ? { ...emptyBlock(type), id: b.id } : b)));
  const move = (id: string, dir: -1 | 1) => {
    const i = blocks.findIndex((b) => b.id === id); const j = i + dir;
    if (i < 0 || j < 0 || j >= blocks.length) return;
    const next = [...blocks]; [next[i], next[j]] = [next[j], next[i]]; onChange(next);
  };
  const insertAt = (index: number, type: BlockType) => {
    const b = emptyBlock(type); const next = [...blocks]; next.splice(index, 0, b); onChange(next);
    if (TEXTY.has(type) || type === 'list' || type === 'html') setActiveId(b.id);
    requestAnimationFrame(() => taRefs.current[b.id]?.focus());
  };
  const reorder = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const from = blocks.findIndex((b) => b.id === fromId);
    const to = blocks.findIndex((b) => b.id === toId);
    if (from < 0 || to < 0) return;
    const next = [...blocks]; const [moved] = next.splice(from, 1); next.splice(to, 0, moved); onChange(next);
  };

  // Click outside any block → leave edit mode (back to the clean preview).
  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setActiveId(null); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  return (
    <div ref={rootRef} className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-3 sm:p-6">
      <style dangerouslySetInnerHTML={{ __html: EDITOR_CSS }} />
      {blocks.length === 0 && (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-line)] p-8 text-center">
          <p className="mb-4 text-sm text-[var(--color-stone)]">An empty canvas. Add your first block.</p>
          <Inserter onPick={(t) => insertAt(0, t)} primary />
        </div>
      )}

      <div className="mx-auto max-w-[44rem]">
        {blocks.map((b, i) => (
          <div
            key={b.id}
            className={`be-row group ${dragId === b.id ? 'opacity-40' : ''} ${overId === b.id && dragId ? 'be-over' : ''}`}
            onDragOver={(e) => { if (dragId) { e.preventDefault(); setOverId(b.id); } }}
            onDrop={(e) => { e.preventDefault(); if (dragId) reorder(dragId, b.id); setDragId(null); setOverId(null); }}
          >
            {/* Left gutter: drag handle + reorder */}
            <div className="be-gutter">
              <button
                type="button" title="Drag to reorder" aria-label="Drag to reorder"
                className="be-handle" draggable
                onDragStart={() => setDragId(b.id)} onDragEnd={() => { setDragId(null); setOverId(null); }}
              >⠿</button>
              <div className="be-nudge">
                <button type="button" aria-label="Move up" onClick={() => move(b.id, -1)} disabled={i === 0}>▲</button>
                <button type="button" aria-label="Move down" onClick={() => move(b.id, 1)} disabled={i === blocks.length - 1}>▼</button>
              </div>
            </div>

            {/* Block body */}
            <div className="be-body">
              <BlockView
                block={b} active={activeId === b.id}
                setActive={() => setActiveId(b.id)}
                update={(patch) => update(b.id, patch)}
                convert={(type) => convert(b.id, type)}
                taRef={(el) => { taRefs.current[b.id] = el; }}
              />
            </div>

            {/* Right controls: type tag + delete */}
            <div className="be-tools">
              <span className="be-tag">{BLOCK_LABELS[b.type]}</span>
              <button type="button" className="be-del" aria-label="Delete block" onClick={() => remove(b.id)}>✕</button>
            </div>

            {/* Inserter between blocks (appears on hover) */}
            <div className="be-insert"><Inserter onPick={(t) => insertAt(i + 1, t)} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── One block: live preview, swaps to an editor when active ───────────────────
const SLASH_TYPES: BlockType[] = ['heading', 'list', 'quote', 'callout', 'image', 'cta', 'divider', 'html'];

function BlockView({ block: b, active, setActive, update, convert, taRef }: {
  block: Block; active: boolean; setActive: () => void;
  update: (patch: Partial<Block>) => void;
  convert: (type: BlockType) => void;
  taRef: (el: HTMLTextAreaElement | null) => void;
}) {
  // Text-bearing blocks: true WYSIWYG — formatting renders live as you type.
  if (b.type === 'paragraph' || b.type === 'heading' || b.type === 'quote' || b.type === 'callout') {
    const cls = b.type === 'heading' ? (b.level === 3 ? 'be-h3' : 'be-h2') : b.type === 'quote' ? 'be-quote' : b.type === 'callout' ? 'be-callout' : 'be-p';
    const slashing = b.type === 'paragraph' && b.text === '/';
    return (
      <div className="relative">
        {slashing && (
          <div className="absolute left-0 top-7 z-30 grid w-56 grid-cols-2 gap-1 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-2 shadow-[var(--shadow-lift)]">
            {SLASH_TYPES.map((t) => (
              <button key={t} type="button" onMouseDown={(e) => { e.preventDefault(); convert(t); }} className="rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-sm hover:bg-[var(--color-bone)]">{BLOCK_LABELS[t]}</button>
            ))}
          </div>
        )}
        {b.type === 'heading' && (
          <div className="mb-2 flex gap-1">
            {[2, 3].map((lv) => (
              <button key={lv} type="button" onClick={() => update({ level: lv as 2 | 3 })}
                className={`be-pill ${b.level === lv ? 'be-pill-on' : ''}`}>H{lv}</button>
            ))}
          </div>
        )}
        <RichTextField className={`be-input ${cls}`} value={b.text}
          placeholder={b.type === 'heading' ? 'Heading' : b.type === 'callout' ? 'A highlighted note…' : b.type === 'quote' ? 'A pull quote…' : 'Write something, or “/” for blocks…'}
          onChange={(v) => update({ text: v })} />
        {b.type === 'quote' && (
          <input className="be-cite-input" value={b.cite || ''} placeholder="Attribution (optional)" aria-label="Attribution"
            onChange={(e) => update({ cite: e.target.value })} />
        )}
      </div>
    );
  }

  if (b.type === 'list') {
    if (active) {
      return (
        <div>
          <div className="mb-2 flex gap-1">
            <button type="button" onClick={() => update({ ordered: false })} className={`be-pill ${!b.ordered ? 'be-pill-on' : ''}`}>• Bulleted</button>
            <button type="button" onClick={() => update({ ordered: true })} className={`be-pill ${b.ordered ? 'be-pill-on' : ''}`}>1. Numbered</button>
          </div>
          <AutoTextarea inputRef={taRef} className="be-input be-p" value={(b.items || []).join('\n')}
            placeholder={'One item per line'} onChange={(v) => update({ items: v.split('\n') })} autoFocus />
          <p className="be-hint mt-1">One item per line.</p>
        </div>
      );
    }
    const items = (b.items || []).filter((i) => i.trim());
    return (
      <button type="button" className="be-preview" onClick={setActive}>
        {items.length
          ? (b.ordered
            ? <ol className="be-list be-ol">{items.map((it, k) => <li key={k} dangerouslySetInnerHTML={{ __html: inlineToHtml(it) }} />)}</ol>
            : <ul className="be-list be-ul">{items.map((it, k) => <li key={k} dangerouslySetInnerHTML={{ __html: inlineToHtml(it) }} />)}</ul>)
          : <span className="be-placeholder">Empty list — click to add items</span>}
      </button>
    );
  }

  if (b.type === 'image') {
    return (
      <div className="be-card">
        {b.src
          ? <img src={b.src} alt={b.alt || ''} className="be-img" />
          : <div className="be-img-empty">Image preview</div>}
        <input className="be-field" value={b.src} placeholder="Image URL (https://…)" aria-label="Image URL" onChange={(e) => update({ src: e.target.value })} />
        <div className="grid gap-2 sm:grid-cols-2">
          <input className="be-field" value={b.alt || ''} placeholder="Alt text (accessibility)" aria-label="Alt text" onChange={(e) => update({ alt: e.target.value })} />
          <input className="be-field" value={b.caption || ''} placeholder="Caption (optional)" aria-label="Caption" onChange={(e) => update({ caption: e.target.value })} />
        </div>
      </div>
    );
  }

  if (b.type === 'cta') {
    return (
      <div className="be-card">
        {b.label.trim() && <div className="be-cta-preview"><span>{b.label}</span></div>}
        <div className="grid gap-2 sm:grid-cols-2">
          <input className="be-field" value={b.label} placeholder="Button label" aria-label="Button label" onChange={(e) => update({ label: e.target.value })} />
          <input className="be-field" value={b.href} placeholder="Link (/laser-hair-removal or https://…)" aria-label="Link URL" onChange={(e) => update({ href: e.target.value })} />
        </div>
      </div>
    );
  }

  if (b.type === 'divider') return <div className="be-divider" aria-hidden />;

  // Raw HTML escape hatch (used by imported posts we couldn't fully parse).
  if (active) {
    return <AutoTextarea inputRef={taRef} className="be-input be-code" value={b.html}
      placeholder="<p>Raw HTML…</p>" onChange={(v) => update({ html: v })} autoFocus />;
  }
  return (
    <button type="button" className="be-preview" onClick={setActive}>
      {b.html.trim()
        ? <div className="be-p" dangerouslySetInnerHTML={{ __html: sanitizeHtml(b.html) }} />
        : <span className="be-placeholder">Empty HTML — click to edit</span>}
    </button>
  );
}

// ── Block inserter popover ────────────────────────────────────────────────────
function Inserter({ onPick, primary }: { onPick: (t: BlockType) => void; primary?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);
  return (
    <div ref={ref} className="relative inline-block">
      <button type="button" onClick={() => setOpen((o) => !o)} className={primary ? 'be-add-primary' : 'be-add'}>
        <span className="text-base leading-none">＋</span>{primary && <span className="ml-1.5">Add block</span>}
      </button>
      {open && (
        <div className="be-menu">
          {TYPES.map((t) => (
            <button key={t} type="button" className="be-menu-item" onClick={() => { onPick(t); setOpen(false); }}>
              <span className="be-menu-glyph">{GLYPH[t]}</span>{BLOCK_LABELS[t]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Auto-growing textarea ─────────────────────────────────────────────────────
function autosize(el: HTMLTextAreaElement) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; }
function AutoTextarea({ value, onChange, className, placeholder, autoFocus, inputRef }: {
  value: string; onChange: (v: string) => void; className?: string; placeholder?: string; autoFocus?: boolean;
  inputRef?: (el: HTMLTextAreaElement | null) => void;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => { if (ref.current) autosize(ref.current); }, [value]);
  return (
    <textarea
      ref={(el) => { ref.current = el; inputRef?.(el); }}
      className={className} value={value} placeholder={placeholder} aria-label={placeholder} rows={1} autoFocus={autoFocus}
      onChange={(e) => { onChange(e.target.value); autosize(e.target); }}
    />
  );
}

const EDITOR_CSS = `
.be-row{position:relative;display:grid;grid-template-columns:2.1rem 1fr auto;align-items:start;gap:0.5rem;padding:0.15rem 0;border-radius:var(--radius-md);}
.be-row.be-over{box-shadow:inset 0 2px 0 var(--color-gold);}
.be-gutter{display:flex;flex-direction:column;align-items:center;gap:2px;padding-top:0.35rem;opacity:0;transition:opacity .15s;}
.be-row:hover .be-gutter,.be-row:focus-within .be-gutter{opacity:1;}
.be-handle{cursor:grab;color:var(--color-stone);font-size:0.85rem;line-height:1;padding:2px;}
.be-handle:active{cursor:grabbing;}
.be-nudge{display:flex;flex-direction:column;}
.be-nudge button{color:var(--color-stone);font-size:0.5rem;line-height:1.1;padding:1px;}
.be-nudge button:hover:not(:disabled){color:var(--color-ink);}
.be-nudge button:disabled{opacity:0.25;}
.be-body{min-width:0;}
.be-tools{display:flex;align-items:center;gap:0.4rem;padding-top:0.4rem;opacity:0;transition:opacity .15s;}
.be-row:hover .be-tools,.be-row:focus-within .be-tools{opacity:1;}
.be-tag{font-size:0.6rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--color-stone);background:var(--color-bone);border-radius:999px;padding:2px 8px;white-space:nowrap;}
.be-del{color:var(--color-stone);font-size:0.7rem;width:1.3rem;height:1.3rem;border-radius:999px;}
.be-del:hover{color:#c0392b;background:var(--color-bone);}
.be-insert{height:0;overflow:visible;display:flex;justify-content:center;position:relative;z-index:2;}
.be-add{display:inline-flex;align-items:center;justify-content:center;width:1.4rem;height:1.4rem;margin-top:-0.1rem;border-radius:999px;background:var(--color-porcelain);border:1px solid var(--color-line);color:var(--color-stone);opacity:0;transition:opacity .15s,color .15s,border-color .15s;}
.be-row:hover .be-add{opacity:1;}
.be-add:hover{color:var(--color-gold);border-color:var(--color-gold);}
.be-add-primary{display:inline-flex;align-items:center;border-radius:999px;background:var(--color-ink);color:var(--color-porcelain);padding:0.5rem 1.1rem;font-size:0.85rem;}
.be-menu{position:absolute;left:50%;top:1.6rem;transform:translateX(-50%);z-index:30;width:11rem;background:var(--color-porcelain);border:1px solid var(--color-line);border-radius:var(--radius-md);box-shadow:var(--shadow-lift);padding:0.3rem;display:grid;gap:1px;}
.be-menu-item{display:flex;align-items:center;gap:0.6rem;width:100%;text-align:left;font-size:0.85rem;padding:0.45rem 0.6rem;border-radius:var(--radius-sm);color:var(--color-ink-soft);}
.be-menu-item:hover{background:var(--color-bone);color:var(--color-ink);}
.be-menu-glyph{display:inline-grid;place-items:center;width:1.4rem;height:1.4rem;border-radius:var(--radius-sm);background:var(--color-bone);font-size:0.8rem;color:var(--color-stone);}
.be-preview{display:block;width:100%;text-align:left;cursor:text;border-radius:var(--radius-sm);padding:0.15rem 0.1rem;}
.be-preview:hover{background:color-mix(in oklab,var(--color-bone) 55%,transparent);}
.be-placeholder{color:var(--color-stone);font-style:italic;}
.be-input{width:100%;resize:none;outline:none;background:transparent;border:none;overflow:hidden;}
.be-input::placeholder{color:var(--color-stone);}
.be-h2,.be-input.be-h2{font-family:var(--font-display),serif;font-size:clamp(1.5rem,1.2rem+1vw,2rem);line-height:1.15;color:var(--color-ink);font-weight:500;}
.be-h3,.be-input.be-h3{font-family:var(--font-display),serif;font-size:1.3rem;line-height:1.2;color:var(--color-ink);font-weight:500;}
.be-p,.be-input.be-p{font-size:1.05rem;line-height:1.75;color:var(--color-ink-soft);}
.be-p a,.be-preview a{color:var(--color-gold);text-decoration:underline;text-underline-offset:3px;}
.be-quote,.be-input.be-quote{border-left:3px solid var(--color-gold);padding-left:1rem;font-style:italic;color:var(--color-stone);font-size:1.1rem;line-height:1.6;}
.be-quote cite{display:block;margin-top:0.4rem;font-style:normal;font-size:0.85rem;color:var(--color-stone);}
.be-callout,.be-input.be-callout{background:var(--color-bone);border:1px solid var(--color-line);border-left:3px solid var(--color-gold);border-radius:var(--radius-md);padding:1rem 1.2rem;color:var(--color-ink-soft);font-size:1rem;line-height:1.6;}
.be-code,.be-input.be-code{font-family:ui-monospace,Menlo,monospace;font-size:0.8rem;line-height:1.6;background:var(--color-bone);border-radius:var(--radius-sm);padding:0.7rem;color:var(--color-ink);}
.be-list{padding-left:1.3rem;}
.be-list li{margin:0.3rem 0;font-size:1.05rem;line-height:1.7;color:var(--color-ink-soft);}
.be-ul li{list-style:disc;} .be-ol li{list-style:decimal;}
.be-cite-input,.be-field{width:100%;margin-top:0.5rem;background:var(--color-bone);border:1px solid var(--color-line);border-radius:var(--radius-sm);padding:0.5rem 0.7rem;font-size:0.85rem;outline:none;}
.be-cite-input:focus,.be-field:focus{border-color:var(--color-gold);}
.be-card{display:grid;gap:0.5rem;background:color-mix(in oklab,var(--color-bone) 55%,transparent);border:1px solid var(--color-line);border-radius:var(--radius-md);padding:0.7rem;}
.be-img{width:100%;max-height:18rem;object-fit:cover;border-radius:var(--radius-sm);}
.be-img-empty{display:grid;place-items:center;height:7rem;border:1px dashed var(--color-line);border-radius:var(--radius-sm);color:var(--color-stone);font-size:0.8rem;}
.be-cta-preview span{display:inline-block;background:var(--color-ink);color:var(--color-porcelain);border-radius:999px;padding:0.5rem 1.3rem;font-size:0.85rem;}
.be-divider{height:1px;background:linear-gradient(90deg,transparent,var(--color-line),transparent);margin:0.9rem 0;}
.be-toolbar{display:flex;align-items:center;gap:0.15rem;margin-bottom:0.4rem;}
.be-toolbar button{width:1.6rem;height:1.6rem;border-radius:var(--radius-sm);font-size:0.8rem;color:var(--color-ink-soft);border:1px solid transparent;}
.be-toolbar button:hover{background:var(--color-bone);border-color:var(--color-line);}
.be-hint{font-size:0.7rem;color:var(--color-stone);margin-left:0.4rem;}
.be-pill{font-size:0.72rem;padding:0.2rem 0.6rem;border-radius:999px;border:1px solid var(--color-line);color:var(--color-stone);}
.be-pill-on{background:var(--color-ink);color:var(--color-porcelain);border-color:var(--color-ink);}
`;
