import {
  type ComponentType,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import {
  COLOR_STYLE_PROPS,
  NUMERIC_STYLE_PROPS,
  OPACITY_STYLE_PROP,
} from './constants'
import { ReinspectContext } from './store'
import {
  buildInlineStyleOverrides,
  normalizeHexColor,
  parseNumberInput,
} from './utils'
import {
  buildDetectedPropsRows,
  isEditablePropValue,
  parseEditablePropValueInput,
  parsePropsOverridesInput,
  serializeValueForJson,
  type InspectedValueDescriptor,
  serializePropsForRawEditor,
} from './propsInspector'
import type {
  AutoDiscoverScope,
  InspectMode,
  RenderCaptureMode,
  StyleOverrideValue,
} from './types'
import {
  getReinspectWrappedMetadata,
  REINSPECT_WRAPPED_SYMBOL,
  type ReinspectWrapSource,
} from './wrapMarker'

export interface WithReinspectOptions {
  name?: string
  fallbackName?: string
  source?: ReinspectWrapSource
  scope?: AutoDiscoverScope
}

type InspectorPanel = 'css' | 'props'
type PropsPanelView = 'detected' | 'raw'

const FALLBACK_CONFIG = {
  enabled: false,
  startActive: false,
  showFloatingToggle: false,
  inspectMode: 'wrapped' as const,
  editableProps: [],
  palette: [],
  zIndexBase: 0,
  shouldCountRenders: false,
  countRendersForComponents: [],
  renderCaptureMode: 'attempts' as const,
}

interface RenderCountEntry {
  attempts: number
  commits: number
  hasCommitted: boolean
  wasCountingEnabled: boolean
  shouldCountCommit: boolean
}

const renderCountByInstance = new Map<string, RenderCountEntry>()

function getOrCreateRenderCountEntry(instanceId: string): RenderCountEntry {
  const existingEntry = renderCountByInstance.get(instanceId)
  if (existingEntry) {
    return existingEntry
  }

  const nextEntry: RenderCountEntry = {
    attempts: 0,
    commits: 0,
    hasCommitted: false,
    wasCountingEnabled: false,
    shouldCountCommit: false,
  }

  renderCountByInstance.set(instanceId, nextEntry)
  return nextEntry
}

interface RenderCounts {
  attempts: number
  commits: number
}

function readAndTrackRenderCount(
  instanceId: string,
  shouldCountRenders: boolean,
): RenderCounts {
  const entry = getOrCreateRenderCountEntry(instanceId)

  if (!shouldCountRenders) {
    entry.wasCountingEnabled = false
    entry.shouldCountCommit = false
    return {
      attempts: entry.attempts,
      commits: entry.commits,
    }
  }

  const shouldCountCurrentRerender = entry.hasCommitted && entry.wasCountingEnabled

  if (shouldCountCurrentRerender) {
    entry.attempts += 1
  }

  entry.wasCountingEnabled = true
  entry.shouldCountCommit = shouldCountCurrentRerender
  return {
    attempts: entry.attempts,
    commits: entry.commits + (shouldCountCurrentRerender ? 1 : 0),
  }
}

function trackCommittedRender(instanceId: string): void {
  const entry = getOrCreateRenderCountEntry(instanceId)

  if (entry.hasCommitted && entry.shouldCountCommit) {
    entry.commits += 1
  }

  entry.hasCommitted = true
  entry.shouldCountCommit = false
}

function formatRenderCountLabel(
  counts: RenderCounts,
  captureMode: RenderCaptureMode,
): string {
  if (captureMode === 'commits') {
    return `${counts.commits} commits`
  }

  if (captureMode === 'both') {
    return `${counts.attempts} attempts | ${counts.commits} commits`
  }

  return `${counts.attempts} attempts`
}

function toTitleCase(input: string): string {
  const withSpaces = input.replace(/([A-Z])/g, ' $1').trim()
  return withSpaces.length > 0
    ? withSpaces[0].toUpperCase() + withSpaces.slice(1)
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

interface PropsValueTreeProps {
  value: InspectedValueDescriptor
  onCopy: (text: string, label: string) => void
}

function renderPropsValueTree({
  value,
  onCopy,
}: PropsValueTreeProps): ReactNode {
  if (value.kind === 'function' && value.functionMeta) {
    const functionMeta = value.functionMeta
    return (
      <div className="reinspect-prop-function">
        <code>{value.summary}</code>
        <pre>{functionMeta.preview}</pre>
        <button
          type="button"
          onClick={() => onCopy(functionMeta.source, 'Function source')}
          disabled={!functionMeta.source}
        >
          Copy function source
        </button>
      </div>
    )
  }

  return (
    <div className="reinspect-prop-scalar">
      <code>{value.summary}</code>
      {value.copyText ? (
        <button
          type="button"
          onClick={() => onCopy(value.copyText ?? '', 'Value')}
        >
          Copy
        </button>
      ) : null}
    </div>
  )
}

function getComponentName<P extends object>(
  Component: ComponentType<P>,
  options?: WithReinspectOptions,
): string {
  const explicitName = options?.name?.trim()
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

export function withReinspect<P extends object>(
  Component: ComponentType<P>,
  options?: WithReinspectOptions,
): ComponentType<P> {
  const requestedSource = options?.source ?? 'manual'
  const requestedScope = options?.scope ?? 'first-party'
  const existingMetadata = getReinspectWrappedMetadata(Component)

  if (existingMetadata && requestedSource === 'auto') {
    return Component
  }

  const SourceComponent =
    existingMetadata && requestedSource === 'manual'
      ? (existingMetadata.original as ComponentType<P>)
      : Component
  const componentName = getComponentName(SourceComponent, options)

  function ReinspectWrappedComponent(props: P) {
    const componentId = useId()
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

    const reinspectContext = useContext(ReinspectContext)
    const hasReinspectContext = Boolean(reinspectContext)
    const config = reinspectContext?.config ?? FALLBACK_CONFIG
    const getBorderColor =
      reinspectContext?.getBorderColor ??
      (() => '#f97316')
    const isActive = reinspectContext?.isActive ?? false
    const inspectMode = reinspectContext?.inspectMode ?? 'wrapped'
    const shouldCountRenders = reinspectContext?.shouldCountRenders ?? false
    const renderCaptureMode =
      reinspectContext?.renderCaptureMode ?? FALLBACK_CONFIG.renderCaptureMode
    const overrides = reinspectContext?.overrides ?? {}
    const updateOverride =
      reinspectContext?.updateOverride ??
      (() => undefined)
    const renderCountComponents = reinspectContext?.renderCountComponents ?? {}
    const setRenderCountingForComponent =
      reinspectContext?.setRenderCountingForComponent ??
      (() => undefined)
    const isRenderCountingEnabledFor =
      reinspectContext?.isRenderCountingEnabledFor ??
      (() => false)

    const instanceId = `${componentName}-${componentId}`
    const borderColor = getBorderColor(componentName)
    const inspectableByCurrentMode = isInspectableByMode(
      requestedSource,
      requestedScope,
      inspectMode,
    )
    const inspectorActive = config.enabled && isActive && inspectableByCurrentMode
    const shouldCountRendersForComponent =
      inspectableByCurrentMode && isRenderCountingEnabledFor(componentName)
    const isComponentSpecificRenderCountingEnabled = Boolean(
      renderCountComponents[componentName],
    )
    const renderCounts = readAndTrackRenderCount(
      instanceId,
      shouldCountRendersForComponent,
    )

    const currentOverrides = overrides[instanceId]

    const inlineStyles = inspectorActive
      ? buildInlineStyleOverrides(currentOverrides, config.editableProps)
      : {}

    const renderedProps = { ...props, ...propsOverrides } as P
    const effectiveProps = renderedProps as Record<string, unknown>

    const menuOpen = inspectorActive && menuPosition !== null
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

    useEffect(() => {
      trackCommittedRender(instanceId)

      return () => {
        renderCountByInstance.delete(instanceId)
      }
    }, [instanceId])

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

    const shellStyle = {
      '--reinspect-color': borderColor,
      '--reinspect-z-base': config.zIndexBase,
    } as CSSProperties

    const openMenuAtCursor = (event: ReactMouseEvent<HTMLDivElement>) => {
      if (!inspectorActive) {
        return
      }

      event.preventDefault()
      setActivePanel('css')
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
      setMenuPosition({
        x: event.clientX,
        y: event.clientY,
      })
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
        setPropsDraft(serializePropsForRawEditor(props as Record<string, unknown>))
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
        const serialized = serializeValueForJson(propValue)
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

      const serialized = serializeValueForJson(propValue)
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

    const menuElement = menuOpen ? (
      <div
        ref={menuRef}
        className="reinspect-menu"
        role="dialog"
        aria-label={`${componentName} inspector controls`}
        style={{
          top: `${menuPosition.y}px`,
          left: `${menuPosition.x}px`,
        }}
      >
        <p className="reinspect-menu-title">{componentName} inspector</p>
        <label className="reinspect-menu-component-setting">
          <span>Capture renders for this component</span>
          <input
            type="checkbox"
            checked={
              shouldCountRenders
                ? true
                : isComponentSpecificRenderCountingEnabled
            }
            onChange={(event) =>
              setRenderCountingForComponent(
                componentName,
                event.currentTarget.checked,
              )
            }
            disabled={shouldCountRenders}
            aria-label={`Capture renders for ${componentName}`}
            data-testid={`reinspect-component-render-toggle-${componentName}`}
          />
        </label>
        {shouldCountRenders ? (
          <p className="reinspect-setting-note">
            Global capture is enabled from Reinspect settings.
          </p>
        ) : null}

        <div className="reinspect-submenu">
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

        {activePanel === 'css' ? (
          <>
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
            </div>
            <div className="reinspect-menu-grid">
              {filteredEditableProps.map((prop) => {
                const rawValue = currentOverrides?.[prop]
                const fieldId = `${instanceId}-${prop}`

                if (COLOR_STYLE_PROPS.has(prop)) {
                  const colorValue =
                    typeof rawValue === 'string'
                      ? normalizeHexColor(rawValue)
                      : '#1f2937'

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
                    typeof rawValue === 'number' ? rawValue : 1

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
                    typeof rawValue === 'number' ? rawValue : ''

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
                        value={typeof rawValue === 'string' ? rawValue : ''}
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
          </>
        ) : (
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
                  setPropsDraft(serializePropsForRawEditor(effectiveProps))
                }}
              >
                Raw
              </button>
            </div>

            {propsPanelView === 'detected' ? (
              detectedPropsRows.length > 0 ? (
                <div className="reinspect-props-table">
                  <div className="reinspect-props-header">
                    <span>Key</span>
                    <span>Value</span>
                  </div>

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
                          {renderPropsValueTree({
                            value: row.value,
                            onCopy: copyPropsText,
                          })}

                          {isJsonPreviewSupported || canEdit ? (
                            <div className="reinspect-prop-actions">
                              {isJsonPreviewSupported ? (
                                <button
                                  type="button"
                                  data-testid={`reinspect-prop-show-json-${rowTestIdSegment}`}
                                  onClick={() =>
                                    toggleJsonPreviewForProp(row.key, propValue)
                                  }
                                >
                                  {isJsonOpen ? 'Hide JSON' : 'Show JSON'}
                                </button>
                              ) : null}

                              {canEdit ? (
                                <button
                                  type="button"
                                  data-testid={`reinspect-prop-edit-${rowTestIdSegment}`}
                                  onClick={() =>
                                    openEditModalForProp(row.key, propValue)
                                  }
                                >
                                  Edit
                                </button>
                              ) : null}
                            </div>
                          ) : null}

                          {isJsonOpen ? (
                            <div
                              className="reinspect-prop-json-preview"
                              data-testid={`reinspect-prop-json-preview-${rowTestIdSegment}`}
                            >
                              {jsonPreviewError ? (
                                <p className="reinspect-error">{jsonPreviewError}</p>
                              ) : (
                                <>
                                  <pre>{jsonPreview}</pre>
                                  {jsonPreview ? (
                                    <button
                                      type="button"
                                      data-testid={`reinspect-prop-copy-json-${rowTestIdSegment}`}
                                      onClick={() =>
                                        copyPropsText(jsonPreview, 'JSON value')
                                      }
                                    >
                                      Copy JSON
                                    </button>
                                  ) : null}
                                </>
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
        )}
      </div>
    ) : null

    const editModalElement = editingPropKey
      ? createPortal(
          <div
            className="reinspect-modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label={`Edit ${editingPropKey} prop`}
            data-testid="reinspect-prop-edit-modal"
          >
            <div className="reinspect-modal" ref={editModalRef}>
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

    if (requestedSource === 'auto' && !inspectableByCurrentMode) {
      return <SourceComponent {...renderedProps} />
    }

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
              ? ` | ${formatRenderCountLabel(renderCounts, renderCaptureMode)}`
              : ''}
          </span>
        ) : null}

        {menuElement ? createPortal(menuElement, document.body) : null}
        {editModalElement}

        <div
          className="reinspect-content"
          data-reinspect-content="true"
          style={inlineStyles}
        >
          <SourceComponent {...renderedProps} />
        </div>
      </div>
    )
  }

  ReinspectWrappedComponent.displayName = `withReinspect(${componentName})`
  ;(
    ReinspectWrappedComponent as unknown as {
      [REINSPECT_WRAPPED_SYMBOL]: NonNullable<
        ReturnType<typeof getReinspectWrappedMetadata>
      >
    }
  )[REINSPECT_WRAPPED_SYMBOL] = {
    source: requestedSource,
    scope: requestedScope,
    original: SourceComponent,
  }

  return ReinspectWrappedComponent
}
