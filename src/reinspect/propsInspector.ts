import type { PropsSerializationMode } from './types'

const MAX_SERIALIZE_DEPTH = 4
const MAX_SERIALIZE_OBJECT_KEYS = 40
const MAX_SERIALIZE_ARRAY_ITEMS = 40

export const REINSPECT_PLACEHOLDER_KEY = '__reinspect_placeholder__'
export const REINSPECT_PLACEHOLDER_DISPLAY_NAME_KEY =
  '__reinspect__displayName__'

const LEGACY_REINSPECT_PLACEHOLDER_DISPLAY_KEY = 'display'

type PlaceholderKind =
  | 'function'
  | 'symbol'
  | 'bigint'
  | 'undefined'
  | 'date'
  | 'regexp'
  | 'non-finite-number'
  | 'circular'
  | 'truncated'
  | 'unsupported'

interface PlaceholderValue {
  [REINSPECT_PLACEHOLDER_KEY]?: PlaceholderKind
  [REINSPECT_PLACEHOLDER_DISPLAY_NAME_KEY]?: string
  [LEGACY_REINSPECT_PLACEHOLDER_DISPLAY_KEY]?: string
}

export type InspectedValueKind =
  | 'null'
  | 'undefined'
  | 'boolean'
  | 'number'
  | 'string'
  | 'bigint'
  | 'symbol'
  | 'function'
  | 'date'
  | 'regexp'
  | 'array'
  | 'object'
  | 'unknown'

export interface InspectedFunctionMeta {
  name: string
  arity: number
  preview: string
  source: string
}

export interface InspectedValueDescriptor {
  kind: InspectedValueKind
  summary: string
  copyText?: string
  functionMeta?: InspectedFunctionMeta
}

export interface DetectedPropsRow {
  key: string
  value: InspectedValueDescriptor
}

interface SerializationOptions {
  mode?: PropsSerializationMode
}

const OMIT_SERIALIZATION = Symbol('reinspect.omitSerialization')

const REACT_ELEMENT_INTERNAL_KEYS = new Set([
  '$$typeof',
  '_owner',
  '_store',
  '_self',
  '_source',
])

