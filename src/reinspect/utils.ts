import type {
  ComponentStyleOverrides,
  EditableStyleProp,
  InspectMode,
  RenderCounterMode,
  ReinspectConfig,
  ResolvedReinspectConfig,
} from './types'
import { DEFAULT_EDITABLE_PROPS, DEFAULT_PALETTE } from './constants'

const FALLBACK_Z_INDEX = 2147483000
export const REINSPECT_INSPECT_MODE_STORAGE_KEY = 'reinspect.inspectMode'

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

let didWarnAboutLegacyRenderConfig = false

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

export function resolveReinspectConfig(
  config: ReinspectConfig = {},
): ResolvedReinspectConfig {
  const enabled = config.enabled ?? false
  const editableProps =
    config.editableProps && config.editableProps.length > 0
      ? config.editableProps
      : DEFAULT_EDITABLE_PROPS
  const palette =
    config.palette && config.palette.length > 0
      ? config.palette
      : DEFAULT_PALETTE

  return {
    enabled,
    startActive: config.startActive ?? true,
    showFloatingToggle: config.showFloatingToggle ?? enabled,
    inspectMode: resolveInspectMode(config.inspectMode),
    editableProps,
    palette,
    zIndexBase: config.zIndexBase ?? FALLBACK_Z_INDEX,
    renderCounters: resolveRenderCounters(config),
    countRendersForComponents: config.countRendersForComponents ?? [],
  }
}

function hashString(input: string): number {
  let hash = 0
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash)
}

export function pickColorByComponentName(
  componentName: string,
  palette: readonly string[],
): string {
  if (palette.length === 0) {
    return DEFAULT_PALETTE[0] ?? '#f97316'
  }

  return palette[hashString(componentName) % palette.length] ?? '#f97316'
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

export function normalizeHexColor(value: string | undefined): string {
  if (!value) {
    return '#1f2937'
  }

  if (/^#[0-9a-fA-F]{6}$/.test(value)) {
    return value
  }

  if (/^#[0-9a-fA-F]{3}$/.test(value)) {
    const [, r = '0', g = '0', b = '0'] = value
    return `#${r}${r}${g}${g}${b}${b}`
  }

  return '#1f2937'
}

export function parseNumberInput(input: string): number | undefined {
  const parsed = Number(input)
  if (!Number.isFinite(parsed)) {
    return undefined
  }

  return parsed
}
