import type {
  ComponentStyleOverrides,
  EditableStyleProp,
  InspectFilter,
  InspectFilterConfig,
  InspectMode,
  MenuOpenGesture,
  MenuOpenGestureConfig,
  MenuOpenModifiers,
  MenuOpenTriggerMode,
  MenuTheme,
  PropsSerializationMode,
  RenderCounterMode,
  ReinspectConfig,
  ResolvedReinspectConfig,
} from './types'
import { DEFAULT_EDITABLE_PROPS } from './constants'

const FALLBACK_Z_INDEX = 2147483000
export const REINSPECT_INSPECT_MODE_STORAGE_KEY = 'reinspect.inspectMode'
export const REINSPECT_INSPECT_WHITELIST_STORAGE_KEY =
  'reinspect.inspectWhitelist'
export const REINSPECT_INSPECT_BLACKLIST_STORAGE_KEY =
  'reinspect.inspectBlacklist'
export const REINSPECT_PROPS_SERIALIZATION_MODE_STORAGE_KEY =
  'reinspect.propsSerializationMode'
export const REINSPECT_MENU_THEME_STORAGE_KEY = 'reinspect.menuTheme'
export const REINSPECT_MENU_OPEN_GESTURE_STORAGE_KEY = 'reinspect.menuOpenGesture'
export const DEFAULT_INSPECT_FILTER: InspectFilter = {
  patterns: [],
  regex: false,
  wholeWord: false,
  matchCase: false,
}
export const DEFAULT_MENU_OPEN_MODIFIERS: MenuOpenModifiers = {
  ctrl: false,
  alt: false,
  shift: true,
  meta: false,
}
export const DEFAULT_MENU_OPEN_GESTURE: MenuOpenGesture = {
  mode: 'right-click',
  modifiers: DEFAULT_MENU_OPEN_MODIFIERS,
}

const VALID_INSPECT_MODES: readonly InspectMode[] = [
  'wrapped',
  'first-party',
  'all',
]
const VALID_RENDER_COUNTER_MODES: readonly RenderCounterMode[] = [
  'off',
  'attempts',
  'commits',
  'both',
]
const VALID_PROPS_SERIALIZATION_MODES: readonly PropsSerializationMode[] = [
  'distilled',
  'complete',
]
const VALID_MENU_THEMES: readonly MenuTheme[] = ['light', 'dark']
const VALID_MENU_OPEN_TRIGGER_MODES: readonly MenuOpenTriggerMode[] = [
  'right-click',
  'modifier-right-click',
]

let didWarnAboutLegacyRenderConfig = false

export interface CompiledInspectFilterMatcher {
  hasPatterns: boolean
  invalidPatterns: readonly string[]
  matches: (componentName: string) => boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function warnAboutLegacyRenderConfig(): void {
  if (didWarnAboutLegacyRenderConfig || typeof console === 'undefined') {
    return
  }

  didWarnAboutLegacyRenderConfig = true
  console.warn(
    '[react-reinspect] `shouldCountRenders` and `renderCaptureMode` are deprecated. Use `renderCounters` instead.',
  )
}

export function isInspectMode(value: unknown): value is InspectMode {
  return (
    typeof value === 'string' &&
    VALID_INSPECT_MODES.includes(value as InspectMode)
  )
}

export function isRenderCounterMode(value: unknown): value is RenderCounterMode {
  return (
    typeof value === 'string' &&
    VALID_RENDER_COUNTER_MODES.includes(value as RenderCounterMode)
  )
}

export function isPropsSerializationMode(
  value: unknown,
): value is PropsSerializationMode {
  return (
    typeof value === 'string' &&
    VALID_PROPS_SERIALIZATION_MODES.includes(value as PropsSerializationMode)
  )
}

export function isMenuTheme(value: unknown): value is MenuTheme {
  return (
    typeof value === 'string' && VALID_MENU_THEMES.includes(value as MenuTheme)
  )
}

export function isMenuOpenTriggerMode(
  value: unknown,
): value is MenuOpenTriggerMode {
  return (
    typeof value === 'string' &&
    VALID_MENU_OPEN_TRIGGER_MODES.includes(value as MenuOpenTriggerMode)
  )
}

function normalizeMenuOpenModifiers(
  modifiers: Partial<MenuOpenModifiers> | undefined,
): MenuOpenModifiers {
  const normalized: MenuOpenModifiers = {
    ctrl: modifiers?.ctrl === true,
    alt: modifiers?.alt === true,
    shift: modifiers?.shift === true,
    meta: modifiers?.meta === true,
  }

  if (normalized.ctrl || normalized.alt || normalized.shift || normalized.meta) {
    return normalized
  }

  return { ...DEFAULT_MENU_OPEN_MODIFIERS }
}

function normalizeMenuOpenGesture(
  gesture: MenuOpenGestureConfig | MenuOpenGesture | undefined,
): MenuOpenGesture {
  return {
    mode: isMenuOpenTriggerMode(gesture?.mode)
      ? gesture.mode
      : DEFAULT_MENU_OPEN_GESTURE.mode,
    modifiers: normalizeMenuOpenModifiers(gesture?.modifiers),
  }
}

export function normalizeInspectFilter(
  filter: InspectFilterConfig | undefined,
): InspectFilter {
  const patterns: string[] = []
  if (Array.isArray(filter?.patterns)) {
    for (const rawPattern of filter.patterns) {
      if (typeof rawPattern !== 'string') {
        continue
      }

      const trimmedPattern = rawPattern.trim()
      if (trimmedPattern.length === 0) {
        continue
      }

      patterns.push(trimmedPattern)
    }
  }

  return {
    patterns,
    regex: filter?.regex === true,
    wholeWord: filter?.wholeWord === true,
    matchCase: filter?.matchCase === true,
  }
}

function readStoredInspectMode(): InspectMode | undefined {
  if (typeof window === 'undefined') {
    return undefined
  }

  try {
    const storedValue = window.sessionStorage.getItem(
      REINSPECT_INSPECT_MODE_STORAGE_KEY,
    )

    return isInspectMode(storedValue) ? storedValue : undefined
  } catch {
    return undefined
  }
}

export function resolveInspectMode(
  configInspectMode: InspectMode | undefined,
): InspectMode {
  const storedInspectMode = readStoredInspectMode()
  if (storedInspectMode) {
    return storedInspectMode
  }

  if (isInspectMode(configInspectMode)) {
    return configInspectMode
  }

  return 'wrapped'
}

export function persistInspectMode(mode: InspectMode): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.sessionStorage.setItem(REINSPECT_INSPECT_MODE_STORAGE_KEY, mode)
  } catch {
    // Best-effort persistence only.
  }
}