function buildPlaceholder(
  _kind: PlaceholderKind,
  displayName: string,
): PlaceholderValue {
  return {
    [REINSPECT_PLACEHOLDER_DISPLAY_NAME_KEY]: displayName,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function isPlaceholderObject(value: unknown): value is PlaceholderValue {
  if (!isRecord(value)) {
    return false
  }

  const placeholderKind = value[REINSPECT_PLACEHOLDER_KEY]
  if (placeholderKind !== undefined && typeof placeholderKind !== 'string') {
    return false
  }

  const displayName = value[REINSPECT_PLACEHOLDER_DISPLAY_NAME_KEY]
  if (displayName !== undefined && typeof displayName !== 'string') {
    return false
  }

  const legacyDisplayName = value[LEGACY_REINSPECT_PLACEHOLDER_DISPLAY_KEY]
  if (legacyDisplayName !== undefined && typeof legacyDisplayName !== 'string') {
    return false
  }

  return typeof placeholderKind === 'string' || typeof displayName === 'string'
}

function stringifyJson(value: unknown): string | null {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return null
  }
}

function getFunctionSource(input: (...args: unknown[]) => unknown): string {
  try {
    const source = Function.prototype.toString.call(input)
    if (typeof source !== 'string' || source.trim().length === 0) {
      return '[Function source unavailable]'
    }

    return source
  } catch {
    return '[Function source unavailable]'
  }
}

function getFunctionPreview(source: string): string {
  const compact = source.replace(/\s+/g, ' ').trim()
  if (compact.length <= 120) {
    return compact
  }

  return `${compact.slice(0, 117)}...`
}

function resolveSerializationMode(
  options?: SerializationOptions,
): PropsSerializationMode {
  return options?.mode === 'complete' ? 'complete' : 'distilled'
}

function isReactElementLikeRecord(value: Record<string, unknown>): boolean {
  return '$$typeof' in value && 'props' in value
}

function getSerializableObjectEntries(
  value: Record<string, unknown>,
  mode: PropsSerializationMode,
): Array<[string, unknown]> {
  const entries = Object.entries(value)
  if (mode !== 'distilled' || !isReactElementLikeRecord(value)) {
    return entries
  }

  return entries.filter(([key]) => !REACT_ELEMENT_INTERNAL_KEYS.has(key))
}

function toJsonSerializable(
  value: unknown,
  stack: WeakSet<object>,
  depth: number,
  mode: PropsSerializationMode,
): unknown | typeof OMIT_SERIALIZATION {
  const placeholder = (kind: PlaceholderKind, displayName: string) =>
    mode === 'complete'
      ? buildPlaceholder(kind, displayName)
      : OMIT_SERIALIZATION

  if (depth > MAX_SERIALIZE_DEPTH) {
    return placeholder('truncated', '[Max depth reached]')
  }

  if (value === null) {
    return null
  }

  const valueType = typeof value

  if (valueType === 'string' || valueType === 'boolean') {
    return value
  }

  if (valueType === 'number') {
    return Number.isFinite(value as number)
      ? value
      : placeholder('non-finite-number', String(value))
  }

  if (valueType === 'undefined') {
    return placeholder('undefined', 'undefined')
  }

  if (valueType === 'bigint') {
    return placeholder('bigint', `${String(value)}n`)
  }

  if (valueType === 'symbol') {
    return placeholder('symbol', String(value))
  }

  if (valueType === 'function') {
    const fn = value as (...args: unknown[]) => unknown
    return placeholder('function', `[Function ${fn.name || 'anonymous'}]`)
  }

  if (value instanceof Date) {
    return placeholder(
      'date',
      Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString(),
    )
  }

  if (value instanceof RegExp) {
    return placeholder('regexp', value.toString())
  }

  if (valueType === 'object') {
    const objectValue = value as object
    if (stack.has(objectValue)) {
      return placeholder('circular', '[Circular]')
    }

    stack.add(objectValue)

    if (Array.isArray(value)) {
      const serializedArray: unknown[] = []
      const maxItems = Math.min(value.length, MAX_SERIALIZE_ARRAY_ITEMS)

      for (let index = 0; index < maxItems; index += 1) {
        const serializedItem = toJsonSerializable(value[index], stack, depth + 1, mode)
        if (serializedItem === OMIT_SERIALIZATION) {
          continue
        }

        serializedArray.push(serializedItem)
      }

      if (value.length > MAX_SERIALIZE_ARRAY_ITEMS) {
        const truncatedPlaceholder = placeholder(
          'truncated',
          `${value.length - MAX_SERIALIZE_ARRAY_ITEMS} more items`,
        )
        if (truncatedPlaceholder !== OMIT_SERIALIZATION) {
          serializedArray.push(truncatedPlaceholder)
        }
      }

      stack.delete(objectValue)
      return serializedArray
    }

    const serializedObject: Record<string, unknown> = {}
    const entries = getSerializableObjectEntries(
      value as Record<string, unknown>,
      mode,
    )
    const maxEntries = Math.min(entries.length, MAX_SERIALIZE_OBJECT_KEYS)

    for (let index = 0; index < maxEntries; index += 1) {
      const entry = entries[index]
      if (!entry) {
        continue
      }

      const [key, nestedValue] = entry
      const serializedNested = toJsonSerializable(
        nestedValue,
        stack,
        depth + 1,
        mode,
      )
      if (serializedNested === OMIT_SERIALIZATION) {
        continue
      }

      serializedObject[key] = serializedNested
    }

    if (entries.length > MAX_SERIALIZE_OBJECT_KEYS) {
      const truncatedPlaceholder = placeholder(
        'truncated',
        `${entries.length - MAX_SERIALIZE_OBJECT_KEYS} more keys`,
      )
      if (truncatedPlaceholder !== OMIT_SERIALIZATION) {
        serializedObject.__reinspect_truncated__ = truncatedPlaceholder
      }
    }

    stack.delete(objectValue)
    return serializedObject
  }

  return placeholder('unsupported', '[Unsupported value]')
}

function describeValueShallow(value: unknown): InspectedValueDescriptor {
  if (value === null) {
    return {
      kind: 'null',
      summary: 'null',
      copyText: 'null',
    }
  }

  const valueType = typeof value

  if (valueType === 'undefined') {
    return {
      kind: 'undefined',
      summary: 'undefined',
      copyText: 'undefined',
    }
  }

  if (valueType === 'boolean') {
    return {
      kind: 'boolean',
      summary: String(value),
      copyText: String(value),
    }
  }

  if (valueType === 'number') {
    return {
      kind: 'number',
      summary: String(value),
      copyText: String(value),
    }
  }

  if (valueType === 'string') {
    return {
      kind: 'string',
      summary: JSON.stringify(value),
      copyText: String(value),
    }
  }

  if (valueType === 'bigint') {
    return {
      kind: 'bigint',
      summary: `${String(value)}n`,
      copyText: `${String(value)}n`,
    }
  }

  if (valueType === 'symbol') {
    const symbolText = String(value)
    return {
      kind: 'symbol',
      summary: symbolText,
      copyText: symbolText,
    }
  }

  if (valueType === 'function') {
    const fn = value as (...args: unknown[]) => unknown
    const source = getFunctionSource(fn)
    const fnName = fn.name || 'anonymous'
    return {
      kind: 'function',
      summary: `Function ${fnName}(${fn.length})`,
      copyText: source,
      functionMeta: {
        name: fnName,
        arity: fn.length,
        preview: getFunctionPreview(source),
        source,
      },
    }
  }

  if (value instanceof Date) {
    const dateText = Number.isNaN(value.getTime())
      ? 'Invalid Date'
      : value.toISOString()
    return {
      kind: 'date',
      summary: `Date ${dateText}`,
      copyText: dateText,
    }
  }

  if (value instanceof RegExp) {
    const regexpText = value.toString()
    return {
      kind: 'regexp',
      summary: regexpText,
      copyText: regexpText,
    }
  }

  if (Array.isArray(value)) {
    return {
      kind: 'array',
      summary: `Array(${value.length})`,
    }
  }

  if (isRecord(value)) {
    const keyCount = Object.keys(value).length
    return {
      kind: 'object',
      summary: `Object(${keyCount})`,
    }
  }

  return {
    kind: 'unknown',
    summary: String(value),
  }
}

function sanitizeParsedValue(value: unknown): unknown | undefined {
  if (isPlaceholderObject(value)) {
    return undefined
  }

  if (Array.isArray(value)) {
    const nextArray: unknown[] = []

    for (const item of value) {
      const sanitizedItem = sanitizeParsedValue(item)
      if (sanitizedItem === undefined) {
        return undefined
      }

      nextArray.push(sanitizedItem)
    }

    return nextArray
  }

  if (isRecord(value)) {
    const nextObject: Record<string, unknown> = {}
    for (const [key, nestedValue] of Object.entries(value)) {
      const sanitizedNestedValue = sanitizeParsedValue(nestedValue)
      if (sanitizedNestedValue === undefined) {
        continue
      }

      nextObject[key] = sanitizedNestedValue
    }

    return nextObject
  }

  return value
}

export function buildDetectedPropsRows(
  props: Record<string, unknown>,
): DetectedPropsRow[] {
  return Object.keys(props).map((key) => ({
    key,
    value: describeValueShallow(props[key]),
  }))
}

export function serializePropsForRawEditor(
  props: Record<string, unknown>,
  options?: SerializationOptions,
): string {
  const serialized = toJsonSerializable(
    props,
    new WeakSet<object>(),
    0,
    resolveSerializationMode(options),
  )
  if (serialized === OMIT_SERIALIZATION) {
    return '{}'
  }

  return stringifyJson(serialized) ?? '{}'
}

export function serializeValueForJson(
  value: unknown,
  options?: SerializationOptions,
): string | null {
  const serialized = toJsonSerializable(
    value,
    new WeakSet<object>(),
    0,
    resolveSerializationMode(options),
  )
  if (serialized === OMIT_SERIALIZATION) {
    return null
  }

  return stringifyJson(
    serialized,
  )
}

export function isEditablePropValue(value: unknown): boolean {
  if (value === null) {
    return true
  }

  const valueType = typeof value
  if (
    valueType === 'string' ||
    valueType === 'number' ||
    valueType === 'boolean'
  ) {
    return true
  }

  if (Array.isArray(value)) {
    return true
  }

  return isPlainObject(value)
}

export function parseEditablePropValueInput(input: string): {
  parsed: unknown | null
  error: string | null
} {
  const trimmed = input.trim()
  if (trimmed.length === 0) {
    return {
      parsed: null,
      error: 'Value JSON cannot be empty.',
    }
  }

  try {
    const parsedValue = JSON.parse(trimmed) as unknown
    const sanitizedValue = sanitizeParsedValue(parsedValue)

    if (sanitizedValue === undefined || !isEditablePropValue(sanitizedValue)) {
      return {
        parsed: null,
        error: 'Only objects, arrays, and primitive JSON values are editable.',
      }
    }

    return {
      parsed: sanitizedValue,
      error: null,
    }
  } catch {
    return {
      parsed: null,
      error: 'Invalid JSON. Fix syntax and try Apply again.',
    }
  }
}

export function parsePropsOverridesInput(input: string): {
  parsed: Record<string, unknown> | null
  error: string | null
} {
  const trimmed = input.trim()
  if (trimmed.length === 0) {
    return {
      parsed: {},
      error: null,
    }
  }

  try {
    const parsedValue = JSON.parse(trimmed) as unknown
    if (
      parsedValue === null ||
      typeof parsedValue !== 'object' ||
      Array.isArray(parsedValue)
    ) {
      return {
        parsed: null,
        error: 'Props JSON must be an object (example: {"title":"Demo"}).',
      }
    }

    const sanitizedObject: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(
      parsedValue as Record<string, unknown>,
    )) {
      const sanitizedValue = sanitizeParsedValue(value)
      if (sanitizedValue === undefined) {
        continue
      }

      sanitizedObject[key] = sanitizedValue
    }

    return {
      parsed: sanitizedObject,
      error: null,
    }
  } catch {
    return {
      parsed: null,
      error: 'Invalid JSON. Fix syntax and try Apply again.',
    }
  }
}
