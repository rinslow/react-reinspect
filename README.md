# react-reinspect
Runtime React inspector for real apps.

`react-reinspect` helps you inspect components directly in your running UI:
- See component boundaries and names.
- Right-click any wrapped component to edit style props live.
- Inspect and override props at runtime.
- Track rerenders by attempts, commits, or both.

[![npm version](https://img.shields.io/npm/v/react-reinspect.svg)](https://www.npmjs.com/package/react-reinspect)
[![npm downloads](https://img.shields.io/npm/dm/react-reinspect.svg)](https://www.npmjs.com/package/react-reinspect)
[![license](https://img.shields.io/npm/l/react-reinspect.svg)](./LICENSE)

## Why This Exists

React DevTools is excellent for component trees and profiling.  
`react-reinspect` is optimized for *in-context debugging in the page itself*:

- Inspect where a component lives visually.
- Tune common style props instantly.
- Test prop overrides without editing source first.
- Spot rerender hotspots while interacting with the real UI.

## Features

- Runtime overlay + floating settings panel.
- Right-click inspector menu per component.
- CSS prop editing:
  - `backgroundColor`, `color`, `fontSize`, `padding`, `margin`, `borderRadius`, `borderWidth`, `borderColor`, `opacity`, `width`, `height`, `gap`
- Props inspector:
  - `Detected` view for readable values
  - `Raw` JSON editor for direct overrides
  - Function preview + copy source
  - JSON preview + copy for object/array props
- Render counting:
  - Global toggle or per-component toggle
  - Capture mode: `attempts` | `commits` | `both`
- Flexible wrapping:
  - `withReinspect(...)`
  - auto-discovery wrapping via `reinspectAutoDiscoverPlugin(...)` / `withReinspectAutoDiscover(...)`

## Install

```bash
pnpm add react-reinspect
```

Peer dependencies:
- `react >= 18`
- `react-dom >= 18`

Styles are auto-injected when `react-reinspect` loads.  
If your app enforces strict CSP and blocks inline styles, import this once in your app root:

```tsx
import 'react-reinspect/style.css'
```

Auto-discovery is compile-time and requires the Vite plugin:

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { reinspectAutoDiscoverPlugin } from 'react-reinspect/vite-plugin'

export default defineConfig({
  plugins: [reinspectAutoDiscoverPlugin({ include: 'first-party' }), react()],
})
```

Without this plugin, only manually wrapped components (`withReinspect`) are inspectable.

Next.js (webpack mode) can use:

```ts
// next.config.ts
import { withReinspectAutoDiscover } from 'react-reinspect/next-plugin'

const nextConfig = {}

export default withReinspectAutoDiscover(nextConfig)
```

If your Next dev server runs with Turbopack, switch to webpack mode for this transform plugin.


## Example

![react-reinspect runtime inspector example](https://cdn.jsdelivr.net/npm/react-reinspect@latest/docs/assets/screenshot-example.png)

## Screenshots

### Runtime inspector in-app

![react-reinspect overlay, props editor, and rerender badge](https://cdn.jsdelivr.net/npm/react-reinspect@latest/docs/assets/screenshot-example.png)


## Agentic Quick Start

Use this prompt on your favorite AI coding agent.

```text
You are a senior React code agent, your task is to integrate react-reinspect to this project. react-reinspect is a frontend utility that helps developers see the outline of react components and edit their props at runtime within their browser. it is not intended for production use at all. 

Do all of the following in one pass:
1) Install `react-reinspect` using this repo's package manager.
2) Turn it on in dev mode ONLY by wiring `ReinspectProvider` at app root (on CLIENT SIDE only, not server-rendered!).
   - Vite: use `enabled: import.meta.env.DEV`
   - Next.js: use `enabled: process.env.NODE_ENV !== 'production'`
   - Next App Router: mount a client `Providers` component from `app/layout.tsx`
   - Next Pages Router: mount `ReinspectProvider` in `pages/_app.tsx`
3) If this app uses Vite, add `reinspectAutoDiscoverPlugin` from `react-reinspect/vite-plugin` in `vite.config.*`.
4) If this app uses Next.js (webpack mode), wrap the Next config with `withReinspectAutoDiscover` from `react-reinspect/next-plugin`.
5) If Next.js is running with Turbopack, either switch dev to webpack for auto-discovery transforms (`next dev --webpack`) or fall back to manual wrapping (`withReinspect`).
6) Keep production safe (e.g.: `enabled: import.meta.env.DEV` or however we manage dev/prod in this repo.).
7) Run validation (build/tests if available) and fix any issues.
8) Output a concise summary with changed files and how to use it.

Use this example as the baseline:

import { ReinspectProvider, type ReinspectConfig } from 'react-reinspect'
import 'react-reinspect/style.css'

const reinspectConfig: ReinspectConfig = {
  enabled: import.meta.env.DEV,
  // startActive: true,
  // showFloatingToggle: true,
  // inspectMode: 'wrapped',
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <ReinspectProvider config={reinspectConfig}>{children}</ReinspectProvider>
}

// Next.js App Router (app/providers.tsx)
'use client'
import { ReinspectProvider, type ReinspectConfig } from 'react-reinspect'
import 'react-reinspect/style.css'

const nextReinspectConfig: ReinspectConfig = {
  enabled: process.env.NODE_ENV !== 'production',
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ReinspectProvider config={nextReinspectConfig}>
      {children}
    </ReinspectProvider>
  )
}

// Next.js App Router mount (app/layout.tsx)
import { Providers } from './providers'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}

For auto-discovery setup, apply one of these depending on framework:

// Vite
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { reinspectAutoDiscoverPlugin } from 'react-reinspect/vite-plugin'

