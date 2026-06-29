// True ONLY in the static GitHub Pages demo export, where there are no /api
// routes (set via next.config.mjs `env` when GHPAGES=true). Portal forms gate
// their "pretend it worked" 404/503 fallbacks on this so the *live* site never
// fakes success — a real API 404/503 there is a genuine error the user must see
// (a transient 404 previously made the signup wizard show "account created"
// without creating an account, so clients couldn't sign in).
export const IS_STATIC_DEMO = process.env.NEXT_PUBLIC_STATIC_DEMO === 'true';
