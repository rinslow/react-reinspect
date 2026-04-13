import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type {
  EditableStyleProp,
  InspectMode,
  RenderCaptureMode,
  ReinspectContextValue,
  ReinspectProviderProps,
  StyleOverrideValue,
} from './types'
import { ReinspectContext } from './store'
import { useReinspect } from './useReinspect'
import {
  isInspectMode,
  isRenderCaptureMode,
  persistInspectMode,
  pickColorByComponentName,
  reloadWindow,
  resolveReinspectConfig,
} from './utils'

const SHOULD_COUNT_RENDERS_SHORT_DESCRIPTION =
  'Capture rerenders and show totals next to component badges.'

const SHOULD_COUNT_RENDERS_LONG_DESCRIPTION =
  'Tracks every rerender after initial mount for wrapped components. Use this toggle to capture for all components, or enable a specific component from its right-click inspector menu.'

const RENDER_CAPTURE_MODE_SHORT_DESCRIPTION =
  'Choose whether to count render attempts, committed renders, or both.'

const RENDER_CAPTURE_MODE_LONG_DESCRIPTION =
  'Render attempts track render-phase executions (includes Strict Mode extra passes). Committed renders track completed DOM commits. Both shows both counters together.'

const INSPECT_MODE_SHORT_DESCRIPTION =
  'Controls which components are automatically discoverable by Reinspect.'

const INSPECT_MODE_LONG_DESCRIPTION =
  'Only wrapped components uses explicit withReinspect wrappers only. All 1st-party components auto-discovers components under your source tree. All components also attempts dependency components (with safety skips).'

function buildInitialRenderCountComponents(
  componentNames: string[],
): Record<string, boolean> {
  const initialEnabledMap: Record<string, boolean> = {}
  for (const componentName of componentNames) {
    initialEnabledMap[componentName] = true
  }

  return initialEnabledMap
}

export function ReinspectProvider({
  children,
  config,
}: ReinspectProviderProps) {
  const resolvedConfig = useMemo(() => resolveReinspectConfig(config), [config])

  const [isActive, setIsActive] = useState(resolvedConfig.startActive)
  const [inspectMode] = useState<InspectMode>(resolvedConfig.inspectMode)
  const [pendingInspectMode, setPendingInspectMode] = useState<InspectMode>(
    resolvedConfig.inspectMode,
  )
  const [shouldCountRenders, setShouldCountRenders] = useState(
    resolvedConfig.shouldCountRenders,
  )
  const [renderCaptureMode, setRenderCaptureMode] = useState<RenderCaptureMode>(
    resolvedConfig.renderCaptureMode,
  )
  const [renderCountComponents, setRenderCountComponents] = useState<
    Record<string, boolean>
  >(() =>
    buildInitialRenderCountComponents(resolvedConfig.countRendersForComponents),
  )
  const [overrides, setOverrides] = useState<ReinspectContextValue['overrides']>(
    {},
  )

  const updateOverride = useCallback(
    (
      componentId: string,
      prop: EditableStyleProp,
      value: StyleOverrideValue | undefined,
    ) => {
      setOverrides((current) => {
        const existingEntry = current[componentId] ?? {}
        const nextEntry = { ...existingEntry }

        if (value === undefined || value === null || value === '') {
          delete nextEntry[prop]
        } else {
          nextEntry[prop] = value
        }

        if (Object.keys(nextEntry).length === 0) {
          const nextOverrides = { ...current }
          delete nextOverrides[componentId]
          return nextOverrides
        }

        return {
          ...current,
          [componentId]: nextEntry,
        }
      })
    },
    [],
  )

  const setRenderCountingForComponent = useCallback(
    (componentName: string, enabled: boolean) => {
      setRenderCountComponents((current) => {
        if (enabled) {
          return {
            ...current,
            [componentName]: true,
          }
        }

        if (!current[componentName]) {
          return current
        }

        const nextEnabledMap = { ...current }
        delete nextEnabledMap[componentName]
        return nextEnabledMap
      })
    },
    [],
  )

  const isRenderCountingEnabledFor = useCallback(
    (componentName: string) =>
      shouldCountRenders || Boolean(renderCountComponents[componentName]),
    [shouldCountRenders, renderCountComponents],
  )

  const hasPendingInspectModeChange = pendingInspectMode !== inspectMode

  const applyInspectMode = useCallback(() => {
    if (!hasPendingInspectModeChange) {
      return
    }

    persistInspectMode(pendingInspectMode)
    reloadWindow()
  }, [hasPendingInspectModeChange, pendingInspectMode])

  const getBorderColor = useCallback(
    (componentName: string) =>
      pickColorByComponentName(componentName, resolvedConfig.palette),
    [resolvedConfig.palette],
  )

  const contextValue = useMemo<ReinspectContextValue>(
    () => ({
      config: resolvedConfig,
      isActive: resolvedConfig.enabled && isActive,
      setIsActive,
      inspectMode,
      pendingInspectMode,
      setPendingInspectMode,
      hasPendingInspectModeChange,
      applyInspectMode,
      shouldCountRenders,
      setShouldCountRenders,
      renderCaptureMode,
      setRenderCaptureMode,
      renderCountComponents,
      setRenderCountingForComponent,
      isRenderCountingEnabledFor,
      overrides,
      updateOverride,
      getBorderColor,
    }),
    [
      resolvedConfig,
      isActive,
      inspectMode,
      pendingInspectMode,
      setPendingInspectMode,
      hasPendingInspectModeChange,
      applyInspectMode,
      shouldCountRenders,
      renderCaptureMode,
      renderCountComponents,
      setRenderCountingForComponent,
      isRenderCountingEnabledFor,
      overrides,
      updateOverride,
      getBorderColor,
    ],
  )

  return (
    <ReinspectContext.Provider value={contextValue}>
      {children}
      {resolvedConfig.enabled && resolvedConfig.showFloatingToggle ? (
        <ReinspectFloatingToggle />
      ) : null}
    </ReinspectContext.Provider>
  )
}

