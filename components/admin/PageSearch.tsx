// Shared page-level search field for admin list/table pages (Clients, Bookings,
// …). A plain server-rendered GET form — no client JS — so it drops into server
// components. Visually consistent with the global command-palette search: a
// leading magnifier inside a pill, brand focus ring, and a subordinate submit.
//
// Pass `hidden` to preserve sibling query params (active filter / sort / dir)
// across a search submit, the way each list page tracks its own state.
export function PageSearch({
  name = 'q',
  defaultValue = '',
  placeholder = 'Search…',
  hidden = {},
  submitLabel = 'Search',
  showSubmit = true,
  className = '',
  widthClass = 'w-64',
}: {
  name?: string;
  defaultValue?: string;
  placeholder?: string;
  hidden?: Record<string, string | undefined>;
  submitLabel?: string;
  showSubmit?: boolean;
  className?: string;
  widthClass?: string;
}) {
  return (
    <form role="search" className={`flex items-center gap-2 ${className}`}>
      {Object.entries(hidden).map(([k, v]) =>
        v ? <input key={k} type="hidden" name={k} value={v} /> : null,
      )}
      <div className="group relative flex items-center">
        <span className="pointer-events-none absolute left-3 text-[var(--color-stone)] transition-colors group-focus-within:text-[var(--color-gold-deep)]">
          <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
            <circle cx="9" cy="9" r="6.25" /><path d="m14 14 3.5 3.5" />
          </svg>
        </span>
        <input
          type="search"
          name={name}
          defaultValue={defaultValue}
          placeholder={placeholder}
          aria-label={placeholder}
          className={`${widthClass} h-11 rounded-full border border-[var(--color-line)] bg-[var(--color-porcelain)] pl-9 pr-4 text-sm text-[var(--color-ink)] outline-none transition-shadow placeholder:text-[var(--color-stone)] focus:border-[var(--color-gold)] focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-gold)_22%,transparent)] [&::-webkit-search-cancel-button]:appearance-none`}
        />
      </div>
      {showSubmit && (
        <button className="h-11 shrink-0 rounded-full bg-[var(--color-ink)] px-4 text-sm font-medium text-[var(--color-porcelain)] transition-colors hover:bg-[var(--color-ink-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]">
          {submitLabel}
        </button>
      )}
    </form>
  );
}
