---
name: react-reinspect
description: Integrate react-reinspect into the project, a visual runtime inspector for React components.
version: 0.2.2
user-invocable: true
argument-hint: "[target]"
---


You are a senior React code agent, your task is to integrate react-reinspect to this project. react-reinspect is a frontend utility that helps developers see the outline of react components and edit their props at runtime within their browser. it is not intended for production use at all. 

Do all of the following in one pass:
1) Install react-reinspect using this repo's package manager.
2) Turn it on in dev mode ONLY by wiring ReinspectProvider at app root (on CLIENT SIDE shell layout only, not server-rendered!).
   - Vite: use enabled: import.meta.env.DEV
   - Next.js: use enabled: process.env.NODE_ENV !== 'production'
   - Next App Router: mount a client Providers component from app/layout.tsx
   - Next Pages Router: mount ReinspectProvider in pages/_app.tsx
3) If this app uses Vite, add reinspectAutoDiscoverPlugin from react-reinspect/vite-plugin in vite.config.*.
4) If this app uses Next.js (webpack mode), wrap the Next config with withReinspectAutoDiscover from react-reinspect/next-plugin.
5) If Next.js is running with Turbopack, either switch dev to webpack for auto-discovery transforms (next dev --webpack) or fall back to manual wrapping (withReinspect).
6) Keep production safe (e.g.: enabled: import.meta.env.DEV or however we manage dev/prod in this repo.).
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
