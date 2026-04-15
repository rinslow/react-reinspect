# react-reinspect
Inspect and tweak React components live, directly in your running app.

[![npm version](https://img.shields.io/npm/v/react-reinspect.svg)](https://www.npmjs.com/package/react-reinspect)
[![npm downloads](https://img.shields.io/npm/dm/react-reinspect.svg)](https://www.npmjs.com/package/react-reinspect)
[![license](https://img.shields.io/npm/l/react-reinspect.svg)](./LICENSE)

`react-reinspect` is built for fast in-context debugging:
- See component boundaries in the UI.
- Right-click components and edit style props live.
- Inspect and override props without changing source.
- Track rerenders while you interact with the real screen.

![react-reinspect runtime inspector example](https://github.com/rinslow/react-reinspect/raw/refs/heads/main/docs/assets/reinspect-showcase-demo-app.mp4)

## Install

```bash
pnpm add react-reinspect
```

Peer deps:
- `react >= 18`
- `react-dom >= 18`

## Quick Start (Vite)

```tsx
import { ReinspectProvider, type ReinspectConfig } from 'react-reinspect'
import 'react-reinspect/style.css'

const reinspectConfig: ReinspectConfig = {
  enabled: import.meta.env.DEV, // keep it dev-only
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <ReinspectProvider config={reinspectConfig}>{children}</ReinspectProvider>
}
```

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { reinspectAutoDiscoverPlugin } from 'react-reinspect/vite-plugin'

export default defineConfig({
  plugins: [reinspectAutoDiscoverPlugin(), react()],
})
```

## Next.js (webpack mode)

```ts
// next.config.ts
import { withReinspectAutoDiscover } from 'react-reinspect/next-plugin'

const nextConfig = {}
export default withReinspectAutoDiscover(nextConfig)
```

If your dev server uses Turbopack, use manual wrapping via `withReinspect` or switch dev to webpack (`next dev --webpack`) for auto-discovery transforms.

## Use It

1. Open your app in dev mode.
2. Click the `Reinspect settings` button.
3. Right-click a component.
4. Edit CSS/Props and enable rerender counters as needed.

## API

- `ReinspectProvider`  
  Wrap your app root:
  ```tsx
  <ReinspectProvider config={...}>{children}</ReinspectProvider>
  ```

- `withReinspect(Component, options?)`  
  Manual wrapper if you don’t use transform plugins.

- `ReinspectConfig` (common options)
  - `enabled` (`boolean`, default `false`)
  - `inspectMode` (`'wrapped' | 'first-party' | 'all'`, default `'wrapped'`)
  - `editableProps` (`EditableStyleProp[]`)
  - `renderCounters` (`'off' | 'attempts' | 'commits' | 'both'`)

## Production Safety

- Production-safe by default (`enabled: false`).
- Recommended: explicitly gate with `import.meta.env.DEV` (Vite) or `process.env.NODE_ENV !== 'production'` (Next.js).

## Development

```bash
pnpm dev
pnpm test
pnpm build:lib
```

## License

MIT
