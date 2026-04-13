import {
  useCallback,
  useMemo,
  useState,
} from 'react'
import type {
  EditableStyleProp,
  ReinspectContextValue,
  ReinspectProviderProps,
  StyleOverrideValue,
} from './types'
import { ReinspectContext } from './store'
import { useReinspect } from './useReinspect'
import { pickColorByComponentName, resolveReinspectConfig } from './utils'

export function ReinspectProvider({
  children,
  config,
}: ReinspectProviderProps) {
  const resolvedConfig = useMemo(() => resolveReinspectConfig(config), [config])

  const [isActive, setIsActive] = useState(resolvedConfig.startActive)
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
      overrides,
      updateOverride,
      getBorderColor,
    }),
    [resolvedConfig, isActive, overrides, updateOverride, getBorderColor],
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
  const { isActive, setIsActive, config } = useReinspect()

  if (!config.enabled) {
    return null
  }

  return (
    <button
      type="button"
      className="reinspect-floating-toggle"
      data-testid="reinspect-floating-toggle"
      onClick={() => setIsActive((current) => !current)}
      aria-pressed={isActive}
    >
      Reinspect {isActive ? 'ON' : 'OFF'}
    </button>
  )
}
