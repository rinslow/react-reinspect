import type {
  ComponentStyleOverrides,
  EditableStyleProp,
  InspectFilter,
  InspectMode,
  MenuOpenGesture,
  MenuTheme,
  PropsSerializationMode,
  RenderCounterMode,
  ResolvedReinspectConfig,
  StyleOverrideValue,
} from '../types'

export interface ReinspectState {
  isActive: boolean
  inspectMode: InspectMode
  pendingInspectMode: InspectMode
  inspectWhitelist: InspectFilter
  inspectBlacklist: InspectFilter
  renderCounterMode: RenderCounterMode
  propsSerializationMode: PropsSerializationMode
  menuTheme: MenuTheme
  menuOpenGesture: MenuOpenGesture
  renderCountComponents: Record<string, true>
  overrides: Record<string, ComponentStyleOverrides>
}

interface HydrateConfigAction {
  type: 'hydrate-config'
  config: ResolvedReinspectConfig
}

interface SetIsActiveAction {
  type: 'set-is-active'
  value: boolean
}

interface SetPendingInspectModeAction {
  type: 'set-pending-inspect-mode'
  value: InspectMode
}

interface SetInspectWhitelistAction {
  type: 'set-inspect-whitelist'
  value: InspectFilter
}

interface SetInspectBlacklistAction {
  type: 'set-inspect-blacklist'
  value: InspectFilter
}

interface SetRenderCounterModeAction {
  type: 'set-render-counter-mode'
  value: RenderCounterMode
}

interface SetPropsSerializationModeAction {
  type: 'set-props-serialization-mode'
  value: PropsSerializationMode
}

interface SetMenuThemeAction {
  type: 'set-menu-theme'
  value: MenuTheme
}

interface SetMenuOpenGestureAction {
  type: 'set-menu-open-gesture'
  value: MenuOpenGesture
}

interface SetRenderCountingForComponentAction {
  type: 'set-render-counting-for-component'
  componentName: string
  enabled: boolean
}

interface UpdateOverrideAction {
  type: 'update-override'
  componentId: string
  prop: EditableStyleProp
  value: StyleOverrideValue | undefined
}

export type ReinspectStateAction =
  | HydrateConfigAction
  | SetIsActiveAction
  | SetPendingInspectModeAction
  | SetInspectWhitelistAction
  | SetInspectBlacklistAction
  | SetRenderCounterModeAction
  | SetPropsSerializationModeAction
  | SetMenuThemeAction
  | SetMenuOpenGestureAction
  | SetRenderCountingForComponentAction
  | UpdateOverrideAction

export function buildRenderCountComponentMap(
  componentNames: readonly string[],
): Record<string, true> {
  const map: Record<string, true> = {}
  for (const componentName of componentNames) {
    map[componentName] = true
  }

  return map
}

export function buildInitialReinspectState(
  config: ResolvedReinspectConfig,
): ReinspectState {
  return {
    isActive: config.startActive,
    inspectMode: config.inspectMode,
    pendingInspectMode: config.inspectMode,
    inspectWhitelist: config.inspectWhitelist,
    inspectBlacklist: config.inspectBlacklist,
    renderCounterMode: config.renderCounters,
    propsSerializationMode: config.propsSerializationMode,
    menuTheme: config.menuTheme,
    menuOpenGesture: config.menuOpenGesture,
    renderCountComponents: buildRenderCountComponentMap(
      config.countRendersForComponents,
    ),
    overrides: {},
  }
}

function shallowEqualStringArray(
  left: readonly string[],
  right: readonly string[],
): boolean {
  if (left === right) {
    return true
  }

  if (left.length !== right.length) {
    return false
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false
    }
  }

  return true
}

function shallowEqualInspectFilter(
  left: InspectFilter,
  right: InspectFilter,
): boolean {
  return (
    left.regex === right.regex &&
    left.wholeWord === right.wholeWord &&
    left.matchCase === right.matchCase &&
    shallowEqualStringArray(left.patterns, right.patterns)
  )
}

function shallowEqualMenuOpenGesture(
  left: MenuOpenGesture,
  right: MenuOpenGesture,
): boolean {
  return (
    left.mode === right.mode &&
    left.modifiers.ctrl === right.modifiers.ctrl &&
    left.modifiers.alt === right.modifiers.alt &&
    left.modifiers.shift === right.modifiers.shift &&
    left.modifiers.meta === right.modifiers.meta
  )
}

