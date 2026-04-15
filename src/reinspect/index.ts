'use client'

import './reinspect.css'
import reinspectStyles from './reinspect.css?inline'
import { injectReinspectStyles } from './injectStyles'

injectReinspectStyles(reinspectStyles)

export { ReinspectProvider } from './context'
export { useReinspect } from './useReinspect'
export { withReinspect } from './withReinspect'

export type {
  InspectMode,
  RenderCounterMode,
  ReinspectConfig,
  ResolvedReinspectConfig,
} from './types'

export type { WithReinspectOptions } from './withReinspect'