function readStoredInspectFilter(storageKey: string): InspectFilter | undefined {
  if (typeof window === 'undefined') {
    return undefined
  }

  try {
    const storedValue = window.sessionStorage.getItem(storageKey)
    if (!storedValue) {
      return undefined
    }

    const parsedValue = JSON.parse(storedValue) as unknown
    if (!isRecord(parsedValue)) {
      return undefined
    }

    return normalizeInspectFilter(parsedValue as InspectFilterConfig)
  } catch {
    return undefined
  }
}

function resolveInspectFilter(
  configFilter: InspectFilterConfig | undefined,
  storageKey: string,
): InspectFilter {
  const storedFilter = readStoredInspectFilter(storageKey)
  if (storedFilter) {
    return storedFilter
  }

  return normalizeInspectFilter(configFilter)
}

export function resolveInspectWhitelist(
  configFilter: InspectFilterConfig | undefined,
): InspectFilter {
  return resolveInspectFilter(
    configFilter,
    REINSPECT_INSPECT_WHITELIST_STORAGE_KEY,
  )
}

export function resolveInspectBlacklist(
  configFilter: InspectFilterConfig | undefined,
): InspectFilter {
  return resolveInspectFilter(
    configFilter,
    REINSPECT_INSPECT_BLACKLIST_STORAGE_KEY,
  )
}

function persistInspectFilter(
  storageKey: string,
  filter: InspectFilterConfig | InspectFilter,
): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const normalizedFilter = normalizeInspectFilter(filter)
    window.sessionStorage.setItem(storageKey, JSON.stringify(normalizedFilter))
  } catch {
    // Best-effort persistence only.
  }
}

export function persistInspectWhitelist(
  filter: InspectFilterConfig | InspectFilter,
): void {
  persistInspectFilter(REINSPECT_INSPECT_WHITELIST_STORAGE_KEY, filter)
}

export function persistInspectBlacklist(
  filter: InspectFilterConfig | InspectFilter,
): void {
  persistInspectFilter(REINSPECT_INSPECT_BLACKLIST_STORAGE_KEY, filter)
}

function readStoredPropsSerializationMode():
  | PropsSerializationMode
  | undefined {
  if (typeof window === 'undefined') {
    return undefined
  }

  try {
    const storedValue = window.sessionStorage.getItem(
      REINSPECT_PROPS_SERIALIZATION_MODE_STORAGE_KEY,
    )

    return isPropsSerializationMode(storedValue) ? storedValue : undefined
  } catch {
    return undefined
  }
}

export function resolvePropsSerializationMode(
  configMode: PropsSerializationMode | undefined,
): PropsSerializationMode {
  const storedMode = readStoredPropsSerializationMode()
  if (storedMode) {
    return storedMode
  }

  if (isPropsSerializationMode(configMode)) {
    return configMode
  }

  return 'distilled'
}

