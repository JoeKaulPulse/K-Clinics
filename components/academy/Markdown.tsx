import type { ReactNode } from 'react';

// Minimal, safe markdown renderer for lesson bodies (no raw HTML injection).
// Supports: ## / ### headings, "- " bullets, "1." ordered lists, blank-line
// paragraphs, and **bold** inline emphasis.

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  text.split(/(\*\*[^*]+\*\*)/g).forEach((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) {
      out.push(
        <strong key={i} className="font-semibold text-[var(--color-ink)]">
          {p.slice(2, -2)}
        </strong>,
      );
    } else if (p) {
      out.push(<span key={i}>{p}</span>);
    }
  });
  return out;
}

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, '').split('\n');
  const blocks: ReactNode[] = [];
  let para: string[] = [];
  let bullets: string[] = [];
  let ordered: string[] = [];
  let k = 0;

  function flushPara() {
    if (!para.length) return;
    blocks.push(
      <p key={`p${k++}`} className="mt-4 leading-relaxed text-[var(--color-ink-soft)]">
        {inline(para.join(' '))}
      </p>,
    );
    para = [];
  }
  function flushBullets() {
    if (!bullets.length) return;
    const items = bullets.slice();
    blocks.push(
      <ul key={`u${k++}`} className="mt-4 space-y-2">
        {items.map((b, i) => (
          <li key={i} className="flex gap-2.5 leading-relaxed text-[var(--color-ink-soft)]">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-gold)]" />
            <span>{inline(b)}</span>
          </li>
        ))}
      </ul>,
    );
    bullets = [];
  }
  function flushOrdered() {
    if (!ordered.length) return;
    const items = ordered.slice();
    blocks.push(
      <ol key={`o${k++}`} className="mt-4 space-y-2">
        {items.map((b, i) => (
          <li key={i} className="flex gap-3 leading-relaxed text-[var(--color-ink-soft)]">
            <span className="font-[family-name:var(--font-display)] text-[var(--color-gold)]">{i + 1}.</span>
            <span>{inline(b)}</span>
          </li>
        ))}
      </ol>,
    );
    ordered = [];
  }
  function flushAll() {
    flushPara();
    flushBullets();
    flushOrdered();
  }

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { flushAll(); continue; }
    if (/^###\s+/.test(line)) {
      flushAll();
      blocks.push(<h4 key={`h${k++}`} className="mt-6 font-[family-name:var(--font-display)] text-lg">{line.replace(/^###\s+/, '')}</h4>);
      continue;
    }
    if (/^##\s+/.test(line)) {
      flushAll();
      blocks.push(<h3 key={`h${k++}`} className="mt-8 font-[family-name:var(--font-display)] text-xl md:text-2xl">{line.replace(/^##\s+/, '')}</h3>);
      continue;
    }
    if (/^[-*]\s+/.test(line)) { flushPara(); flushOrdered(); bullets.push(line.replace(/^[-*]\s+/, '')); continue; }
    if (/^\d+\.\s+/.test(line)) { flushPara(); flushBullets(); ordered.push(line.replace(/^\d+\.\s+/, '')); continue; }
    flushBullets(); flushOrdered(); para.push(line);
  }
  flushAll();
  return <div>{blocks}</div>;
}
