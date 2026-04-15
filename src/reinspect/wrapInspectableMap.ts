import type { ComponentType } from 'react'
import { withReinspect, type WithReinspectOptions } from './withReinspect'

type ComponentMap = Record<string, ComponentType<unknown>>

type WrapInspectableMapOptions<T extends ComponentMap> =
  | Partial<Record<keyof T, WithReinspectOptions>>
  | ((key: keyof T, component: T[keyof T]) => WithReinspectOptions | undefined)

export function wrapInspectableMap<T extends ComponentMap>(
  componentMap: T,
  options?: WrapInspectableMapOptions<T>,
): { [K in keyof T]: T[K] } {
  const wrappedMap = {} as { [K in keyof T]: T[K] }

  for (const key of Object.keys(componentMap) as Array<keyof T>) {
    const Component = componentMap[key]
    if (!Component) {
      continue
    }

    const optionsForComponent =
      typeof options === 'function' ? options(key, Component) : options?.[key]

    wrappedMap[key] = withReinspect(Component, optionsForComponent) as T[typeof key]
  }

  return wrappedMap
}
