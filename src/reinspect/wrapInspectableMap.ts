import type { ComponentType } from 'react'
import { withReinspect, type WithReinspectOptions } from './withReinspect'

// `ComponentType<any>` keeps props inference intact across mapped components.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ComponentMap = Record<string, ComponentType<any>>

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
    const optionsForComponent =
      typeof options === 'function' ? options(key, Component) : options?.[key]

    wrappedMap[key] = withReinspect(Component, {
      name: String(key),
      ...optionsForComponent,
    }) as T[typeof key]
  }

  return wrappedMap
}