export function ReinspectFloatingToggle() {
  const {
    config,
    isActive,
    setIsActive,
    inspectMode,
    pendingInspectMode,
    setPendingInspectMode,
    hasPendingInspectModeChange,
    applyInspectMode,
    shouldCountRenders,
    setShouldCountRenders,
    renderCaptureMode,
    setRenderCaptureMode,
  } = useReinspect()
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const settingsRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isSettingsOpen) {
      return undefined
    }

    const closeIfClickedOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (settingsRef.current?.contains(target)) {
        return
      }

      setIsSettingsOpen(false)
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSettingsOpen(false)
      }
    }

    document.addEventListener('mousedown', closeIfClickedOutside)
    document.addEventListener('keydown', closeOnEscape)

    return () => {
      document.removeEventListener('mousedown', closeIfClickedOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isSettingsOpen])

  if (!config.enabled) {
    return null
  }

  return (
    <div className="reinspect-floating-root" ref={settingsRef}>
      <button
        type="button"
        className="reinspect-floating-toggle"
        data-testid="reinspect-floating-toggle"
        onClick={() => setIsSettingsOpen((current) => !current)}
        aria-expanded={isSettingsOpen}
        aria-controls="reinspect-settings-menu"
      >
        Reinspect settings
      </button>

      {isSettingsOpen ? (
        <div
          id="reinspect-settings-menu"
          className="reinspect-settings-menu"
          role="dialog"
          aria-label="Reinspect settings"
          data-testid="reinspect-settings-menu"
        >
          <p className="reinspect-settings-title">Reinspect settings</p>

          <label className="reinspect-settings-toggle-row">
            <span className="reinspect-settings-toggle-label">
              Inspector enabled
            </span>
            <input
              data-testid="reinspect-setting-inspector-active"
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.currentTarget.checked)}
            />
          </label>

          <div className="reinspect-settings-divider" />

          <section className="reinspect-setting-block">
            <header className="reinspect-setting-header">
              <div>
                <p className="reinspect-setting-name">INSPECT_MODE</p>
                <p className="reinspect-setting-short-description">
                  {INSPECT_MODE_SHORT_DESCRIPTION}
                </p>
              </div>

              <span className="reinspect-tooltip-host">
                <button
                  type="button"
                  className="reinspect-tooltip-trigger"
                  aria-label="Explain INSPECT_MODE"
                >
                  ?
                </button>
                <span className="reinspect-tooltip-content" role="tooltip">
                  {INSPECT_MODE_LONG_DESCRIPTION}
                </span>
              </span>
            </header>

            <label className="reinspect-settings-select-row">
              <span className="reinspect-settings-toggle-label">Inspect Mode</span>
              <select
                data-testid="reinspect-setting-inspect-mode"
                value={pendingInspectMode}
                onChange={(event) => {
                  const nextMode = event.currentTarget.value
                  if (isInspectMode(nextMode)) {
                    setPendingInspectMode(nextMode)
                  }
                }}
              >
                <option value="wrapped">Only wrapped components</option>
                <option value="first-party">All 1st-party components</option>
                <option value="all">All components</option>
              </select>
            </label>

            <button
              type="button"
              className="reinspect-apply-button"
              data-testid="reinspect-apply-inspect-mode"
              onClick={applyInspectMode}
              disabled={!hasPendingInspectModeChange}
            >
              Apply &amp; Reload
            </button>

            {hasPendingInspectModeChange ? (
              <p
                className="reinspect-setting-note"
                data-testid="reinspect-inspect-mode-reload-note"
              >
                Inspect mode changes are applied after reload.
              </p>
            ) : (
              <p className="reinspect-setting-note">
                Current mode: {inspectMode}
              </p>
            )}
          </section>

          <div className="reinspect-settings-divider" />

          <section className="reinspect-setting-block">
            <header className="reinspect-setting-header">
              <div>
                <p className="reinspect-setting-name">SHOULD_COUNT_RENDERS</p>
                <p className="reinspect-setting-short-description">
                  {SHOULD_COUNT_RENDERS_SHORT_DESCRIPTION}
                </p>
              </div>

              <span className="reinspect-tooltip-host">
                <button
                  type="button"
                  className="reinspect-tooltip-trigger"
                  aria-label="Explain SHOULD_COUNT_RENDERS"
                >
                  ?
                </button>
                <span className="reinspect-tooltip-content" role="tooltip">
                  {SHOULD_COUNT_RENDERS_LONG_DESCRIPTION}
                </span>
              </span>
            </header>

            <label className="reinspect-settings-toggle-row">
              <span className="reinspect-settings-toggle-label">
                Capture render for all components
              </span>
              <input
                data-testid="reinspect-setting-should-count-renders"
                type="checkbox"
                checked={shouldCountRenders}
                onChange={(event) =>
                  setShouldCountRenders(event.currentTarget.checked)
                }
              />
            </label>

            <header className="reinspect-setting-header">
              <div>
                <p className="reinspect-setting-name">RENDER_CAPTURE_MODE</p>
                <p className="reinspect-setting-short-description">
                  {RENDER_CAPTURE_MODE_SHORT_DESCRIPTION}
                </p>
              </div>

              <span className="reinspect-tooltip-host">
                <button
                  type="button"
                  className="reinspect-tooltip-trigger"
                  aria-label="Explain RENDER_CAPTURE_MODE"
                >
                  ?
                </button>
                <span className="reinspect-tooltip-content" role="tooltip">
                  {RENDER_CAPTURE_MODE_LONG_DESCRIPTION}
                </span>
              </span>
            </header>

            <label className="reinspect-settings-select-row">
              <span className="reinspect-settings-toggle-label">Capture mode</span>
              <select
                data-testid="reinspect-setting-render-capture-mode"
                value={renderCaptureMode}
                onChange={(event) => {
                  const nextMode = event.currentTarget.value
                  if (isRenderCaptureMode(nextMode)) {
                    setRenderCaptureMode(nextMode)
                  }
                }}
              >
                <option value="attempts">Render attempts</option>
                <option value="commits">Committed renders</option>
                <option value="both">Both</option>
              </select>
            </label>
          </section>
        </div>
      ) : null}
    </div>
  )
}
