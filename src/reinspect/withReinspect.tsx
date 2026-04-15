import type { ComponentType } from 'react'
import { withReinspectInternal } from './react/wrap'

export interface WithReinspectOptions {
  name?: string
}

export function withReinspect<P extends object>(
  Component: ComponentType<P>,
  options?: WithReinspectOptions,
): ComponentType<P> {
  const internalOptions: Parameters<typeof withReinspectInternal<P>>[1] = {
    source: 'manual',
    scope: 'first-party',
  }

  if (options?.name) {
    internalOptions.componentName = options.name
  }

  return withReinspectInternal(Component, internalOptions)
}
