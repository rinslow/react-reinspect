import type { EditableStyleProp } from './types'

export const DEFAULT_EDITABLE_PROPS: readonly EditableStyleProp[] = [
  'backgroundColor',
  'color',
  'fontSize',
  'padding',
  'margin',
  'borderRadius',
  'borderWidth',
  'borderColor',
  'opacity',
  'width',
  'height',
  'gap',
]

export const COLOR_STYLE_PROPS = new Set<EditableStyleProp>([
  'backgroundColor',
  'color',
  'borderColor',
])

export const NUMERIC_STYLE_PROPS = new Set<EditableStyleProp>([
  'fontSize',
  'padding',
  'margin',
  'borderRadius',
  'borderWidth',
  'width',
  'height',
  'gap',
])

export const OPACITY_STYLE_PROP: EditableStyleProp = 'opacity'
