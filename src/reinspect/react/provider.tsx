import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'
import { reinspectStateReducer, buildInitialReinspectState } from '../core/state'
import type {
  EditableStyleProp,
  InspectFilter,
  InspectMode,
  RenderCounterMode,
  ReinspectContextValue,
  ReinspectProviderProps,
  StyleOverrideValue,
} from '../types'
import { ReinspectContext } from './context'
import { useReinspect } from '../useReinspect'
import {
  compileInspectFilterMatcher,
  isComponentNameInspectableByFilters,
  isInspectMode,
  isRenderCounterMode,
  normalizeInspectFilter,
  persistInspectBlacklist,
  persistInspectMode,
  persistInspectWhitelist,
  pickColorByComponentName,
  reloadWindow,
  resolveReinspectConfig,
} from '../utils'

const RENDER_COUNTERS_SHORT_DESCRIPTION =
  'Controls render counting for wrapped components.'

const RENDER_COUNTERS_LONG_DESCRIPTION =
  'Off disables global counting. Attempts, commits, and both capture rerenders after initial mount.'

const INSPECT_MODE_SHORT_DESCRIPTION =
  'Controls which components are automatically discoverable by Reinspect.'

const INSPECT_MODE_LONG_DESCRIPTION =
  'Only wrapped components uses explicit withReinspect wrappers only. All 1st-party components auto-discovers components under your source tree. All components also attempts dependency components (with safety skips).'

const INSPECT_FILTER_SHORT_DESCRIPTION =
  'Narrows inspectable components by component name patterns.'

const INSPECT_FILTER_LONG_DESCRIPTION =
  'Whitelist includes only matching component names. Blacklist hides matching component names. Blacklist takes precedence when both match.'

function parseFilterPatternsInput(input: string): string[] {
  return input.split(/\r?\n/g)
}

