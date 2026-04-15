import {
  type KeyboardEvent as ReactKeyboardEvent,
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
  MenuTheme,
  PropsSerializationMode,
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
  isMenuTheme,
  isPropsSerializationMode,
  isRenderCounterMode,
  normalizeInspectFilter,
  persistInspectBlacklist,
  persistInspectMode,
  persistMenuTheme,
  persistPropsSerializationMode,
  persistInspectWhitelist,
  resolveReinspectConfig,
} from '../utils'

type SettingsTab = 'filter' | 'settings'

const componentNameHashCache = new Map<string, number>()

function hashComponentName(componentName: string): number {
  const cachedHash = componentNameHashCache.get(componentName)
  if (cachedHash !== undefined) {
    return cachedHash
  }

  let hash = 0
  for (let index = 0; index < componentName.length; index += 1) {
    hash = Math.imul(31, hash) + componentName.charCodeAt(index)
    hash |= 0
  }

  const unsignedHash = hash >>> 0
  componentNameHashCache.set(componentName, unsignedHash)
  return unsignedHash
}

function colorFromComponentNameHash(componentName: string): string {
  const hash = hashComponentName(componentName)
  const hue = hash % 360
  const saturation = 60 + ((hash >>> 8) % 14)
  const lightness = 52 + ((hash >>> 16) % 8)
  return `hsl(${hue} ${saturation}% ${lightness}%)`
}

function InfoHint({
  label,
  description,
}: {
  label: string
  description: string
}) {
  return (
    <span className="reinspect-inline-hint" title={description} aria-label={description}>
      {label}
    </span>
  )
}

function parseFilterPatternsInput(input: string): string[] {
  return input
    .split(/[\r\n,]+/g)
    .map((pattern) => pattern.trim())
    .filter((pattern) => pattern.length > 0)
}

function appendUniquePatterns(
  existingPatterns: readonly string[],
  incomingPatterns: readonly string[],
): string[] {
  const nextPatterns = [...existingPatterns]
  const seenPatterns = new Set(existingPatterns)

  for (const pattern of incomingPatterns) {
    if (seenPatterns.has(pattern)) {
      continue
    }

    seenPatterns.add(pattern)
    nextPatterns.push(pattern)
  }

  return nextPatterns
}

interface InspectFilterEditorProps {
  title: string
  info: string
  filter: InspectFilter
  setFilter: (
    value: InspectFilter | ((current: InspectFilter) => InspectFilter),
  ) => void
  invalidPatterns: readonly string[]
  patternsInputTestId: string
  regexTestId: string
  wholeWordTestId: string
  matchCaseTestId: string
  invalidMessageTestId: string
}

