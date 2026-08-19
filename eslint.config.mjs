// BLD-1214: Next 16 removed `next lint`, which broke the repo's documented
// lint gate (`npm run lint` errored before running any rule). ESLint now runs
// directly with the same next/core-web-vitals rule set, which
// eslint-config-next v16 ships as a native flat-config array.
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'qa-output/**',
      'public/**',
      'prisma/migrations/**',
      'next-env.d.ts',
    ],
  },
  ...nextCoreWebVitals,
  {
    // react-hooks v6 (bundled with eslint-config-next 16) introduced a set of
    // compiler-era rules that `next lint` never enforced — the existing code
    // was written under the old rule set, so they fire ~150 times on day one.
    // They stay ON as warnings (visible, fixable incrementally, and new code
    // reviews can hold the line) rather than erroring every session's lint
    // run for pre-existing patterns. Genuine errors (unescaped entities,
    // <a> to internal pages, etc.) keep their error level.
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
    },
  },
];