export default defineConfig({
  plugins: [reinspectAutoDiscoverPlugin(), react()],
})

// Next.js (webpack mode)
import { withReinspectAutoDiscover } from 'react-reinspect/next-plugin'

const nextConfig = {}
export default withReinspectAutoDiscover(nextConfig, {
  includeThirdParty: false,
})

// Next.js dev script for auto-discovery:
// package.json -> "dev": "next dev --webpack"

Output format I want from you:
- What changed (bullet list)
- Why this is safe in production
- How to run it locally
- 1 copy-paste PR title + PR description
```

## Manual Quick Start
### 1) Wrap your app with `ReinspectProvider`

Vite:

```tsx
import {
  ReinspectProvider,
  type ReinspectConfig,
} from 'react-reinspect'

const reinspectConfig: ReinspectConfig = {
  enabled: import.meta.env.DEV, // inspect in dev env, turn off in prod 
  // startActive: true, // start with inspector active when page loads
  // showFloatingToggle: true, // show floating react-reinspect settings button
  // inspectMode: 'wrapped', // wrapped: only wrapped components, first-party: wrapped + components with inspectable metadata, all: all components
  // editableProps: ['padding', 'margin'], // change the CSS props you can edit
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <ReinspectProvider config={reinspectConfig}>{children}</ReinspectProvider>
}
```

Next.js App Router:

```tsx
// app/providers.tsx
'use client'

import { ReinspectProvider, type ReinspectConfig } from 'react-reinspect'
import 'react-reinspect/style.css'

const reinspectConfig: ReinspectConfig = {
  enabled: process.env.NODE_ENV !== 'production',
  // startActive: true,
  // showFloatingToggle: true,
  // inspectMode: 'first-party',
}

export function Providers({ children }: { children: React.ReactNode }) {
  return <ReinspectProvider config={reinspectConfig}>{children}</ReinspectProvider>
}
```

```tsx
// app/layout.tsx
import { Providers } from './providers'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

Next.js Pages Router:

```tsx
// pages/_app.tsx
import type { AppProps } from 'next/app'
import { ReinspectProvider, type ReinspectConfig } from 'react-reinspect'
import 'react-reinspect/style.css'

const reinspectConfig: ReinspectConfig = {
  enabled: process.env.NODE_ENV !== 'production',
}

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ReinspectProvider config={reinspectConfig}>
      <Component {...pageProps} />
    </ReinspectProvider>
  )
}
```

### 2) Enable auto-discovery transforms (pick your framework)

Vite:

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { reinspectAutoDiscoverPlugin } from 'react-reinspect/vite-plugin'

export default defineConfig({
  plugins: [reinspectAutoDiscoverPlugin(), react()],
})
```

Next.js (webpack mode):

```ts
// next.config.ts
import { withReinspectAutoDiscover } from 'react-reinspect/next-plugin'

const nextConfig = {}
export default withReinspectAutoDiscover(nextConfig)
```

If your Next dev server runs with Turbopack, switch to webpack mode for auto-discovery transforms.
If you keep Turbopack enabled, skip the Next transform plugin and use manual wrapping (`withReinspect`) instead.

Next.js webpack dev script example:

```json
{
  "scripts": {
    "dev": "next dev --webpack"
  }
}
```

### 3) Use it in the browser

- Click `Reinspect settings` button.
- Right-click a wrapped component.
- Switch between `CSS` and `Props` tabs.
- Toggle rerender tracking when needed.

## API

### `ReinspectProvider`

Wrap your app root.

```tsx
<ReinspectProvider config={...}>{children}</ReinspectProvider>
```

### `ReinspectConfig`

| Option | Type | Default | Notes |
|---|---|---|---|
| `enabled` | `boolean` | `false` | Master on/off. |
| `startActive` | `boolean` | `true` | Initial inspector active state. |
| `showFloatingToggle` | `boolean` | `enabled` | Show built-in settings button. |
| `inspectMode` | `'wrapped' \| 'first-party' \| 'all'` | `'wrapped'` | Auto-wrap visibility behavior. |
| `editableProps` | `EditableStyleProp[]` | built-in defaults | CSS props editable in inspector. |
| `palette` | `string[]` | built-in defaults | Component outline/badge colors. |
| `zIndexBase` | `number` | `2147483000` | Overlay stacking baseline. |
| `renderCounters` | `'off' \| 'attempts' \| 'commits' \| 'both'` | `'off'` | Global render-counter mode. |
| `countRendersForComponents` | `string[]` | `[]` | Component-specific counting when global mode is `off`. |

### `withReinspect(Component, options?)`

Wrap a component manually.

`options`:
- `name?: string`

`wrapInspectableMap` remains available as an internal utility (`react-reinspect/dist` deep-import), but is no longer part of the stable public runtime API.

`autoWrapInspectable` is now internal-only and used by the transform plugins via `react-reinspect/internal/auto-wrap`.

### `useReinspect()`

Hook to read/update runtime inspector state from your own UI.

## Production Guidance

- Default behavior is production-safe (`enabled` defaults to `false`).
- If you want zero wrapper markup in production, gate wrapping at definition time:

```tsx
import { withReinspect } from 'react-reinspect'

const maybeWrap = <P extends object>(Component: React.ComponentType<P>) =>
  import.meta.env.DEV ? withReinspect(Component) : Component
```

## Development

```bash
pnpm dev
pnpm test
pnpm build:lib
```

## Publish (Maintainers)

This repo can contain a debug/template app, but npm publish only ships package artifacts via the `files` whitelist in `package.json`.

```bash
pnpm build:lib
pnpm pack:check
npm login
pnpm publish:npm
```