function InspectFilterEditor({
  title,
  info,
  filter,
  setFilter,
  invalidPatterns,
  patternsInputTestId,
  regexTestId,
  wholeWordTestId,
  matchCaseTestId,
  invalidMessageTestId,
}: InspectFilterEditorProps) {
  const [draftPattern, setDraftPattern] = useState('')
  const livePatternsRef = useRef<string[]>([])

  const addDraftPattern = useCallback(() => {
    const parsedPatterns = parseFilterPatternsInput(draftPattern)
    if (parsedPatterns.length === 0) {
      return
    }

    livePatternsRef.current = []
    setDraftPattern('')
  }, [draftPattern])

  const removePattern = useCallback(
    (pattern: string) => {
      setFilter((current) => ({
        ...current,
        patterns: current.patterns.filter(
          (currentPattern) => currentPattern !== pattern,
        ),
      }))
    },
    [setFilter],
  )

  const clearPatterns = useCallback(() => {
    setFilter((current) => ({
      ...current,
      patterns: [],
    }))
    livePatternsRef.current = []
    setDraftPattern('')
  }, [setFilter])

  const onDraftKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') {
      return
    }

    event.preventDefault()
    addDraftPattern()
  }

  const onDraftPatternChange = (nextDraft: string) => {
    const nextLivePatterns = parseFilterPatternsInput(nextDraft)
    setDraftPattern(nextDraft)
    setFilter((current) => {
      const withoutLivePatterns = current.patterns.filter(
        (pattern) => !livePatternsRef.current.includes(pattern),
      )

      return {
        ...current,
        patterns: appendUniquePatterns(withoutLivePatterns, nextLivePatterns),
      }
    })
    livePatternsRef.current = nextLivePatterns
  }

  return (
    <section className="reinspect-filter-section">
      <div className="reinspect-filter-row-header">
        <p className="reinspect-filter-title">
          {title} <InfoHint label="?" description={info} />
        </p>
        <button
          type="button"
          className="reinspect-filter-clear-button"
          onClick={clearPatterns}
          disabled={filter.patterns.length === 0}
          data-testid={`${patternsInputTestId}-clear`}
        >
          Clear
        </button>
      </div>

      <div className="reinspect-filter-toolbar">
        <span className="reinspect-filter-search-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path
              d="M10.5 3a7.5 7.5 0 015.92 12.1l4.24 4.23a1 1 0 01-1.42 1.42l-4.23-4.24A7.5 7.5 0 1110.5 3zm0 2a5.5 5.5 0 100 11 5.5 5.5 0 000-11z"
              fill="currentColor"
            />
          </svg>
        </span>
        <input
          data-testid={patternsInputTestId}
          className="reinspect-filter-search-input"
          type="search"
          aria-label={`${title} patterns`}
          value={draftPattern}
          placeholder={`Add ${title.toLowerCase()} pattern`}
          onChange={(event) => onDraftPatternChange(event.currentTarget.value)}
          onKeyDown={onDraftKeyDown}
        />

        <button
          type="button"
          className="reinspect-filter-modifier"
          data-state={filter.regex ? 'active' : 'idle'}
          data-testid={regexTestId}
          title="Regex"
          aria-label={`${title} regex modifier`}
          onClick={() =>
            setFilter((current) => ({
              ...current,
              regex: !current.regex,
            }))
          }
        >
          .*
        </button>
        <button
          type="button"
          className="reinspect-filter-modifier"
          data-state={filter.wholeWord ? 'active' : 'idle'}
          data-testid={wholeWordTestId}
          title="Whole word"
          aria-label={`${title} whole-word modifier`}
          onClick={() =>
            setFilter((current) => ({
              ...current,
              wholeWord: !current.wholeWord,
            }))
          }
        >
          W
        </button>
        <button
          type="button"
          className="reinspect-filter-modifier"
          data-state={filter.matchCase ? 'active' : 'idle'}
          data-testid={matchCaseTestId}
          title="Match case"
          aria-label={`${title} case-sensitive modifier`}
          onClick={() =>
            setFilter((current) => ({
              ...current,
              matchCase: !current.matchCase,
            }))
          }
        >
          Aa
        </button>
        <button
          type="button"
          className="reinspect-filter-add-button"
          onClick={addDraftPattern}
          disabled={parseFilterPatternsInput(draftPattern).length === 0}
          data-testid={`${patternsInputTestId}-add`}
        >
          Add
        </button>
      </div>

      {filter.patterns.length > 0 ? (
        <div className="reinspect-filter-chip-list">
          {filter.patterns.map((pattern) => (
            <span className="reinspect-filter-chip" key={pattern}>
              <code>{pattern}</code>
              <button
                type="button"
                className="reinspect-filter-chip-remove"
                aria-label={`Remove ${pattern}`}
                onClick={() => removePattern(pattern)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="reinspect-setting-empty-state">No patterns configured.</p>
      )}

      {invalidPatterns.length > 0 ? (
        <p className="reinspect-error" data-testid={invalidMessageTestId}>
          Invalid regex patterns ignored: {invalidPatterns.join(', ')}
        </p>
      ) : null}
    </section>
  )
}

export function ReinspectProvider({
  children,
  config,
}: ReinspectProviderProps) {
  const resolvedConfig = useMemo(() => resolveReinspectConfig(config), [config])
  const colorCacheRef = useRef<Record<string, string>>({})
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
      persistInspectMode(nextValue)
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

  const setPropsSerializationMode = useCallback(
    (
      value:
        | PropsSerializationMode
        | ((current: PropsSerializationMode) => PropsSerializationMode),
    ) => {
      const nextValue =
        typeof value === 'function' ? value(state.propsSerializationMode) : value
      dispatch({
        type: 'set-props-serialization-mode',
        value: nextValue,
      })
      persistPropsSerializationMode(nextValue)
    },
    [state.propsSerializationMode],
  )

  const setMenuTheme = useCallback(
    (value: MenuTheme | ((current: MenuTheme) => MenuTheme)) => {
      const nextValue = typeof value === 'function' ? value(state.menuTheme) : value
      dispatch({
        type: 'set-menu-theme',
        value: nextValue,
      })
      persistMenuTheme(nextValue)
    },
    [state.menuTheme],
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
    // Kept for backwards compatibility; inspect mode now applies live.
  }, [])

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

  const getColor = useCallback((componentName: string) => {
    const cachedColor = colorCacheRef.current[componentName]
    if (cachedColor) {
      return cachedColor
    }

    const nextColor = colorFromComponentNameHash(componentName)
    colorCacheRef.current[componentName] = nextColor
    return nextColor
  }, [])

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
      propsSerializationMode: state.propsSerializationMode,
      setPropsSerializationMode,
      menuTheme: state.menuTheme,
      setMenuTheme,
      renderCountComponents: state.renderCountComponents,
      setRenderCountingForComponent,
      isRenderCountingEnabledFor,
      overrides: state.overrides,
      updateOverride,
      getColor,
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
      state.propsSerializationMode,
      setPropsSerializationMode,
      state.menuTheme,
      setMenuTheme,
      state.renderCountComponents,
      setRenderCountingForComponent,
      isRenderCountingEnabledFor,
      state.overrides,
      updateOverride,
      getColor,
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
    pendingInspectMode,
    setPendingInspectMode,
    inspectWhitelist,
    setInspectWhitelist,
    inspectWhitelistInvalidPatterns,
    inspectBlacklist,
    setInspectBlacklist,
    inspectBlacklistInvalidPatterns,
    renderCounterMode,
    setRenderCounterMode,
    propsSerializationMode,
    setPropsSerializationMode,
    menuTheme,
    setMenuTheme,
  } = useReinspect()
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<SettingsTab>('filter')
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
    <div
      className="reinspect-floating-root"
      ref={settingsRef}
      data-reinspect-theme={menuTheme}
    >
      <button
        type="button"
        className="reinspect-floating-toggle"
        data-reinspect-theme={menuTheme}
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
          data-reinspect-theme={menuTheme}
          role="dialog"
          aria-label="Reinspect settings"
          data-testid="reinspect-settings-menu"
        >
          <div className="reinspect-settings-header-row">
            <p className="reinspect-settings-title">Reinspect settings</p>
            <div className="reinspect-settings-inline-switch">
              <span className="reinspect-settings-toggle-label">
                {isActive ? 'Enabled' : 'Disabled'}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={isActive}
                aria-label="Toggle inspector enabled"
                data-testid="reinspect-setting-inspector-active"
                className="reinspect-switch-button"
                data-state={isActive ? 'on' : 'off'}
                title={isActive ? 'Disable inspector' : 'Enable inspector'}
                onClick={() => setIsActive(!isActive)}
              />
            </div>
          </div>

          <div
            className="reinspect-settings-tabs"
            role="tablist"
            aria-label="Reinspect settings categories"
          >
            <button
              type="button"
              role="tab"
              id="reinspect-settings-tab-filter"
              data-testid="reinspect-settings-tab-filter"
              data-state={activeTab === 'filter' ? 'active' : 'idle'}
              aria-selected={activeTab === 'filter'}
              aria-controls="reinspect-settings-panel-filter"
              onClick={() => setActiveTab('filter')}
            >
              Filter
            </button>
            <button
              type="button"
              role="tab"
              id="reinspect-settings-tab-settings"
              data-testid="reinspect-settings-tab-settings"
              data-state={activeTab === 'settings' ? 'active' : 'idle'}
              aria-selected={activeTab === 'settings'}
              aria-controls="reinspect-settings-panel-settings"
              onClick={() => setActiveTab('settings')}
            >
              Settings
            </button>
          </div>

          <div className="reinspect-settings-divider" />

          {activeTab === 'filter' ? (
            <div
              className="reinspect-settings-tab-panel"
              role="tabpanel"
              id="reinspect-settings-panel-filter"
              aria-labelledby="reinspect-settings-tab-filter"
            >
              <InspectFilterEditor
                title="Include"
                info="Only matching component names remain inspectable."
                filter={inspectWhitelist}
                setFilter={setInspectWhitelist}
                invalidPatterns={inspectWhitelistInvalidPatterns}
                patternsInputTestId="reinspect-setting-inspect-whitelist-patterns"
                regexTestId="reinspect-setting-inspect-whitelist-regex"
                wholeWordTestId="reinspect-setting-inspect-whitelist-whole-word"
                matchCaseTestId="reinspect-setting-inspect-whitelist-match-case"
                invalidMessageTestId="reinspect-setting-inspect-whitelist-invalid"
              />

              <InspectFilterEditor
                title="Exclude"
                info="Matching component names are hidden from inspection."
                filter={inspectBlacklist}
                setFilter={setInspectBlacklist}
                invalidPatterns={inspectBlacklistInvalidPatterns}
                patternsInputTestId="reinspect-setting-inspect-blacklist-patterns"
                regexTestId="reinspect-setting-inspect-blacklist-regex"
                wholeWordTestId="reinspect-setting-inspect-blacklist-whole-word"
                matchCaseTestId="reinspect-setting-inspect-blacklist-match-case"
                invalidMessageTestId="reinspect-setting-inspect-blacklist-invalid"
              />

              <p className="reinspect-setting-note">
                Exclude patterns override include patterns.
              </p>

              <section className="reinspect-setting-block">
                <label className="reinspect-settings-select-row">
                  <span className="reinspect-settings-toggle-label">
                    Component scope{' '}
                    <InfoHint
                      label="?"
                      description="Choose which component groups can be inspected."
                    />
                  </span>
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
              </section>
            </div>
          ) : (
            <div
              className="reinspect-settings-tab-panel"
              role="tabpanel"
              id="reinspect-settings-panel-settings"
              aria-labelledby="reinspect-settings-tab-settings"
            >
              <section className="reinspect-setting-block">
                <label className="reinspect-settings-select-row">
                  <span className="reinspect-settings-toggle-label">
                    Render counter mode{' '}
                    <InfoHint
                      label="?"
                      description="Pick whether render attempts, commits, both, or no counters are shown."
                    />
                  </span>
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

                <p className="reinspect-setting-note">
                  Per-component capture can be toggled from each component menu.
                </p>

                <label className="reinspect-settings-select-row">
                  <span className="reinspect-settings-toggle-label">
                    Menu theme{' '}
                    <InfoHint
                      label="?"
                      description="Choose the Reinspect menu appearance."
                    />
                  </span>
                  <select
                    data-testid="reinspect-setting-menu-theme"
                    value={menuTheme}
                    onChange={(event) => {
                      const nextTheme = event.currentTarget.value
                      if (isMenuTheme(nextTheme)) {
                        setMenuTheme(nextTheme)
                      }
                    }}
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </label>

                <label className="reinspect-settings-select-row">
                  <span className="reinspect-settings-toggle-label">
                    Props JSON detail{' '}
                    <InfoHint
                      label="?"
                      description="Choose how much data appears in JSON previews and the Raw props editor."
                    />
                  </span>
                  <select
                    data-testid="reinspect-setting-props-serialization-mode"
                    value={propsSerializationMode}
                    onChange={(event) => {
                      const nextMode = event.currentTarget.value
                      if (isPropsSerializationMode(nextMode)) {
                        setPropsSerializationMode(nextMode)
                      }
                    }}
                  >
                    <option value="distilled">Distilled (recommended)</option>
                    <option value="complete">Complete (includes internals)</option>
                  </select>
                </label>
                <p className="reinspect-setting-helper-text">
                  {propsSerializationMode === 'distilled'
                    ? 'Shows app-level props first and hides React internals like _owner.'
                    : 'Shows the full object graph, including React internals and metadata.'}
                </p>
              </section>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
