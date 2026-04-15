'use client'

import './reinspect.css'
import reinspectStyles from './reinspect.css?inline'
import { injectReinspectStyles } from './injectStyles'

injectReinspectStyles(reinspectStyles)

export { ReinspectProvider } from './context'
export { useReinspect } from './useReinspect'
export { withReinspect } from './withReinspect'

export type {
  InspectFilter,
  InspectFilterConfig,
  InspectMode,
  MenuOpenGesture,
  MenuOpenGestureConfig,
  MenuOpenModifiers,
  MenuOpenTriggerMode,
  PropsSerializationMode,
  RenderCounterMode,
  ReinspectConfig,
  ResolvedReinspectConfig,
} from './types'

export type { WithReinspectOptions } from './withReinspect'