export function persistPropsSerializationMode(
  mode: PropsSerializationMode,
): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.sessionStorage.setItem(
      REINSPECT_PROPS_SERIALIZATION_MODE_STORAGE_KEY,
      mode,
    )
  } catch {
    // Best-effort persistence only.
  }
}

function readStoredMenuTheme(): MenuTheme | undefined {
  if (typeof window === 'undefined') {
    return undefined
  }

  try {
    const storedValue = window.sessionStorage.getItem(
      REINSPECT_MENU_THEME_STORAGE_KEY,
    )

    return isMenuTheme(storedValue) ? storedValue : undefined
  } catch {
    return undefined
  }
}

export function resolveMenuTheme(configTheme: MenuTheme | undefined): MenuTheme {
  const storedTheme = readStoredMenuTheme()
  if (storedTheme) {
    return storedTheme
  }

  if (isMenuTheme(configTheme)) {
    return configTheme
  }

  return 'light'
}

export function persistMenuTheme(theme: MenuTheme): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.sessionStorage.setItem(REINSPECT_MENU_THEME_STORAGE_KEY, theme)
  } catch {
    // Best-effort persistence only.
  }
}

function readStoredMenuOpenGesture(): MenuOpenGesture | undefined {
  if (typeof window === 'undefined') {
    return undefined
  }

  try {
    const storedValue = window.sessionStorage.getItem(
      REINSPECT_MENU_OPEN_GESTURE_STORAGE_KEY,
    )
    if (!storedValue) {
      return undefined
    }

    const parsedValue = JSON.parse(storedValue) as unknown
    if (!isRecord(parsedValue)) {
      return undefined
    }

    return normalizeMenuOpenGesture(parsedValue as MenuOpenGestureConfig)
  } catch {
    return undefined
  }
}

export function resolveMenuOpenGesture(
  configGesture: MenuOpenGestureConfig | undefined,
): MenuOpenGesture {
  const storedGesture = readStoredMenuOpenGesture()
  if (storedGesture) {
    return storedGesture
  }

  return normalizeMenuOpenGesture(configGesture)
}

export function persistMenuOpenGesture(
  gesture: MenuOpenGestureConfig | MenuOpenGesture,
): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const normalized = normalizeMenuOpenGesture(gesture)
    window.sessionStorage.setItem(
      REINSPECT_MENU_OPEN_GESTURE_STORAGE_KEY,
      JSON.stringify(normalized),
    )
  } catch {
    // Best-effort persistence only.
  }
}

export function reloadWindow(): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.location.reload()
  } catch {
    // jsdom and restricted runtimes may block reload.
  }
}

function resolveRenderCounters(config: ReinspectConfig): RenderCounterMode {
  if (isRenderCounterMode(config.renderCounters)) {
    return config.renderCounters
  }

  if (config.shouldCountRenders !== undefined || config.renderCaptureMode !== undefined) {
    warnAboutLegacyRenderConfig()
  }

  if (config.shouldCountRenders === false) {
    return 'off'
  }

  if (config.shouldCountRenders === true) {
    return config.renderCaptureMode ?? 'attempts'
  }

  if (config.renderCaptureMode) {
    return config.renderCaptureMode
  }

  return 'off'
}

