import type { CSSProperties, Dispatch, ReactNode, SetStateAction } from 'react'

export type InspectMode = 'wrapped' | 'first-party' | 'all'
export type AutoDiscoverScope = 'first-party' | 'third-party'
export type RenderCaptureMode = 'attempts' | 'commits' | 'both'

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

export interface ReinspectConfig {
  enabled?: boolean
  startActive?: boolean
  showFloatingToggle?: boolean
  inspectMode?: InspectMode
  editableProps?: EditableStyleProp[]
  palette?: string[]
  zIndexBase?: number
  shouldCountRenders?: boolean
  countRendersForComponents?: string[]
  renderCaptureMode?: RenderCaptureMode
}

export interface ResolvedReinspectConfig {
  enabled: boolean
  startActive: boolean
  showFloatingToggle: boolean
  inspectMode: InspectMode
  editableProps: EditableStyleProp[]
  palette: string[]
  zIndexBase: number
  shouldCountRenders: boolean
  countRendersForComponents: string[]
  renderCaptureMode: RenderCaptureMode
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
  shouldCountRenders: boolean
  setShouldCountRenders: Dispatch<SetStateAction<boolean>>
  renderCaptureMode: RenderCaptureMode
  setRenderCaptureMode: Dispatch<SetStateAction<RenderCaptureMode>>
  renderCountComponents: Record<string, boolean>
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
