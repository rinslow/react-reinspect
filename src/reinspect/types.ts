import type { CSSProperties, Dispatch, ReactNode, SetStateAction } from 'react'

export type InspectMode = 'wrapped' | 'first-party' | 'all'
export type AutoDiscoverScope = 'first-party' | 'third-party'
export type RenderCounterMode = 'off' | 'attempts' | 'commits' | 'both'
export type PropsSerializationMode = 'distilled' | 'complete'
export type MenuTheme = 'light' | 'dark'
export type MenuOpenTriggerMode = 'right-click' | 'modifier-right-click'

export interface MenuOpenModifiers {
  ctrl: boolean
  alt: boolean
  shift: boolean
  meta: boolean
}

export interface MenuOpenGesture {
  mode: MenuOpenTriggerMode
  modifiers: MenuOpenModifiers
}

export interface MenuOpenGestureConfig {
  mode?: MenuOpenTriggerMode
  modifiers?: Partial<MenuOpenModifiers>
}

export interface InspectFilter {
  patterns: readonly string[]
  regex: boolean
  wholeWord: boolean
  matchCase: boolean
}

export type InspectFilterConfig = Partial<InspectFilter>

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
  inspectWhitelist?: InspectFilterConfig
  inspectBlacklist?: InspectFilterConfig
  editableProps?: readonly EditableStyleProp[]
  zIndexBase?: number
  renderCounters?: RenderCounterMode
  countRendersForComponents?: readonly string[]
  propsSerializationMode?: PropsSerializationMode
  menuTheme?: MenuTheme
  menuOpenGesture?: MenuOpenGestureConfig
}

export interface ResolvedReinspectConfig {
  enabled: boolean
  startActive: boolean
  showFloatingToggle: boolean
  inspectMode: InspectMode
  inspectWhitelist: InspectFilter
  inspectBlacklist: InspectFilter
  editableProps: readonly EditableStyleProp[]
  zIndexBase: number
  renderCounters: RenderCounterMode
  countRendersForComponents: readonly string[]
  propsSerializationMode: PropsSerializationMode
  menuTheme: MenuTheme
  menuOpenGesture: MenuOpenGesture
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
  inspectWhitelist: InspectFilter
  setInspectWhitelist: Dispatch<SetStateAction<InspectFilter>>
  inspectWhitelistInvalidPatterns: readonly string[]
  inspectBlacklist: InspectFilter
  setInspectBlacklist: Dispatch<SetStateAction<InspectFilter>>
  inspectBlacklistInvalidPatterns: readonly string[]
  isComponentInspectableByFilters: (componentName: string) => boolean
  renderCounterMode: RenderCounterMode
  setRenderCounterMode: Dispatch<SetStateAction<RenderCounterMode>>
  propsSerializationMode: PropsSerializationMode
  setPropsSerializationMode: Dispatch<SetStateAction<PropsSerializationMode>>
  menuTheme: MenuTheme
  setMenuTheme: Dispatch<SetStateAction<MenuTheme>>
  menuOpenGesture: MenuOpenGesture
  setMenuOpenGesture: Dispatch<SetStateAction<MenuOpenGesture>>
  renderCountComponents: Record<string, true>
  setRenderCountingForComponent: (componentName: string, enabled: boolean) => void
  isRenderCountingEnabledFor: (componentName: string) => boolean
  overrides: Record<string, ComponentStyleOverrides>
  updateOverride: (
    componentId: string,
    prop: EditableStyleProp,
    value: StyleOverrideValue | undefined,
  ) => void
  getColor: (componentName: string) => string
}

export interface ReinspectProviderProps {
  children: ReactNode
  config?: ReinspectConfig
}

export type InlineStyleOverrides = CSSProperties
