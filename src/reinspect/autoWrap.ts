import type { ComponentType } from 'react'
import type { AutoDiscoverScope } from './types'
import { withReinspect } from './withReinspect'
import { getReinspectWrappedMetadata } from './wrapMarker'

export interface AutoWrapInspectableMetadata {
  componentName?: string
  fallbackName?: string
  scope: AutoDiscoverScope
}

export function autoWrapInspectable<P extends object>(
  Component: ComponentType<P>,
  metadata: AutoWrapInspectableMetadata,
): ComponentType<P> {
  const existingMetadata = getReinspectWrappedMetadata(Component)
  if (existingMetadata?.source === 'manual') {
    return Component
  }

  return withReinspect(Component, {
    source: 'auto',
    scope: metadata.scope,
    name: metadata.componentName,
    fallbackName: metadata.fallbackName,
  })
}
