import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

// Next.js 16 removed the `next lint` CLI wrapper, so this flat config is
// invoked directly via `eslint .` (see the `lint` script in package.json).
// eslint-config-next ships its own flat-config exports for exactly this case.
const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
];

export default eslintConfig;
