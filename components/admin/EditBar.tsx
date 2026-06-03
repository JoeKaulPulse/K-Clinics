'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

// Floating "Edit this page" bar shown only to signed-in admins on public pages.
// Checks admin status client-side so marketing pages stay statically cached.
export function EditBar() {
  const path = usePathname();
  const [admin, setAdmin] = useState(false);
  const hidden = !path || path.startsWith('/admin') || path.startsWith('/preview');

  useEffect(() => {
    if (hidden) { setAdmin(false); return; }
    let on = true;
    fetch('/api/admin/whoami').then((r) => r.json()).then((d) => { if (on) setAdmin(!!d.admin); }).catch(() => {});
    return () => { on = false; };
  }, [path, hidden]);

  if (hidden || !admin) return null;
  return (
    <a
      href={`/admin/edit?path=${encodeURIComponent(path)}`}
      className="fixed bottom-5 left-5 z-[60] inline-flex items-center gap-2 rounded-full bg-[var(--color-ink)] px-4 py-2.5 text-sm font-medium text-[var(--color-porcelain)] shadow-[var(--shadow-lift)] transition-transform hover:scale-105 print:hidden"
    >
      ✎ Edit this page
    </a>
  );
}
