import type {
  ComponentStyleOverrides,
  EditableStyleProp,
  InspectMode,
  RenderCaptureMode,
  ReinspectConfig,
  ResolvedReinspectConfig,
} from './types'
import { DEFAULT_EDITABLE_PROPS, DEFAULT_PALETTE } from './constants'

const FALLBACK_Z_INDEX = 2147483000
export const REINSPECT_INSPECT_MODE_STORAGE_KEY = 'reinspect.inspectMode'

const VALID_INSPECT_MODES: InspectMode[] = ['wrapped', 'first-party', 'all']
const VALID_RENDER_CAPTURE_MODES: RenderCaptureMode[] = [
  'attempts',
  'commits',
  'both',
]

function resolveDefaultEnabled(): boolean {
  return Boolean(import.meta.env?.DEV)
}

export function isInspectMode(value: unknown): value is InspectMode {
  return (
    typeof value === 'string' &&
    VALID_INSPECT_MODES.includes(value as InspectMode)
  )
}

export function isRenderCaptureMode(
  value: unknown,
): value is RenderCaptureMode {
  return (
    typeof value === 'string' &&
    VALID_RENDER_CAPTURE_MODES.includes(value as RenderCaptureMode)
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

export function resolveReinspectConfig(
  config: ReinspectConfig = {},
): ResolvedReinspectConfig {
  const enabled = config.enabled ?? resolveDefaultEnabled()
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
    shouldCountRenders: config.shouldCountRenders ?? false,
    countRendersForComponents: config.countRendersForComponents ?? [],
    renderCaptureMode: isRenderCaptureMode(config.renderCaptureMode)
      ? config.renderCaptureMode
      : 'attempts',
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
  palette: string[],
): string {
  if (palette.length === 0) {
    return DEFAULT_PALETTE[0]
  }

  return palette[hashString(componentName) % palette.length]
}

export function buildInlineStyleOverrides(
  overrides: ComponentStyleOverrides | undefined,
  editableProps: EditableStyleProp[],
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
    const [, r, g, b] = value
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
