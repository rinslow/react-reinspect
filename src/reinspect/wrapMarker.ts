import type { ComponentType } from 'react'
import type { AutoDiscoverScope } from './types'

export type ReinspectWrapSource = 'manual' | 'auto'

export interface ReinspectWrappedMetadata {
  source: ReinspectWrapSource
  scope: AutoDiscoverScope
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  original: ComponentType<any>
}

export const REINSPECT_WRAPPED_SYMBOL = Symbol.for('reinspect.wrapped')

export function getReinspectWrappedMetadata(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: ComponentType<any>,
): ReinspectWrappedMetadata | undefined {
  const maybeMetadata = (
    component as unknown as {
      [REINSPECT_WRAPPED_SYMBOL]?: ReinspectWrappedMetadata
    }
  )[REINSPECT_WRAPPED_SYMBOL]

  return maybeMetadata
}
