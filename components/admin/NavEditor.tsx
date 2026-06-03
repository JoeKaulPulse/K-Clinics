'use client';

import type { NavGroup, NavLink } from '@/lib/nav';
import type { FooterColumn } from '@/lib/site-config';

// Editor for the header mega-menu and footer link columns. Operates on the
// site config's `nav` object; saving is handled by the parent (SiteConfigEditor).

const fld = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--color-gold)]';
const card = 'rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5';
const ghost = 'rounded-full border border-[var(--color-line)] px-3 py-1.5 text-sm text-[var(--color-ink-soft)] hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]';

function move<T>(a: T[], i: number, d: number): T[] { const j = i + d; if (j < 0 || j >= a.length) return a; const n = [...a]; [n[i], n[j]] = [n[j], n[i]]; return n; }
function setAt<T>(a: T[], i: number, v: T): T[] { const n = [...a]; n[i] = v; return n; }
function delAt<T>(a: T[], i: number): T[] { return a.filter((_, j) => j !== i); }

function Reorder({ onUp, onDown, onDel }: { onUp: () => void; onDown: () => void; onDel: () => void }) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button onClick={onUp} aria-label="Move up" className="text-[var(--color-stone-soft)] hover:text-[var(--color-ink)]">▲</button>
      <button onClick={onDown} aria-label="Move down" className="text-[var(--color-stone-soft)] hover:text-[var(--color-ink)]">▼</button>
      <button onClick={onDel} aria-label="Remove" className="ml-1 text-[var(--color-stone-soft)] hover:text-[#c0392b]">✕</button>
    </div>
  );
}

