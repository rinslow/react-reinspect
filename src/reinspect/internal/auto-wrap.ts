import type { ComponentType } from 'react'
import type { AutoDiscoverScope } from '../types'
import { withReinspectInternal } from '../react/wrap'
import { getReinspectWrappedMetadata } from '../wrapMarker'

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

  const internalOptions: Parameters<typeof withReinspectInternal<P>>[1] = {
    source: 'auto',
    scope: metadata.scope,
  }
  if (metadata.componentName) {
    internalOptions.componentName = metadata.componentName
  }
  if (metadata.fallbackName) {
    internalOptions.fallbackName = metadata.fallbackName
  }

  return withReinspectInternal(Component, internalOptions)
}
