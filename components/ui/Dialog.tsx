'use client';
import { useEffect, useRef, useCallback, type ReactNode, type KeyboardEvent } from 'react';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  /** id of an element inside the dialog that labels it (preferred) */
  labelledby?: string;
  /** fallback if no labelledby element */
  label?: string;
  children: ReactNode;
  className?: string;
}

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * The Dialog primitive's behaviours as a reusable hook, for modals whose exact
 * markup/animation can't route through <Dialog> itself (motion.div panels,
 * bespoke backdrops) without a visual change. Provides: focus moves into the
 * panel on open (first focusable, else the panel), Tab/Shift+Tab are trapped,
 * Escape calls onClose, and focus returns to the opener on close.
 *
 * Usage: attach `panelRef` + `tabIndex={-1}` (plus role="dialog"
 * aria-modal="true" and a label) to the panel, and `onKeyDown` to the
 * outermost overlay element.
 */
export function useDialogBehaviours<T extends HTMLElement = HTMLDivElement>(onClose: () => void, active = true) {
  const panelRef = useRef<T>(null);
  const returnFocusRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!active) return;
    returnFocusRef.current = document.activeElement;
    const first = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE)[0];
    (first ?? panelRef.current)?.focus();
    return () => {
      (returnFocusRef.current as HTMLElement | null)?.focus();
    };
  }, [active]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    },
    [onClose],
  );

  return { panelRef, onKeyDown };
}

export function Dialog({ open, onClose, labelledby, label, children, className }: DialogProps) {
  const { panelRef, onKeyDown: trapTab } = useDialogBehaviours(onClose, open);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" onKeyDown={trapTab}>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60" aria-hidden onClick={onClose} />
      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledby}
        aria-label={labelledby ? undefined : label}
        tabIndex={-1}
        className={className}
      >
        {children}
      </div>
    </div>
  );
}