export function reinspectStateReducer(
  state: ReinspectState,
  action: ReinspectStateAction,
): ReinspectState {
  switch (action.type) {
    case 'hydrate-config': {
      const nextRenderCountComponents = buildRenderCountComponentMap(
        action.config.countRendersForComponents,
      )
      const nextState: ReinspectState = {
        ...state,
        isActive: action.config.enabled ? state.isActive : false,
        inspectMode: action.config.inspectMode,
        pendingInspectMode: action.config.inspectMode,
        inspectWhitelist: action.config.inspectWhitelist,
        inspectBlacklist: action.config.inspectBlacklist,
        renderCounterMode: action.config.renderCounters,
        propsSerializationMode: action.config.propsSerializationMode,
        menuTheme: action.config.menuTheme,
        menuOpenGesture: action.config.menuOpenGesture,
        renderCountComponents: nextRenderCountComponents,
      }

      if (
        nextState.isActive === state.isActive &&
        nextState.inspectMode === state.inspectMode &&
        nextState.pendingInspectMode === state.pendingInspectMode &&
        shallowEqualInspectFilter(
          nextState.inspectWhitelist,
          state.inspectWhitelist,
        ) &&
        shallowEqualInspectFilter(
          nextState.inspectBlacklist,
          state.inspectBlacklist,
        ) &&
        nextState.renderCounterMode === state.renderCounterMode &&
        nextState.propsSerializationMode === state.propsSerializationMode &&
        nextState.menuTheme === state.menuTheme &&
        shallowEqualMenuOpenGesture(
          nextState.menuOpenGesture,
          state.menuOpenGesture,
        ) &&
        shallowEqualStringArray(
          Object.keys(nextState.renderCountComponents),
          Object.keys(state.renderCountComponents),
        )
      ) {
        return state
      }

      return nextState
    }

    case 'set-is-active':
      if (state.isActive === action.value) {
        return state
      }
      return {
        ...state,
        isActive: action.value,
      }

    case 'set-pending-inspect-mode':
      if (
        state.pendingInspectMode === action.value &&
        state.inspectMode === action.value
      ) {
        return state
      }
      return {
        ...state,
        inspectMode: action.value,
        pendingInspectMode: action.value,
      }

    case 'set-inspect-whitelist':
      if (shallowEqualInspectFilter(state.inspectWhitelist, action.value)) {
        return state
      }
      return {
        ...state,
        inspectWhitelist: action.value,
      }

    case 'set-inspect-blacklist':
      if (shallowEqualInspectFilter(state.inspectBlacklist, action.value)) {
        return state
      }
      return {
        ...state,
        inspectBlacklist: action.value,
      }

    case 'set-render-counter-mode':
      if (state.renderCounterMode === action.value) {
        return state
      }
      return {
        ...state,
        renderCounterMode: action.value,
      }

    case 'set-props-serialization-mode':
      if (state.propsSerializationMode === action.value) {
        return state
      }
      return {
        ...state,
        propsSerializationMode: action.value,
      }

    case 'set-menu-theme':
      if (state.menuTheme === action.value) {
        return state
      }
      return {
        ...state,
        menuTheme: action.value,
      }

    case 'set-menu-open-gesture':
      if (shallowEqualMenuOpenGesture(state.menuOpenGesture, action.value)) {
        return state
      }
      return {
        ...state,
        menuOpenGesture: action.value,
      }

    case 'set-render-counting-for-component': {
      if (action.enabled) {
        if (state.renderCountComponents[action.componentName]) {
          return state
        }

        return {
          ...state,
          renderCountComponents: {
            ...state.renderCountComponents,
            [action.componentName]: true,
          },
        }
      }

      if (!state.renderCountComponents[action.componentName]) {
        return state
      }

      const nextMap = { ...state.renderCountComponents }
      delete nextMap[action.componentName]
      return {
        ...state,
        renderCountComponents: nextMap,
      }
    }

    case 'update-override': {
      const existingEntry = state.overrides[action.componentId] ?? {}
      const nextEntry: ComponentStyleOverrides = { ...existingEntry }

      if (action.value === undefined || action.value === null || action.value === '') {
        delete nextEntry[action.prop]
      } else {
        nextEntry[action.prop] = action.value
      }

      if (Object.keys(nextEntry).length === 0) {
        if (!state.overrides[action.componentId]) {
          return state
        }

        const nextOverrides = { ...state.overrides }
        delete nextOverrides[action.componentId]
        return {
          ...state,
          overrides: nextOverrides,
        }
      }

      return {
        ...state,
        overrides: {
          ...state.overrides,
          [action.componentId]: nextEntry,
        },
      }
    }

    default:
      return state
  }
}