export function NavEditor({ nav, onChange }: { nav: { primary: NavGroup[]; footer: FooterColumn[] }; onChange: (nav: { primary: NavGroup[]; footer: FooterColumn[] }) => void }) {
  const primary = nav.primary;
  const footer = nav.footer;
  const setPrimary = (p: NavGroup[]) => onChange({ ...nav, primary: p });
  const setFooter = (f: FooterColumn[]) => onChange({ ...nav, footer: f });

  return (
    <div className="space-y-6">
      {/* Header mega-menu */}
      <section className={card}>
        <h2 className="mb-1 font-[family-name:var(--font-display)] text-xl">Header menu</h2>
        <p className="mb-4 text-sm text-[var(--color-stone)]">Top navigation. A menu item can be a simple link, or a mega-menu with columns of links.</p>
        <div className="space-y-4">
          {primary.map((g, gi) => (
            <div key={gi} className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bone)] p-3">
              <div className="flex items-start gap-2">
                <div className="grid flex-1 gap-2 sm:grid-cols-2">
                  <input className={fld} value={g.label} placeholder="Menu label" onChange={(e) => setPrimary(setAt(primary, gi, { ...g, label: e.target.value }))} />
                  <input className={fld} value={g.href} placeholder="/link" onChange={(e) => setPrimary(setAt(primary, gi, { ...g, href: e.target.value }))} />
                </div>
                <Reorder onUp={() => setPrimary(move(primary, gi, -1))} onDown={() => setPrimary(move(primary, gi, 1))} onDel={() => setPrimary(delAt(primary, gi))} />
              </div>

              <label className="mt-2 flex items-center gap-2 text-xs text-[var(--color-stone)]">
                <input type="checkbox" checked={!!g.columns} onChange={(e) => setPrimary(setAt(primary, gi, { ...g, columns: e.target.checked ? (g.columns || [{ heading: 'Column', links: [] }]) : undefined }))} />
                Mega-menu dropdown
              </label>

              {g.columns && (
                <div className="mt-3 space-y-3 border-t border-[var(--color-line)] pt-3">
                  {g.columns.map((col, ci) => {
                    const setCol = (c: { heading: string; links: NavLink[] }) => setPrimary(setAt(primary, gi, { ...g, columns: setAt(g.columns!, ci, c) }));
                    return (
                      <div key={ci} className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-3">
                        <div className="flex items-center gap-2">
                          <input className={`${fld} font-medium`} value={col.heading} placeholder="Column heading" onChange={(e) => setCol({ ...col, heading: e.target.value })} />
                          <Reorder onUp={() => setPrimary(setAt(primary, gi, { ...g, columns: move(g.columns!, ci, -1) }))} onDown={() => setPrimary(setAt(primary, gi, { ...g, columns: move(g.columns!, ci, 1) }))} onDel={() => setPrimary(setAt(primary, gi, { ...g, columns: delAt(g.columns!, ci) }))} />
                        </div>
                        <div className="mt-2 space-y-2">
                          {col.links.map((l, li) => (
                            <div key={li} className="flex items-start gap-2">
                              <div className="grid flex-1 gap-1.5 sm:grid-cols-3">
                                <input className={fld} value={l.label} placeholder="Label" onChange={(e) => setCol({ ...col, links: setAt(col.links, li, { ...l, label: e.target.value }) })} />
                                <input className={fld} value={l.href} placeholder="/link" onChange={(e) => setCol({ ...col, links: setAt(col.links, li, { ...l, href: e.target.value }) })} />
                                <input className={fld} value={l.description || ''} placeholder="Description (optional)" onChange={(e) => setCol({ ...col, links: setAt(col.links, li, { ...l, description: e.target.value }) })} />
                              </div>
                              <Reorder onUp={() => setCol({ ...col, links: move(col.links, li, -1) })} onDown={() => setCol({ ...col, links: move(col.links, li, 1) })} onDel={() => setCol({ ...col, links: delAt(col.links, li) })} />
                            </div>
                          ))}
                          <button className={ghost} onClick={() => setCol({ ...col, links: [...col.links, { label: '', href: '' }] })}>+ Link</button>
                        </div>
                      </div>
                    );
                  })}
                  <button className={ghost} onClick={() => setPrimary(setAt(primary, gi, { ...g, columns: [...g.columns!, { heading: 'Column', links: [] }] }))}>+ Column</button>
                </div>
              )}
            </div>
          ))}
          <button className={ghost} onClick={() => setPrimary([...primary, { label: 'New item', href: '/' }])}>+ Menu item</button>
        </div>
      </section>

      {/* Footer columns */}
      <section className={card}>
        <h2 className="mb-1 font-[family-name:var(--font-display)] text-xl">Footer links</h2>
        <p className="mb-4 text-sm text-[var(--color-stone)]">Columns of links shown in the site footer.</p>
        <div className="space-y-3">
          {footer.map((col, ci) => {
            const setCol = (c: FooterColumn) => setFooter(setAt(footer, ci, c));
            return (
              <div key={ci} className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bone)] p-3">
                <div className="flex items-center gap-2">
                  <input className={`${fld} font-medium`} value={col.heading} placeholder="Column heading" onChange={(e) => setCol({ ...col, heading: e.target.value })} />
                  <Reorder onUp={() => setFooter(move(footer, ci, -1))} onDown={() => setFooter(move(footer, ci, 1))} onDel={() => setFooter(delAt(footer, ci))} />
                </div>
                <div className="mt-2 space-y-2">
                  {col.links.map((l, li) => (
                    <div key={li} className="flex items-start gap-2">
                      <div className="grid flex-1 gap-1.5 sm:grid-cols-2">
                        <input className={fld} value={l.label} placeholder="Label" onChange={(e) => setCol({ ...col, links: setAt(col.links, li, { ...l, label: e.target.value }) })} />
                        <input className={fld} value={l.href} placeholder="/link" onChange={(e) => setCol({ ...col, links: setAt(col.links, li, { ...l, href: e.target.value }) })} />
                      </div>
                      <Reorder onUp={() => setCol({ ...col, links: move(col.links, li, -1) })} onDown={() => setCol({ ...col, links: move(col.links, li, 1) })} onDel={() => setCol({ ...col, links: delAt(col.links, li) })} />
                    </div>
                  ))}
                  <button className={ghost} onClick={() => setCol({ ...col, links: [...col.links, { label: '', href: '' }] })}>+ Link</button>
                </div>
              </div>
            );
          })}
          <button className={ghost} onClick={() => setFooter([...footer, { heading: 'New column', links: [] }])}>+ Column</button>
        </div>
      </section>
    </div>
  );
}
