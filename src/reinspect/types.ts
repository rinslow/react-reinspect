import type { CSSProperties, Dispatch, ReactNode, SetStateAction } from 'react'

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
  editableProps?: EditableStyleProp[]
  palette?: string[]
  zIndexBase?: number
}

export interface ResolvedReinspectConfig {
  enabled: boolean
  startActive: boolean
  showFloatingToggle: boolean
  editableProps: EditableStyleProp[]
  palette: string[]
  zIndexBase: number
}

export interface ReinspectContextValue {
  config: ResolvedReinspectConfig
  isActive: boolean
  setIsActive: Dispatch<SetStateAction<boolean>>
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