export function ReinspectProvider({
  children,
  config,
}: ReinspectProviderProps) {
  const resolvedConfig = useMemo(() => resolveReinspectConfig(config), [config])
  const [state, dispatch] = useReducer(
    reinspectStateReducer,
    resolvedConfig,
    buildInitialReinspectState,
  )

  useEffect(() => {
    dispatch({
      type: 'hydrate-config',
      config: resolvedConfig,
    })
  }, [resolvedConfig])

  const setIsActive = useCallback(
    (value: boolean | ((current: boolean) => boolean)) => {
      const nextValue =
        typeof value === 'function' ? value(state.isActive) : value
      dispatch({
        type: 'set-is-active',
        value: nextValue,
      })
    },
    [state.isActive],
  )

  const setPendingInspectMode = useCallback(
    (value: InspectMode | ((current: InspectMode) => InspectMode)) => {
      const nextValue =
        typeof value === 'function' ? value(state.pendingInspectMode) : value
      dispatch({
        type: 'set-pending-inspect-mode',
        value: nextValue,
      })
    },
    [state.pendingInspectMode],
  )

  const setInspectWhitelist = useCallback(
    (value: InspectFilter | ((current: InspectFilter) => InspectFilter)) => {
      const nextValue =
        typeof value === 'function' ? value(state.inspectWhitelist) : value
      const normalizedValue = normalizeInspectFilter(nextValue)
      dispatch({
        type: 'set-inspect-whitelist',
        value: normalizedValue,
      })
      persistInspectWhitelist(normalizedValue)
    },
    [state.inspectWhitelist],
  )

  const setInspectBlacklist = useCallback(
    (value: InspectFilter | ((current: InspectFilter) => InspectFilter)) => {
      const nextValue =
        typeof value === 'function' ? value(state.inspectBlacklist) : value
      const normalizedValue = normalizeInspectFilter(nextValue)
      dispatch({
        type: 'set-inspect-blacklist',
        value: normalizedValue,
      })
      persistInspectBlacklist(normalizedValue)
    },
    [state.inspectBlacklist],
  )

  const setRenderCounterMode = useCallback(
    (
      value:
        | RenderCounterMode
        | ((current: RenderCounterMode) => RenderCounterMode),
    ) => {
      const nextValue =
        typeof value === 'function' ? value(state.renderCounterMode) : value
      dispatch({
        type: 'set-render-counter-mode',
        value: nextValue,
      })
    },
    [state.renderCounterMode],
  )

  const updateOverride = useCallback(
    (
      componentId: string,
      prop: EditableStyleProp,
      value: StyleOverrideValue | undefined,
    ) => {
      dispatch({
        type: 'update-override',
        componentId,
        prop,
        value,
      })
    },
    [],
  )

  const setRenderCountingForComponent = useCallback(
    (componentName: string, enabled: boolean) => {
      dispatch({
        type: 'set-render-counting-for-component',
        componentName,
        enabled,
      })
    },
    [],
  )

  const isRenderCountingEnabledFor = useCallback(
    (componentName: string) =>
      state.renderCounterMode !== 'off' ||
      Boolean(state.renderCountComponents[componentName]),
    [state.renderCounterMode, state.renderCountComponents],
  )

  const hasPendingInspectModeChange = state.pendingInspectMode !== state.inspectMode

  const applyInspectMode = useCallback(() => {
    if (!hasPendingInspectModeChange) {
      return
    }

    persistInspectMode(state.pendingInspectMode)
    reloadWindow()
  }, [hasPendingInspectModeChange, state.pendingInspectMode])

  const inspectWhitelistMatcher = useMemo(
    () => compileInspectFilterMatcher(state.inspectWhitelist),
    [state.inspectWhitelist],
  )
  const inspectBlacklistMatcher = useMemo(
    () => compileInspectFilterMatcher(state.inspectBlacklist),
    [state.inspectBlacklist],
  )
  const inspectWhitelistInvalidPatterns = inspectWhitelistMatcher.invalidPatterns
  const inspectBlacklistInvalidPatterns = inspectBlacklistMatcher.invalidPatterns

  const isComponentInspectableByFilters = useCallback(
    (componentName: string) =>
      isComponentNameInspectableByFilters(
        componentName,
        inspectWhitelistMatcher,
        inspectBlacklistMatcher,
      ),
    [inspectWhitelistMatcher, inspectBlacklistMatcher],
  )

  const getBorderColor = useCallback(
    (componentName: string) =>
      pickColorByComponentName(componentName, resolvedConfig.palette),
    [resolvedConfig.palette],
  )

  const contextValue = useMemo<ReinspectContextValue>(
    () => ({
      config: resolvedConfig,
      isActive: resolvedConfig.enabled && state.isActive,
      setIsActive,
      inspectMode: state.inspectMode,
      pendingInspectMode: state.pendingInspectMode,
      setPendingInspectMode,
      hasPendingInspectModeChange,
      applyInspectMode,
      inspectWhitelist: state.inspectWhitelist,
      setInspectWhitelist,
      inspectWhitelistInvalidPatterns,
      inspectBlacklist: state.inspectBlacklist,
      setInspectBlacklist,
      inspectBlacklistInvalidPatterns,
      isComponentInspectableByFilters,
      renderCounterMode: state.renderCounterMode,
      setRenderCounterMode,
      renderCountComponents: state.renderCountComponents,
      setRenderCountingForComponent,
      isRenderCountingEnabledFor,
      overrides: state.overrides,
      updateOverride,
      getBorderColor,
    }),
    [
      resolvedConfig,
      state.isActive,
      setIsActive,
      state.inspectMode,
      state.pendingInspectMode,
      setPendingInspectMode,
      hasPendingInspectModeChange,
      applyInspectMode,
      state.inspectWhitelist,
      setInspectWhitelist,
      inspectWhitelistInvalidPatterns,
      state.inspectBlacklist,
      setInspectBlacklist,
      inspectBlacklistInvalidPatterns,
      isComponentInspectableByFilters,
      state.renderCounterMode,
      setRenderCounterMode,
      state.renderCountComponents,
      setRenderCountingForComponent,
      isRenderCountingEnabledFor,
      state.overrides,
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
    inspectWhitelist,
    setInspectWhitelist,
    inspectWhitelistInvalidPatterns,
    inspectBlacklist,
    setInspectBlacklist,
    inspectBlacklistInvalidPatterns,
    renderCounterMode,
    setRenderCounterMode,
  } = useReinspect()
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const settingsRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isSettingsOpen) {
      return undefined
    }

    const closeIfClickedOutside = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Node)) {
        return
      }

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
                <p className="reinspect-setting-name">INSPECT_WHITELIST</p>
                <p className="reinspect-setting-short-description">
                  {INSPECT_FILTER_SHORT_DESCRIPTION}
                </p>
              </div>

              <span className="reinspect-tooltip-host">
                <button
                  type="button"
                  className="reinspect-tooltip-trigger"
                  aria-label="Explain INSPECT_WHITELIST"
                >
                  ?
                </button>
                <span className="reinspect-tooltip-content" role="tooltip">
                  {INSPECT_FILTER_LONG_DESCRIPTION}
                </span>
              </span>
            </header>

            <label className="reinspect-settings-select-row">
              <span className="reinspect-settings-toggle-label">
                Patterns (one per line)
              </span>
              <textarea
                className="reinspect-settings-textarea"
                data-testid="reinspect-setting-inspect-whitelist-patterns"
                value={inspectWhitelist.patterns.join('\n')}
                aria-label="Inspect whitelist patterns"
                rows={4}
                onChange={(event) =>
                  setInspectWhitelist((current) => ({
                    ...current,
                    patterns: parseFilterPatternsInput(event.currentTarget.value),
                  }))
                }
              />
            </label>

            <label className="reinspect-settings-toggle-row">
              <span className="reinspect-settings-toggle-label">Regex</span>
              <input
                data-testid="reinspect-setting-inspect-whitelist-regex"
                type="checkbox"
                checked={inspectWhitelist.regex}
                onChange={(event) =>
                  setInspectWhitelist((current) => ({
                    ...current,
                    regex: event.currentTarget.checked,
                  }))
                }
              />
            </label>

            <label className="reinspect-settings-toggle-row">
              <span className="reinspect-settings-toggle-label">Whole word</span>
              <input
                data-testid="reinspect-setting-inspect-whitelist-whole-word"
                type="checkbox"
                checked={inspectWhitelist.wholeWord}
                onChange={(event) =>
                  setInspectWhitelist((current) => ({
                    ...current,
                    wholeWord: event.currentTarget.checked,
                  }))
                }
              />
            </label>

            <label className="reinspect-settings-toggle-row">
              <span className="reinspect-settings-toggle-label">Match case</span>
              <input
                data-testid="reinspect-setting-inspect-whitelist-match-case"
                type="checkbox"
                checked={inspectWhitelist.matchCase}
                onChange={(event) =>
                  setInspectWhitelist((current) => ({
                    ...current,
                    matchCase: event.currentTarget.checked,
                  }))
                }
              />
            </label>

            {inspectWhitelistInvalidPatterns.length > 0 ? (
              <p
                className="reinspect-error"
                data-testid="reinspect-setting-inspect-whitelist-invalid"
              >
                Invalid regex patterns ignored:{' '}
                {inspectWhitelistInvalidPatterns.join(', ')}
              </p>
            ) : (
              <p className="reinspect-setting-note">
                Whitelist is empty until at least one valid pattern is provided.
              </p>
            )}
          </section>

          <div className="reinspect-settings-divider" />

          <section className="reinspect-setting-block">
            <header className="reinspect-setting-header">
              <div>
                <p className="reinspect-setting-name">INSPECT_BLACKLIST</p>
                <p className="reinspect-setting-short-description">
                  {INSPECT_FILTER_SHORT_DESCRIPTION}
                </p>
              </div>

              <span className="reinspect-tooltip-host">
                <button
                  type="button"
                  className="reinspect-tooltip-trigger"
                  aria-label="Explain INSPECT_BLACKLIST"
                >
                  ?
                </button>
                <span className="reinspect-tooltip-content" role="tooltip">
                  {INSPECT_FILTER_LONG_DESCRIPTION}
                </span>
              </span>
            </header>

            <label className="reinspect-settings-select-row">
              <span className="reinspect-settings-toggle-label">
                Patterns (one per line)
              </span>
              <textarea
                className="reinspect-settings-textarea"
                data-testid="reinspect-setting-inspect-blacklist-patterns"
                value={inspectBlacklist.patterns.join('\n')}
                aria-label="Inspect blacklist patterns"
                rows={4}
                onChange={(event) =>
                  setInspectBlacklist((current) => ({
                    ...current,
                    patterns: parseFilterPatternsInput(event.currentTarget.value),
                  }))
                }
              />
            </label>

            <label className="reinspect-settings-toggle-row">
              <span className="reinspect-settings-toggle-label">Regex</span>
              <input
                data-testid="reinspect-setting-inspect-blacklist-regex"
                type="checkbox"
                checked={inspectBlacklist.regex}
                onChange={(event) =>
                  setInspectBlacklist((current) => ({
                    ...current,
                    regex: event.currentTarget.checked,
                  }))
                }
              />
            </label>

            <label className="reinspect-settings-toggle-row">
              <span className="reinspect-settings-toggle-label">Whole word</span>
              <input
                data-testid="reinspect-setting-inspect-blacklist-whole-word"
                type="checkbox"
                checked={inspectBlacklist.wholeWord}
                onChange={(event) =>
                  setInspectBlacklist((current) => ({
                    ...current,
                    wholeWord: event.currentTarget.checked,
                  }))
                }
              />
            </label>

            <label className="reinspect-settings-toggle-row">
              <span className="reinspect-settings-toggle-label">Match case</span>
              <input
                data-testid="reinspect-setting-inspect-blacklist-match-case"
                type="checkbox"
                checked={inspectBlacklist.matchCase}
                onChange={(event) =>
                  setInspectBlacklist((current) => ({
                    ...current,
                    matchCase: event.currentTarget.checked,
                  }))
                }
              />
            </label>

            {inspectBlacklistInvalidPatterns.length > 0 ? (
              <p
                className="reinspect-error"
                data-testid="reinspect-setting-inspect-blacklist-invalid"
              >
                Invalid regex patterns ignored:{' '}
                {inspectBlacklistInvalidPatterns.join(', ')}
              </p>
            ) : (
              <p className="reinspect-setting-note">
                Blacklist patterns hide matching components from inspection.
              </p>
            )}
          </section>

          <div className="reinspect-settings-divider" />

          <section className="reinspect-setting-block">
            <header className="reinspect-setting-header">
              <div>
                <p className="reinspect-setting-name">RENDER_COUNTERS</p>
                <p className="reinspect-setting-short-description">
                  {RENDER_COUNTERS_SHORT_DESCRIPTION}
                </p>
              </div>

              <span className="reinspect-tooltip-host">
                <button
                  type="button"
                  className="reinspect-tooltip-trigger"
                  aria-label="Explain RENDER_COUNTERS"
                >
                  ?
                </button>
                <span className="reinspect-tooltip-content" role="tooltip">
                  {RENDER_COUNTERS_LONG_DESCRIPTION}
                </span>
              </span>
            </header>

            <label className="reinspect-settings-select-row">
              <span className="reinspect-settings-toggle-label">Counter mode</span>
              <select
                data-testid="reinspect-setting-render-counters"
                value={renderCounterMode}
                onChange={(event) => {
                  const nextMode = event.currentTarget.value
                  if (isRenderCounterMode(nextMode)) {
                    setRenderCounterMode(nextMode)
                  }
                }}
              >
                <option value="off">Off</option>
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
