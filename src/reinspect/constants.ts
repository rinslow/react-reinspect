import type { EditableStyleProp } from './types'

export const DEFAULT_EDITABLE_PROPS: EditableStyleProp[] = [
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

export const DEFAULT_PALETTE = [
  '#f97316',
  '#2563eb',
  '#16a34a',
  '#db2777',
  '#ca8a04',
  '#0f766e',
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