function escapeRegExpPattern(pattern: string): string {
  return pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function compileInspectFilterMatcher(
  filter: InspectFilterConfig | InspectFilter,
): CompiledInspectFilterMatcher {
  const normalizedFilter = normalizeInspectFilter(filter)
  const compiledPatterns: RegExp[] = []
  const invalidPatterns: string[] = []
  const flags = normalizedFilter.matchCase ? '' : 'i'

  for (const pattern of normalizedFilter.patterns) {
    const baseSource = normalizedFilter.regex
      ? pattern
      : escapeRegExpPattern(pattern)
    const effectiveSource = normalizedFilter.wholeWord
      ? `\\b(?:${baseSource})\\b`
      : baseSource

    try {
      compiledPatterns.push(new RegExp(effectiveSource, flags))
    } catch {
      invalidPatterns.push(pattern)
    }
  }

  return {
    hasPatterns: compiledPatterns.length > 0,
    invalidPatterns,
    matches: (componentName: string) =>
      compiledPatterns.some((pattern) => pattern.test(componentName)),
  }
}

export function isComponentNameInspectableByFilters(
  componentName: string,
  whitelist: CompiledInspectFilterMatcher,
  blacklist: CompiledInspectFilterMatcher,
): boolean {
  const allowedByWhitelist = whitelist.hasPatterns
    ? whitelist.matches(componentName)
    : true
  if (!allowedByWhitelist) {
    return false
  }

  const blockedByBlacklist = blacklist.hasPatterns
    ? blacklist.matches(componentName)
    : false
  if (blockedByBlacklist) {
    return false
  }

  return true
}

export function resolveReinspectConfig(
  config: ReinspectConfig = {},
): ResolvedReinspectConfig {
  const enabled = config.enabled ?? false
  const editableProps =
    config.editableProps && config.editableProps.length > 0
      ? config.editableProps
      : DEFAULT_EDITABLE_PROPS

  return {
    enabled,
    startActive: config.startActive ?? true,
    showFloatingToggle: config.showFloatingToggle ?? enabled,
    inspectMode: resolveInspectMode(config.inspectMode),
    inspectWhitelist: resolveInspectWhitelist(config.inspectWhitelist),
    inspectBlacklist: resolveInspectBlacklist(config.inspectBlacklist),
    editableProps,
    zIndexBase: config.zIndexBase ?? FALLBACK_Z_INDEX,
    renderCounters: resolveRenderCounters(config),
    countRendersForComponents: config.countRendersForComponents ?? [],
    propsSerializationMode: resolvePropsSerializationMode(
      config.propsSerializationMode,
    ),
    menuTheme: resolveMenuTheme(config.menuTheme),
    menuOpenGesture: resolveMenuOpenGesture(config.menuOpenGesture),
  }
}

export function buildInlineStyleOverrides(
  overrides: ComponentStyleOverrides | undefined,
  editableProps: readonly EditableStyleProp[],
): Record<string, string | number> {
  if (!overrides) {
    return {}
  }

  const result: Record<string, string | number> = {}
  for (const prop of editableProps) {
    const value = overrides[prop]
    if (value === undefined || value === null || value === '') {
      continue
    }
    result[prop] = value
  }

  return result
}

function parseRgbComponent(component: string): number | undefined {
  const normalized = component.trim()
  if (normalized.length === 0) {
    return undefined
  }

  if (normalized.endsWith('%')) {
    const asPercent = Number(normalized.slice(0, -1))
    if (!Number.isFinite(asPercent)) {
      return undefined
    }

    return Math.min(255, Math.max(0, Math.round((asPercent / 100) * 255)))
  }

  const asNumber = Number(normalized)
  if (!Number.isFinite(asNumber)) {
    return undefined
  }

  return Math.min(255, Math.max(0, Math.round(asNumber)))
}

function toHexChannel(channel: number): string {
  return channel.toString(16).padStart(2, '0')
}

function tryParseHexColor(value: string | undefined): string | undefined {
  if (!value) {
    return undefined
  }

  const trimmedValue = value.trim()

  if (/^#[0-9a-fA-F]{6}$/.test(trimmedValue)) {
    return trimmedValue.toLowerCase()
  }

  if (/^#[0-9a-fA-F]{3}$/.test(trimmedValue)) {
    const [, r = '0', g = '0', b = '0'] = trimmedValue
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }

  const rgbMatch = trimmedValue.match(/^rgba?\((.+)\)$/i)
  if (rgbMatch) {
    const innerValue = (rgbMatch[1] ?? '').replace(/\//g, ' ')
    const parts = innerValue.split(/[,\s]+/).filter((part) => part.length > 0)
    const red = parseRgbComponent(parts[0] ?? '')
    const green = parseRgbComponent(parts[1] ?? '')
    const blue = parseRgbComponent(parts[2] ?? '')

    if (red !== undefined && green !== undefined && blue !== undefined) {
      return `#${toHexChannel(red)}${toHexChannel(green)}${toHexChannel(blue)}`
    }
  }

  return undefined
}

function resolveColorUsingBrowserParser(value: string): string | undefined {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return undefined
  }

  const probe = document.createElement('span')
  probe.style.position = 'fixed'
  probe.style.left = '-9999px'
  probe.style.top = '-9999px'
  probe.style.color = ''
  probe.style.color = value
  if (!probe.style.color) {
    return undefined
  }

  document.body.appendChild(probe)
  try {
    const computedColor = window.getComputedStyle(probe).color
    return tryParseHexColor(computedColor)
  } finally {
    probe.remove()
  }
}

export function resolveColorInputValue(value: string | undefined): string {
  const directColor = tryParseHexColor(value)
  if (directColor) {
    return directColor
  }

  if (value) {
    const browserResolvedColor = resolveColorUsingBrowserParser(value)
    if (browserResolvedColor) {
      return browserResolvedColor
    }
  }

  return '#1f2937'
}

export function normalizeHexColor(value: string | undefined): string {
  return resolveColorInputValue(value)
}

export function parseNumberInput(input: string): number | undefined {
  const parsed = Number(input)
  if (!Number.isFinite(parsed)) {
    return undefined
  }

  return parsed
}
