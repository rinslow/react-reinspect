/* eslint-disable react-hooks/refs */

import {
  type ComponentType,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  Profiler,
  type ProfilerOnRenderCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import {
  COLOR_STYLE_PROPS,
  NUMERIC_STYLE_PROPS,
  OPACITY_STYLE_PROP,
} from '../constants'
import { ReinspectContext } from './context'
import {
  buildInlineStyleOverrides,
  resolveColorInputValue,
  parseNumberInput,
} from '../utils'
import {
  buildDetectedPropsRows,
  isEditablePropValue,
  parseEditablePropValueInput,
  parsePropsOverridesInput,
  serializeValueForJson,
  serializePropsForRawEditor,
} from '../propsInspector'
import type {
  AutoDiscoverScope,
  EditableStyleProp,
  InspectMode,
  RenderCounterMode,
  StyleOverrideValue,
} from '../types'
import {
  getReinspectWrappedMetadata,
  type ReinspectWrapSource,
  setReinspectWrappedMetadata,
} from '../wrapMarker'
import {
  incrementRenderCounts,
  resetRenderCounts,
} from '../core/renderCounter'
import { RenderCountBadge, renderPropsValueTree } from './overlay'
import { highlightCode } from '../syntaxHighlight'

export interface WithReinspectInternalOptions {
  componentName?: string
  fallbackName?: string
  source?: ReinspectWrapSource
  scope?: AutoDiscoverScope
}

type InspectorPanel = 'general' | 'css' | 'props'
type PropsPanelView = 'detected' | 'raw'

const FALLBACK_CONFIG = {
  enabled: false,
  startActive: false,
  showFloatingToggle: false,
  inspectMode: 'wrapped' as const,
  inspectWhitelist: {
    patterns: [] as const,
    regex: false,
    wholeWord: false,
    matchCase: false,
  },
  inspectBlacklist: {
    patterns: [] as const,
    regex: false,
    wholeWord: false,
    matchCase: false,
  },
  editableProps: [] as const,
  zIndexBase: 0,
  renderCounters: 'off' as const,
  countRendersForComponents: [] as const,
  propsSerializationMode: 'distilled' as const,
  menuTheme: 'light' as const,
}

let instanceSequence = 0
const MENU_VIEWPORT_MARGIN = 12
const MENU_ESTIMATED_WIDTH = 560
const MENU_ESTIMATED_HEIGHT = 620

function createInstanceId(componentName: string): string {
  instanceSequence += 1
  return `${componentName}-${instanceSequence.toString(36)}`
}

function toTitleCase(input: string): string {
  const withSpaces = input.replace(/([A-Z])/g, ' $1').trim()
  const firstCharacter = withSpaces.slice(0, 1)
  return withSpaces.length > 0
    ? firstCharacter.toUpperCase() + withSpaces.slice(1)
    : input
}

function normalizeCssPropertyFilter(input: string): string {
  return input.trim().toLowerCase().replace(/[\s_-]+/g, '')
}

function hasValue(value: StyleOverrideValue | undefined): boolean {
  return value !== undefined && value !== null && value !== ''
}

function toDataTestIdSegment(input: string): string {
  return input.replace(/[^a-zA-Z0-9_-]/g, '-')
}

function toCssPropertyName(prop: string): string {
  return prop.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`)
}

function isTransparentColorValue(value: string | undefined): boolean {
  if (!value) {
    return true
  }

  const normalized = value.trim().toLowerCase()
  if (normalized === 'transparent') {
    return true
  }

  const rgbaMatch = normalized.match(/^rgba?\((.+)\)$/i)
  if (!rgbaMatch) {
    return false
  }

  const [, innerValueRaw = ''] = rgbaMatch
  const innerValue = innerValueRaw.replace(/\//g, ' ')
  const parts = innerValue.split(/[,\s]+/).filter((part) => part.length > 0)
  if (parts.length < 4) {
    return false
  }

  const alphaToken = parts[3]
  if (!alphaToken) {
    return false
  }

  const alphaValue = alphaToken.endsWith('%')
    ? Number(alphaToken.slice(0, -1)) / 100
    : Number(alphaToken)

  return Number.isFinite(alphaValue) && alphaValue <= 0
}

function clampMenuPosition(
  position: { x: number; y: number },
  width: number,
  height: number,
): { x: number; y: number } {
  if (typeof window === 'undefined') {
    return position
  }

  const minX = MENU_VIEWPORT_MARGIN
  const minY = MENU_VIEWPORT_MARGIN
  const maxX = Math.max(
    minX,
    window.innerWidth - width - MENU_VIEWPORT_MARGIN,
  )
  const maxY = Math.max(
    minY,
    window.innerHeight - height - MENU_VIEWPORT_MARGIN,
  )

  return {
    x: Math.min(Math.max(position.x, minX), maxX),
    y: Math.min(Math.max(position.y, minY), maxY),
  }
}

function appendUniquePattern(
  patterns: readonly string[],
  pattern: string,
): string[] {
  return patterns.includes(pattern) ? [...patterns] : [...patterns, pattern]
}

function togglePattern(patterns: readonly string[], pattern: string): string[] {
  return patterns.includes(pattern)
    ? patterns.filter((value) => value !== pattern)
    : appendUniquePattern(patterns, pattern)
}

function renderCopyIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d="M5.5 1.75A1.75 1.75 0 0 0 3.75 3.5v7c0 .966.784 1.75 1.75 1.75h7a1.75 1.75 0 0 0 1.75-1.75v-7a1.75 1.75 0 0 0-1.75-1.75h-7Zm-.25 1.75c0-.138.112-.25.25-.25h7c.138 0 .25.112.25.25v7a.25.25 0 0 1-.25.25h-7a.25.25 0 0 1-.25-.25v-7ZM1.75 6.5a.75.75 0 0 1 1.5 0v6c0 .966.784 1.75 1.75 1.75h6a.75.75 0 0 1 0 1.5h-6A3.25 3.25 0 0 1 1.75 12.5v-6Z"
        fill="currentColor"
      />
    </svg>
  )
}

function renderEditIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d="M11.86 1.52a1.8 1.8 0 0 1 2.55 2.55l-7.12 7.12a.75.75 0 0 1-.35.2l-3 0a.75.75 0 0 1-.75-.75l0-3a.75.75 0 0 1 .2-.35l7.12-7.12Zm1.49 1.06a.3.3 0 0 0-.43 0L6.1 9.4l-.16.5.5-.16 6.82-6.82a.3.3 0 0 0 0-.43l.09.09Z"
        fill="currentColor"
      />
    </svg>
  )
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    return false
  }

  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function getComponentName<P extends object>(
  Component: ComponentType<P>,
  options?: WithReinspectInternalOptions,
): string {
  const explicitName = options?.componentName?.trim()
  if (explicitName) {
    return explicitName
  }

  const displayName = Component.displayName?.trim()
  if (displayName) {
    return displayName
  }

  const runtimeName = Component.name?.trim()
  if (runtimeName) {
    return runtimeName
  }

  const fallbackName = options?.fallbackName?.trim()
  if (fallbackName) {
    return fallbackName
  }

  return 'Component'
}

function isInspectableByMode(
  source: ReinspectWrapSource,
  scope: AutoDiscoverScope,
  inspectMode: InspectMode,
): boolean {
  if (source === 'manual') {
    return true
  }

  if (inspectMode === 'all') {
    return true
  }

  if (inspectMode === 'first-party' && scope === 'first-party') {
    return true
  }

  return false
}

export function withReinspectInternal<P extends object>(
  Component: ComponentType<P>,
  options?: WithReinspectInternalOptions,
): ComponentType<P> {
  const requestedSource = options?.source ?? 'manual'
  const requestedScope = options?.scope ?? 'first-party'
  const existingMetadata = getReinspectWrappedMetadata(Component)

  if (existingMetadata && requestedSource === 'auto') {
    return Component
  }

  const SourceComponent =
    existingMetadata && requestedSource === 'manual'
      ? existingMetadata.original
      : Component
  const componentName = getComponentName(SourceComponent, options)

  function ReinspectWrappedComponent(props: P) {
    const instanceIdRef = useRef<string | null>(null)
    const menuRef = useRef<HTMLDivElement | null>(null)
    const editModalRef = useRef<HTMLDivElement | null>(null)

    const [menuPosition, setMenuPosition] = useState<{
      x: number
      y: number
    } | null>(null)
    const [activePanel, setActivePanel] = useState<InspectorPanel>('css')
    const [propsPanelView, setPropsPanelView] =
      useState<PropsPanelView>('detected')
    const [cssFilter, setCssFilter] = useState('')
    const [propsOverrides, setPropsOverrides] = useState<Partial<P>>({})
    const [propsDraft, setPropsDraft] = useState('{}')
    const [propsError, setPropsError] = useState<string | null>(null)
    const [propsCopyStatus, setPropsCopyStatus] = useState<string | null>(null)
    const [jsonPreviewByProp, setJsonPreviewByProp] = useState<
      Record<string, string>
    >({})
    const [jsonPreviewErrorByProp, setJsonPreviewErrorByProp] = useState<
      Record<string, string>
    >({})
    const [openJsonPreviewByProp, setOpenJsonPreviewByProp] = useState<
      Record<string, boolean>
    >({})
    const [editingPropKey, setEditingPropKey] = useState<string | null>(null)
    const [editingDraft, setEditingDraft] = useState('')
    const [editingError, setEditingError] = useState<string | null>(null)
    const [computedStyleValues, setComputedStyleValues] = useState<
      Partial<Record<EditableStyleProp, string>>
    >({})

    const reinspectContext = useContext(ReinspectContext)
    const hasReinspectContext = Boolean(reinspectContext)
    const config = reinspectContext?.config ?? FALLBACK_CONFIG
    const getColor =
      reinspectContext?.getColor ??
      (() => '#f97316')
    const menuTheme = reinspectContext?.menuTheme ?? 'light'
    const isActive = reinspectContext?.isActive ?? false
    const inspectMode = reinspectContext?.inspectMode ?? 'wrapped'
    const renderCounterMode =
      reinspectContext?.renderCounterMode ?? FALLBACK_CONFIG.renderCounters
    const propsSerializationMode =
      reinspectContext?.propsSerializationMode ??
      FALLBACK_CONFIG.propsSerializationMode
    const overrides = reinspectContext?.overrides ?? {}
    const updateOverride =
      reinspectContext?.updateOverride ??
      (() => undefined)
    const renderCountComponents = reinspectContext?.renderCountComponents ?? {}
    const setRenderCountingForComponent =
      reinspectContext?.setRenderCountingForComponent ??
      (() => undefined)
    const setInspectWhitelist =
      reinspectContext?.setInspectWhitelist ??
      (() => undefined)
    const inspectWhitelist =
      reinspectContext?.inspectWhitelist ?? FALLBACK_CONFIG.inspectWhitelist
    const setInspectBlacklist =
      reinspectContext?.setInspectBlacklist ??
      (() => undefined)
    const isRenderCountingEnabledFor =
      reinspectContext?.isRenderCountingEnabledFor ??
      (() => false)

    if (!instanceIdRef.current) {
      instanceIdRef.current = createInstanceId(componentName)
    }
    const instanceId = instanceIdRef.current
    const borderColor = getColor(componentName)
    const inspectableByCurrentMode = isInspectableByMode(
      requestedSource,
      requestedScope,
      inspectMode,
    )
    const inspectableByCurrentFilters =
      reinspectContext?.isComponentInspectableByFilters(componentName) ?? true
    const inspectorActive =
      config.enabled &&
      isActive &&
      inspectableByCurrentMode &&
      inspectableByCurrentFilters
    const shouldCountRendersForComponent =
      inspectorActive && isRenderCountingEnabledFor(componentName)
    const isComponentSpecificRenderCountingEnabled = Boolean(
      renderCountComponents[componentName],
    )
    const shouldCountRendersGlobally = renderCounterMode !== 'off'
    const effectiveRenderCounterMode: Exclude<RenderCounterMode, 'off'> =
      renderCounterMode === 'off' ? 'attempts' : renderCounterMode
    const shouldTrackRenderCounts = shouldCountRendersForComponent

    const currentOverrides = overrides[instanceId]

    const inlineStyles = inspectorActive
      ? buildInlineStyleOverrides(currentOverrides, config.editableProps)
      : {}

    const renderedProps = { ...props, ...propsOverrides } as P
    const effectiveProps = renderedProps as Record<string, unknown>

    const menuOpen = menuPosition !== null
    const normalizedCssFilter = normalizeCssPropertyFilter(cssFilter)
    const filteredEditableProps =
      normalizedCssFilter.length === 0
        ? config.editableProps
        : config.editableProps.filter((prop) =>
            normalizeCssPropertyFilter(prop).includes(normalizedCssFilter),
          )
    const shouldBuildDetectedProps =
      menuOpen && activePanel === 'props' && propsPanelView === 'detected'
    const detectedPropsRows = shouldBuildDetectedProps
      ? buildDetectedPropsRows(effectiveProps)
      : []

    const shouldTrackRenderCountsRef = useRef(shouldTrackRenderCounts)

    useEffect(() => {
      shouldTrackRenderCountsRef.current = shouldTrackRenderCounts
    }, [shouldTrackRenderCounts])

    const handleProfileRender = useMemo<ProfilerOnRenderCallback>(
      () => (_id, phase) => {
        if (phase === 'mount' || !shouldTrackRenderCountsRef.current) {
          return
        }

        incrementRenderCounts(instanceId)
      },
      [instanceId],
    )

    useEffect(
      () => () => {
        resetRenderCounts(instanceId)
      },
      [instanceId],
    )

    useEffect(() => {
      if (!menuOpen) {
        return undefined
      }

      const closeMenu = (event: MouseEvent) => {
        const target = event.target as Node
        if (
          menuRef.current?.contains(target) ||
          editModalRef.current?.contains(target)
        ) {
          return
        }

        setMenuPosition(null)
        setEditingPropKey(null)
        setEditingDraft('')
        setEditingError(null)
      }

      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          if (editingPropKey) {
            setEditingPropKey(null)
            setEditingDraft('')
            setEditingError(null)
            return
          }

          setMenuPosition(null)
        }
      }

      document.addEventListener('mousedown', closeMenu)
      document.addEventListener('keydown', handleEscape)

      return () => {
        document.removeEventListener('mousedown', closeMenu)
        document.removeEventListener('keydown', handleEscape)
      }
    }, [editingPropKey, menuOpen])

    useEffect(() => {
      if (!menuOpen) {
        return
      }

      if (config.enabled && isActive && inspectableByCurrentMode) {
        return
      }

      setMenuPosition(null)
      setEditingPropKey(null)
      setEditingDraft('')
      setEditingError(null)
    }, [config.enabled, inspectableByCurrentMode, isActive, menuOpen])

    useEffect(() => {
      if (!propsCopyStatus) {
        return undefined
      }

      const timeoutId = globalThis.setTimeout(() => {
        setPropsCopyStatus(null)
      }, 1400)

      return () => {
        globalThis.clearTimeout(timeoutId)
      }
    }, [propsCopyStatus])

    useEffect(() => {
      if (!menuOpen || !menuPosition || !menuRef.current) {
        return
      }

      const rect = menuRef.current.getBoundingClientRect()
      const nextPosition = clampMenuPosition(
        menuPosition,
        rect.width,
        rect.height,
      )

      if (
        nextPosition.x !== menuPosition.x ||
        nextPosition.y !== menuPosition.y
      ) {
        setMenuPosition(nextPosition)
      }
    }, [menuOpen, menuPosition])

    const shellStyle = {
      '--reinspect-color': borderColor,
      '--reinspect-z-base': config.zIndexBase,
    } as CSSProperties

    const readComputedStyleValues = (
      event: ReactMouseEvent<HTMLDivElement>,
    ): Partial<Record<EditableStyleProp, string>> => {
      if (typeof window === 'undefined') {
        return {}
      }

      const shellElement = event.currentTarget
      const contentElement = shellElement.querySelector('[data-reinspect-content="true"]')
      const eventTarget = event.target
      let styleTarget: HTMLElement | null = null

      if (
        eventTarget instanceof HTMLElement &&
        contentElement?.contains(eventTarget)
      ) {
        styleTarget = eventTarget
      }

      if (
        !styleTarget &&
        contentElement?.firstElementChild instanceof HTMLElement
      ) {
        styleTarget = contentElement.firstElementChild
      }

      if (!styleTarget && contentElement instanceof HTMLElement) {
        styleTarget = contentElement
      }

      if (!styleTarget) {
        return {}
      }

      const computedStyle = window.getComputedStyle(styleTarget)
      const nextValues: Partial<Record<EditableStyleProp, string>> = {}
      const resolveEffectiveBackgroundColor = (): string => {
        let currentElement: HTMLElement | null = styleTarget
        while (currentElement) {
          const backgroundColor = window
            .getComputedStyle(currentElement)
            .backgroundColor.trim()
          if (!isTransparentColorValue(backgroundColor)) {
            return backgroundColor
          }

          currentElement = currentElement.parentElement
        }

        const documentBackground = window
          .getComputedStyle(document.documentElement)
          .backgroundColor.trim()
        if (!isTransparentColorValue(documentBackground)) {
          return documentBackground
        }

        return 'rgb(255 255 255)'
      }

      for (const prop of config.editableProps) {
        const cssPropertyName = toCssPropertyName(prop)
        const computedValue =
          prop === 'backgroundColor'
            ? resolveEffectiveBackgroundColor()
            : computedStyle.getPropertyValue(cssPropertyName).trim()
        if (computedValue.length > 0) {
          nextValues[prop] = computedValue
        }
      }

      return nextValues
    }

    const parseNumericCssValue = (value: string | undefined): number | undefined => {
      if (!value) {
        return undefined
      }

      const numericMatch = value.trim().match(/-?\d*\.?\d+/)
      if (!numericMatch?.[0]) {
        return undefined
      }

      return parseNumberInput(numericMatch[0])
    }

    const openMenuAtCursor = (event: ReactMouseEvent<HTMLDivElement>) => {
      if (!inspectorActive) {
        return
      }

      event.preventDefault()
      setActivePanel('general')
      setPropsPanelView('detected')
      setCssFilter('')
      setPropsError(null)
      setPropsCopyStatus(null)
      setJsonPreviewByProp({})
      setJsonPreviewErrorByProp({})
      setOpenJsonPreviewByProp({})
      setEditingPropKey(null)
      setEditingDraft('')
      setEditingError(null)
      setPropsDraft('{}')
      setComputedStyleValues(readComputedStyleValues(event))
      setMenuPosition(
        clampMenuPosition(
          {
            x: event.clientX,
            y: event.clientY,
          },
          MENU_ESTIMATED_WIDTH,
          MENU_ESTIMATED_HEIGHT,
        ),
      )
    }

    const applyPropsOverrides = () => {
      const { parsed, error } = parsePropsOverridesInput(propsDraft)
      if (error || !parsed) {
        setPropsError(error)
        return
      }

      setPropsOverrides(parsed as Partial<P>)
      setPropsError(null)
    }

    const resetPropsOverrides = () => {
      setPropsOverrides({})
      if (propsPanelView === 'raw') {
        setPropsDraft(
          serializePropsForRawEditor(props as Record<string, unknown>, {
            mode: propsSerializationMode,
          }),
        )
      }
      setPropsError(null)
    }

    const copyPropsText = (text: string, label: string) => {
      void copyTextToClipboard(text).then((didCopy) => {
        setPropsCopyStatus(
          didCopy ? `${label} copied.` : 'Clipboard access is unavailable.',
        )
      })
    }

    const copyJsonPreviewForProp = (propKey: string, propValue: unknown) => {
      const cachedPreview = jsonPreviewByProp[propKey]
      const serialized =
        cachedPreview ??
        serializeValueForJson(propValue, { mode: propsSerializationMode })

      if (!serialized) {
        setPropsCopyStatus('JSON preview is unavailable for this value.')
        return
      }

      if (!cachedPreview) {
        setJsonPreviewByProp((current) => ({
          ...current,
          [propKey]: serialized,
        }))
      }

      copyPropsText(serialized, 'JSON value')
    }

    const toggleJsonPreviewForProp = (propKey: string, propValue: unknown) => {
      const isOpen = Boolean(openJsonPreviewByProp[propKey])
      if (isOpen) {
        setOpenJsonPreviewByProp((current) => ({
          ...current,
          [propKey]: false,
        }))
        return
      }

      if (!(propKey in jsonPreviewByProp) && !(propKey in jsonPreviewErrorByProp)) {
        const serialized = serializeValueForJson(propValue, {
          mode: propsSerializationMode,
        })
        if (serialized === null) {
          setJsonPreviewErrorByProp((current) => ({
            ...current,
            [propKey]: 'JSON preview is unavailable for this value.',
          }))
        } else {
          setJsonPreviewByProp((current) => ({
            ...current,
            [propKey]: serialized,
          }))
        }
      }

      setOpenJsonPreviewByProp((current) => ({
        ...current,
        [propKey]: true,
      }))
    }

    const openEditModalForProp = (propKey: string, propValue: unknown) => {
      if (!isEditablePropValue(propValue)) {
        return
      }

      const serialized = serializeValueForJson(propValue, {
        mode: propsSerializationMode,
      })
      if (serialized === null) {
        setPropsCopyStatus('Unable to open editor for this value.')
        return
      }

      setEditingPropKey(propKey)
      setEditingDraft(serialized)
      setEditingError(null)
    }

    const applyPropEdit = () => {
      if (!editingPropKey) {
        return
      }

      const { parsed, error } = parseEditablePropValueInput(editingDraft)
      if (error || parsed === null) {
        setEditingError(error)
        return
      }

      setPropsOverrides((current) => ({
        ...(current as Record<string, unknown>),
        [editingPropKey]: parsed,
      }) as Partial<P>)

      setEditingPropKey(null)
      setEditingDraft('')
      setEditingError(null)
    }

    const includeAllComponentInstances = () => {
      setInspectWhitelist((current) => ({
        ...current,
        patterns: togglePattern(current.patterns, componentName),
      }))
    }
    const includeFilterActive = inspectWhitelist.patterns.includes(componentName)

    const excludeAllComponentInstances = () => {
      setInspectBlacklist((current) => ({
        ...current,
        patterns: appendUniquePattern(current.patterns, componentName),
      }))
      setMenuPosition(null)
    }

    const menuElement = menuOpen ? (
      <div
        ref={menuRef}
        className="reinspect-menu"
        data-reinspect-theme={menuTheme}
        role="dialog"
        aria-label={`${componentName} controls`}
        onMouseDown={(event) => {
          event.stopPropagation()
        }}
        onClick={(event) => {
          event.stopPropagation()
        }}
        onContextMenu={(event) => {
          event.preventDefault()
          event.stopPropagation()
        }}
        style={{
          top: `${menuPosition.y}px`,
          left: `${menuPosition.x}px`,
          ['--reinspect-color' as string]: borderColor,
        }}
      >
        <div className="reinspect-menu-header">
          <div className="reinspect-menu-title-wrap">
            <p className="reinspect-menu-title">{componentName}</p>
            <p className="reinspect-menu-subtitle">Component controls</p>
          </div>
          <button
            type="button"
            className="reinspect-menu-close"
            aria-label={`Close ${componentName} controls`}
            data-testid={`reinspect-menu-close-${componentName}`}
            onClick={() => setMenuPosition(null)}
          >
            ×
          </button>
        </div>
        <div className="reinspect-submenu" aria-label={`${componentName} menu panels`}>
          <button
            type="button"
            data-state={activePanel === 'general' ? 'active' : 'idle'}
            onClick={() => setActivePanel('general')}
          >
            General
          </button>
          <button
            type="button"
            data-state={activePanel === 'css' ? 'active' : 'idle'}
            onClick={() => setActivePanel('css')}
          >
            CSS
          </button>
          <button
            type="button"
            data-state={activePanel === 'props' ? 'active' : 'idle'}
            onClick={() => setActivePanel('props')}
          >
            Props
          </button>
        </div>

        {activePanel === 'general' ? (
          <div className="reinspect-general-panel">
            <section className="reinspect-menu-section">
              <div className="reinspect-menu-section-header">
                <p className="reinspect-menu-section-title">Quick filters</p>
                <p className="reinspect-menu-section-caption">{componentName}</p>
              </div>
              <p className="reinspect-menu-section-description">
                Focus inspection on this component type, or hide this type from
                inspection.
              </p>
              <div className="reinspect-menu-shortcuts">
                <button
                  type="button"
                  className="reinspect-menu-action-card"
                  onClick={includeAllComponentInstances}
                  data-testid={`reinspect-include-component-${componentName}`}
                  data-state={includeFilterActive ? 'active' : 'idle'}
                  aria-label={`Only inspect ${componentName} components`}
                >
                  <span className="reinspect-menu-action-title">
                    Show only this component type
                  </span>
                  <span className="reinspect-menu-action-description">
                    Keeps all matching instances inspectable and hides other types.
                  </span>
                  <code className="reinspect-menu-action-target">{componentName}</code>
                </button>
                <button
                  type="button"
                  className="reinspect-menu-action-card"
                  onClick={excludeAllComponentInstances}
                  data-testid={`reinspect-exclude-component-${componentName}`}
                  aria-label={`Hide ${componentName} components from inspection`}
                >
                  <span className="reinspect-menu-action-title">
                    Hide this component type
                  </span>
                  <span className="reinspect-menu-action-description">
                    Removes matching instances from inspection overlays.
                  </span>
                  <code className="reinspect-menu-action-target">{componentName}</code>
                </button>
              </div>
              <div className="reinspect-menu-divider" />
              <div className="reinspect-menu-inline-setting">
                <div className="reinspect-menu-inline-copy">
                  <p className="reinspect-menu-inline-title">Capture renders</p>
                  <p className="reinspect-menu-inline-description">
                    Track rerender attempts and commits for this component.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={
                    shouldCountRendersGlobally
                      ? true
                      : isComponentSpecificRenderCountingEnabled
                  }
                  onClick={() =>
                    setRenderCountingForComponent(
                      componentName,
                      !isComponentSpecificRenderCountingEnabled,
                    )
                  }
                  disabled={shouldCountRendersGlobally}
                  aria-label={`Capture renders for ${componentName}`}
                  data-testid={`reinspect-component-render-toggle-${componentName}`}
                  className="reinspect-switch-button reinspect-menu-switch"
                  data-state={
                    shouldCountRendersGlobally ||
                    isComponentSpecificRenderCountingEnabled
                      ? 'on'
                      : 'off'
                  }
                />
              </div>
              {shouldCountRendersGlobally ? (
                <p className="reinspect-setting-note">
                  Global render capture is enabled in settings.
                </p>
              ) : null}
            </section>
          </div>
        ) : null}

        {activePanel === 'css' ? (
          <div className="reinspect-css-panel">
            <div className="reinspect-menu-panel-header">
              <p className="reinspect-menu-section-title">Editable styles</p>
              <p className="reinspect-menu-section-caption">
                {filteredEditableProps.length}/{config.editableProps.length}
              </p>
            </div>
            <div className="reinspect-menu-filter">
              <span className="reinspect-menu-filter-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                  <path
                    d="M10.5 3a7.5 7.5 0 015.92 12.1l4.24 4.23a1 1 0 01-1.42 1.42l-4.23-4.24A7.5 7.5 0 1110.5 3zm0 2a5.5 5.5 0 100 11 5.5 5.5 0 000-11z"
                    fill="currentColor"
                  />
                </svg>
              </span>
              <input
                id={`${instanceId}-css-filter`}
                data-testid="reinspect-css-filter-input"
                type="search"
                value={cssFilter}
                placeholder="Filter"
                aria-label="Filter CSS properties"
                onChange={(event) => setCssFilter(event.currentTarget.value)}
              />
              {cssFilter.trim().length > 0 ? (
                <button
                  type="button"
                  className="reinspect-menu-filter-clear"
                  onClick={() => setCssFilter('')}
                  aria-label="Clear CSS filter"
                >
                  Clear
                </button>
              ) : null}
            </div>
            <div className="reinspect-menu-grid">
              {filteredEditableProps.map((prop) => {
                const rawValue = currentOverrides?.[prop]
                const fieldId = `${instanceId}-${prop}`

                if (COLOR_STYLE_PROPS.has(prop)) {
                  const sourceColorValue =
                    typeof rawValue === 'string'
                      ? rawValue
                      : computedStyleValues[prop]
                  const colorValue =
                    resolveColorInputValue(sourceColorValue)

                  return (
                    <div className="reinspect-field" key={prop}>
                      <label htmlFor={fieldId}>{toTitleCase(prop)}</label>
                      <div className="reinspect-inline-controls">
                        <input
                          id={fieldId}
                          type="color"
                          value={colorValue}
                          onChange={(event) =>
                            updateOverride(
                              instanceId,
                              prop,
                              event.currentTarget.value,
                            )
                          }
                        />
                        <button
                          type="button"
                          onClick={() => updateOverride(instanceId, prop, undefined)}
                          disabled={!hasValue(rawValue)}
                        >
                          reset
                        </button>
                      </div>
                    </div>
                  )
                }

                if (prop === OPACITY_STYLE_PROP) {
                  const opacityValue =
                    typeof rawValue === 'number'
                      ? rawValue
                      : (parseNumericCssValue(computedStyleValues[prop]) ?? 1)

                  return (
                    <div className="reinspect-field" key={prop}>
                      <label htmlFor={fieldId}>Opacity</label>
                      <div className="reinspect-inline-controls reinspect-opacity-controls">
                        <input
                          id={fieldId}
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={opacityValue}
                          onChange={(event) => {
                            const parsed = parseNumberInput(
                              event.currentTarget.value,
                            )
                            if (parsed === undefined) {
                              return
                            }

                            updateOverride(instanceId, prop, parsed)
                          }}
                        />
                        <output>{opacityValue.toFixed(2)}</output>
                        <button
                          type="button"
                          onClick={() => updateOverride(instanceId, prop, undefined)}
                          disabled={!hasValue(rawValue)}
                        >
                          reset
                        </button>
                      </div>
                    </div>
                  )
                }

                if (NUMERIC_STYLE_PROPS.has(prop)) {
                  const numericValue =
                    typeof rawValue === 'number'
                      ? rawValue
                      : (parseNumericCssValue(computedStyleValues[prop]) ?? '')

                  return (
                    <div className="reinspect-field" key={prop}>
                      <label htmlFor={fieldId}>{toTitleCase(prop)} (px)</label>
                      <div className="reinspect-inline-controls">
                        <input
                          id={fieldId}
                          type="number"
                          step="1"
                          value={numericValue}
                          onChange={(event) => {
                            if (event.currentTarget.value === '') {
                              updateOverride(instanceId, prop, undefined)
                              return
                            }

                            const parsed = parseNumberInput(
                              event.currentTarget.value,
                            )

                            if (parsed === undefined) {
                              return
                            }

                            updateOverride(instanceId, prop, parsed)
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => updateOverride(instanceId, prop, undefined)}
                          disabled={!hasValue(rawValue)}
                        >
                          reset
                        </button>
                      </div>
                    </div>
                  )
                }

                return (
                  <div className="reinspect-field" key={prop}>
                    <label htmlFor={fieldId}>{toTitleCase(prop)}</label>
                    <div className="reinspect-inline-controls">
                      <input
                        id={fieldId}
                        type="text"
                        value={
                          typeof rawValue === 'string'
                            ? rawValue
                            : (computedStyleValues[prop] ?? '')
                        }
                        onChange={(event) =>
                          updateOverride(
                            instanceId,
                            prop,
                            event.currentTarget.value || undefined,
                          )
                        }
                      />
                      <button
                        type="button"
                        onClick={() => updateOverride(instanceId, prop, undefined)}
                        disabled={!hasValue(rawValue)}
                      >
                        reset
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
            {filteredEditableProps.length === 0 ? (
              <p className="reinspect-menu-empty-state">
                No CSS properties match &quot;{cssFilter.trim()}&quot;.
              </p>
            ) : null}
          </div>
        ) : null}

        {activePanel === 'props' ? (
          <div className="reinspect-props-panel">
            <div className="reinspect-props-submenu">
              <button
                type="button"
                data-state={propsPanelView === 'detected' ? 'active' : 'idle'}
                onClick={() => setPropsPanelView('detected')}
              >
                Detected
              </button>
              <button
                type="button"
                data-state={propsPanelView === 'raw' ? 'active' : 'idle'}
                onClick={() => {
                  setPropsPanelView('raw')
                  setPropsError(null)
                  setPropsDraft(
                    serializePropsForRawEditor(effectiveProps, {
                      mode: propsSerializationMode,
                    }),
                  )
                }}
              >
                Raw
              </button>
            </div>

            {propsPanelView === 'detected' ? (
              detectedPropsRows.length > 0 ? (
                <div className="reinspect-props-table">
                  {detectedPropsRows.map((row) => {
                    const rowTestIdSegment = toDataTestIdSegment(row.key)
                    const propValue = effectiveProps[row.key]
                    const isJsonPreviewSupported =
                      row.value.kind === 'object' || row.value.kind === 'array'
                    const isJsonOpen = Boolean(openJsonPreviewByProp[row.key])
                    const jsonPreview = jsonPreviewByProp[row.key]
                    const jsonPreviewError = jsonPreviewErrorByProp[row.key]
                    const canEdit = isEditablePropValue(propValue)
                    return (
                      <div
                        className="reinspect-props-row"
                        key={row.key}
                        data-testid={`reinspect-prop-row-${rowTestIdSegment}`}
                      >
                        <code className="reinspect-prop-key">{row.key}</code>
                        <div
                          className="reinspect-prop-cell"
                          data-testid={`reinspect-prop-value-${rowTestIdSegment}`}
                        >
                          <div className="reinspect-prop-main">
                            <div className="reinspect-prop-value-render">
                              {renderPropsValueTree({
                                value: row.value,
                              })}
                            </div>

                            {isJsonPreviewSupported ||
                            canEdit ||
                            Boolean(row.value.copyText) ? (
                              <div className="reinspect-prop-actions">
                                {isJsonPreviewSupported ? (
                                  <button
                                    type="button"
                                    data-testid={`reinspect-prop-show-json-${rowTestIdSegment}`}
                                    onClick={() =>
                                      toggleJsonPreviewForProp(row.key, propValue)
                                    }
                                    className="reinspect-prop-action-text-button"
                                    title={
                                      isJsonOpen
                                        ? 'Collapse JSON preview'
                                        : 'Expand JSON preview'
                                    }
                                    aria-label={
                                      isJsonOpen
                                        ? `Collapse JSON preview for ${row.key}`
                                        : `Expand JSON preview for ${row.key}`
                                    }
                                  >
                                    {isJsonOpen ? 'Collapse JSON' : 'Expand JSON'}
                                  </button>
                                ) : null}

                                {canEdit ? (
                                  <button
                                    type="button"
                                    data-testid={`reinspect-prop-edit-${rowTestIdSegment}`}
                                    onClick={() =>
                                      openEditModalForProp(row.key, propValue)
                                    }
                                    className="reinspect-icon-button"
                                    title="Edit value"
                                    aria-label={`Edit ${row.key}`}
                                  >
                                    {renderEditIcon()}
                                  </button>
                                ) : null}

                                {(isJsonPreviewSupported
                                  ? true
                                  : Boolean(row.value.copyText)) ? (
                                  <button
                                    type="button"
                                    className="reinspect-icon-button"
                                    title={
                                      row.value.kind === 'function'
                                        ? 'Copy function source'
                                        : isJsonPreviewSupported
                                          ? 'Copy JSON'
                                          : 'Copy value'
                                    }
                                    aria-label={
                                      row.value.kind === 'function'
                                        ? 'Copy function source'
                                        : isJsonPreviewSupported
                                          ? `Copy JSON for ${row.key}`
                                          : `Copy value for ${row.key}`
                                    }
                                    onClick={() => {
                                      if (isJsonPreviewSupported) {
                                        copyJsonPreviewForProp(row.key, propValue)
                                        return
                                      }

                                      if (!row.value.copyText) {
                                        return
                                      }

                                      copyPropsText(
                                        row.value.copyText,
                                        row.value.kind === 'function'
                                          ? 'Function source'
                                          : 'Value',
                                      )
                                    }}
                                  >
                                    {renderCopyIcon()}
                                  </button>
                                ) : null}
                              </div>
                            ) : null}
                          </div>

                          {isJsonOpen ? (
                            <div
                              className="reinspect-prop-json-preview"
                              data-testid={`reinspect-prop-json-preview-${rowTestIdSegment}`}
                            >
                              {jsonPreviewError ? (
                                <p className="reinspect-error">{jsonPreviewError}</p>
                              ) : (
                                <pre>
                                  <code
                                    className="language-json reinspect-code-block"
                                    dangerouslySetInnerHTML={{
                                      __html: highlightCode(jsonPreview ?? '', 'json'),
                                    }}
                                  />
                                </pre>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="reinspect-menu-empty-state">No props detected.</p>
              )
            ) : (
              <>
                <label htmlFor={`${instanceId}-props-json`}>Props JSON</label>
                <textarea
                  id={`${instanceId}-props-json`}
                  value={propsDraft}
                  onChange={(event) => {
                    setPropsDraft(event.currentTarget.value)
                    setPropsError(null)
                  }}
                  rows={9}
                />
                {propsError ? <p className="reinspect-error">{propsError}</p> : null}
                <div className="reinspect-inline-controls">
                  <button type="button" onClick={applyPropsOverrides}>
                    apply
                  </button>
                  <button type="button" onClick={resetPropsOverrides}>
                    reset
                  </button>
                </div>
              </>
            )}

            {propsCopyStatus ? (
              <p className="reinspect-setting-note" data-testid="reinspect-props-copy-status">
                {propsCopyStatus}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    ) : null

    const editModalElement = editingPropKey
      ? createPortal(
          <div
            className="reinspect-modal-backdrop"
            data-reinspect-theme={menuTheme}
            role="dialog"
            aria-modal="true"
            aria-label={`Edit ${editingPropKey} prop`}
            data-testid="reinspect-prop-edit-modal"
          >
            <div
              className="reinspect-modal"
              data-reinspect-theme={menuTheme}
              ref={editModalRef}
            >
              <p className="reinspect-menu-title">Edit prop: {editingPropKey}</p>
              <label htmlFor={`${instanceId}-prop-edit-json`}>JSON value</label>
              <textarea
                id={`${instanceId}-prop-edit-json`}
                data-testid="reinspect-prop-edit-textarea"
                value={editingDraft}
                onChange={(event) => {
                  setEditingDraft(event.currentTarget.value)
                  setEditingError(null)
                }}
                rows={10}
              />
              {editingError ? (
                <p className="reinspect-error" data-testid="reinspect-prop-edit-error">
                  {editingError}
                </p>
              ) : null}
              <div className="reinspect-inline-controls">
                <button type="button" onClick={applyPropEdit}>
                  apply
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingPropKey(null)
                    setEditingDraft('')
                    setEditingError(null)
                  }}
                >
                  cancel
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null

    if (!hasReinspectContext) {
      if (requestedSource === 'manual') {
        throw new Error('useReinspect must be used within ReinspectProvider')
      }

      return <SourceComponent {...renderedProps} />
    }

    if (!inspectorActive && !menuOpen) {
      return <SourceComponent {...renderedProps} />
    }

    const sourceElement = shouldTrackRenderCounts ? (
      <Profiler id={instanceId} onRender={handleProfileRender}>
        <SourceComponent {...renderedProps} />
      </Profiler>
    ) : (
      <SourceComponent {...renderedProps} />
    )

    return (
      <div
        className="reinspect-shell"
        data-reinspect-component={componentName}
        data-reinspect-active={inspectorActive}
        data-testid={`reinspect-shell-${componentName}`}
        style={shellStyle}
        onContextMenu={openMenuAtCursor}
      >
        {inspectorActive ? (
          <span className="reinspect-name-badge">
            {componentName}
            {shouldCountRendersForComponent
              ? ` | `
              : ''}
            {shouldCountRendersForComponent ? (
              <RenderCountBadge
                instanceId={instanceId}
                counterMode={effectiveRenderCounterMode}
              />
            ) : null}
          </span>
        ) : null}

        {menuElement ? createPortal(menuElement, document.body) : null}
        {editModalElement}

        <div
          className="reinspect-content"
          data-reinspect-content="true"
          style={inlineStyles}
        >
          {sourceElement}
        </div>
      </div>
    )
  }

  ReinspectWrappedComponent.displayName = `withReinspect(${componentName})`
  setReinspectWrappedMetadata(ReinspectWrappedComponent, {
    source: requestedSource,
    scope: requestedScope,
    original: SourceComponent,
  })

  return ReinspectWrappedComponent
}
