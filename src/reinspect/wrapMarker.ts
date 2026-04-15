import type { ComponentType } from 'react'
import type { AutoDiscoverScope } from './types'

type ComponentProps = Record<string, unknown>

export type ReinspectWrapSource = 'manual' | 'auto'

export interface ReinspectWrappedMetadata<P extends object = ComponentProps> {
  source: ReinspectWrapSource
  scope: AutoDiscoverScope
  original: ComponentType<P>
}

export const REINSPECT_WRAPPED_SYMBOL = Symbol.for('reinspect.wrapped')

type WrappedMarkerCarrier<P extends object> = ComponentType<P> & {
  [REINSPECT_WRAPPED_SYMBOL]?: ReinspectWrappedMetadata<P>
}

export function getReinspectWrappedMetadata<P extends object>(
  component: ComponentType<P>,
): ReinspectWrappedMetadata<P> | undefined {
  return (component as WrappedMarkerCarrier<P>)[REINSPECT_WRAPPED_SYMBOL]
}

export function setReinspectWrappedMetadata<P extends object>(
  component: ComponentType<P>,
  metadata: ReinspectWrappedMetadata<P>,
): void {
  ;(component as WrappedMarkerCarrier<P>)[REINSPECT_WRAPPED_SYMBOL] = metadata
}
