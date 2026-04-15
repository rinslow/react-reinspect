import type { CSSProperties, Dispatch, ReactNode, SetStateAction } from 'react'

export type InspectMode = 'wrapped' | 'first-party' | 'all'
export type AutoDiscoverScope = 'first-party' | 'third-party'
export type RenderCounterMode = 'off' | 'attempts' | 'commits' | 'both'

export type EditableStyleProp =
  | 'backgroundColor'
  | 'color'
  | 'fontSize'
  | 'padding'
  | 'margin'
  | 'borderRadius'
  | 'borderWidth'
  | 'borderColor'
  | 'opacity'
  | 'width'
  | 'height'
  | 'gap'

export type StyleOverrideValue = string | number

export type ComponentStyleOverrides = Partial<
  Record<EditableStyleProp, StyleOverrideValue>
>

interface LegacyReinspectConfig {
  /**
   * @deprecated Use `renderCounters` instead.
   */
  shouldCountRenders?: boolean
  /**
   * @deprecated Use `renderCounters` instead.
   */
  renderCaptureMode?: Exclude<RenderCounterMode, 'off'>
}

export interface ReinspectConfig extends LegacyReinspectConfig {
  enabled?: boolean
  startActive?: boolean
  showFloatingToggle?: boolean
  inspectMode?: InspectMode
  editableProps?: readonly EditableStyleProp[]
  palette?: readonly string[]
  zIndexBase?: number
  renderCounters?: RenderCounterMode
  countRendersForComponents?: readonly string[]
}

export interface ResolvedReinspectConfig {
  enabled: boolean
  startActive: boolean
  showFloatingToggle: boolean
  inspectMode: InspectMode
  editableProps: readonly EditableStyleProp[]
  palette: readonly string[]
  zIndexBase: number
  renderCounters: RenderCounterMode
  countRendersForComponents: readonly string[]
}

export interface ReinspectContextValue {
  config: ResolvedReinspectConfig
  isActive: boolean
  setIsActive: Dispatch<SetStateAction<boolean>>
  inspectMode: InspectMode
  pendingInspectMode: InspectMode
  setPendingInspectMode: Dispatch<SetStateAction<InspectMode>>
  hasPendingInspectModeChange: boolean
  applyInspectMode: () => void
  renderCounterMode: RenderCounterMode
  setRenderCounterMode: Dispatch<SetStateAction<RenderCounterMode>>
  renderCountComponents: Record<string, true>
  setRenderCountingForComponent: (componentName: string, enabled: boolean) => void
  isRenderCountingEnabledFor: (componentName: string) => boolean
  overrides: Record<string, ComponentStyleOverrides>
  updateOverride: (
    componentId: string,
    prop: EditableStyleProp,
    value: StyleOverrideValue | undefined,
  ) => void
  getBorderColor: (componentName: string) => string
}

export interface ReinspectProviderProps {
  children: ReactNode
  config?: ReinspectConfig
}

export type InlineStyleOverrides = CSSProperties
