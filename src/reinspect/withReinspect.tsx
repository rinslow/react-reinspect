import {
  type ComponentType,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import {
  COLOR_STYLE_PROPS,
  NUMERIC_STYLE_PROPS,
  OPACITY_STYLE_PROP,
} from './constants'
import { useReinspect } from './useReinspect'
import {
  buildInlineStyleOverrides,
  normalizeHexColor,
  parseNumberInput,
} from './utils'
import type { StyleOverrideValue } from './types'

export interface WithReinspectOptions {
  name?: string
}

type InspectorPanel = 'css' | 'props'

function toTitleCase(input: string): string {
  const withSpaces = input.replace(/([A-Z])/g, ' $1').trim()
  return withSpaces.length > 0
    ? withSpaces[0].toUpperCase() + withSpaces.slice(1)
    : input
}

function hasValue(value: StyleOverrideValue | undefined): boolean {
  return value !== undefined && value !== null && value !== ''
}

function getComponentName<P extends object>(
  Component: ComponentType<P>,
  options?: WithReinspectOptions,
): string {
  return options?.name ?? Component.displayName ?? Component.name ?? 'Component'
}

function parsePropsOverride(input: string): {
  parsed: Record<string, unknown> | null
  error: string | null
} {
  const trimmed = input.trim()
  if (trimmed.length === 0) {
    return { parsed: {}, error: null }
  }

  try {
    const parsedValue = JSON.parse(trimmed) as unknown
    if (
      parsedValue === null ||
      typeof parsedValue !== 'object' ||
      Array.isArray(parsedValue)
    ) {
      return {
        parsed: null,
        error: 'Props JSON must be an object (example: {"title":"Demo"}).',
      }
    }

    return {
      parsed: parsedValue as Record<string, unknown>,
      error: null,
    }
  } catch {
    return {
      parsed: null,
      error: 'Invalid JSON. Fix syntax and try Apply again.',
    }
  }
}

export function withReinspect<P extends object>(
  Component: ComponentType<P>,
  options?: WithReinspectOptions,
): ComponentType<P> {
  const componentName = getComponentName(Component, options)

  function ReinspectWrappedComponent(props: P) {
    const componentId = useId()
    const menuRef = useRef<HTMLDivElement | null>(null)

    const { config, getBorderColor, isActive, overrides, updateOverride } =
      useReinspect()

    const [menuPosition, setMenuPosition] = useState<{
      x: number
      y: number
    } | null>(null)
    const [activePanel, setActivePanel] = useState<InspectorPanel>('css')
    const [propsOverrides, setPropsOverrides] = useState<Partial<P>>({})
    const [propsDraft, setPropsDraft] = useState('{}')
    const [propsError, setPropsError] = useState<string | null>(null)

    const instanceId = `${componentName}-${componentId}`
    const borderColor = getBorderColor(componentName)
    const inspectorActive = config.enabled && isActive

    const currentOverrides = overrides[instanceId]

    const inlineStyles = useMemo(
      () =>
        inspectorActive
          ? buildInlineStyleOverrides(currentOverrides, config.editableProps)
          : {},
      [currentOverrides, inspectorActive, config.editableProps],
    )

    const renderedProps = useMemo(
      () => ({ ...props, ...propsOverrides }) as P,
      [props, propsOverrides],
    )

    const menuOpen = inspectorActive && menuPosition !== null

    useEffect(() => {
      if (!menuOpen) {
        return undefined
      }

      const closeMenu = (event: MouseEvent) => {
        const target = event.target as Node
        if (menuRef.current?.contains(target)) {
          return
        }

        setMenuPosition(null)
      }

      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          setMenuPosition(null)
        }
      }

      document.addEventListener('mousedown', closeMenu)
      document.addEventListener('keydown', handleEscape)

      return () => {
        document.removeEventListener('mousedown', closeMenu)
        document.removeEventListener('keydown', handleEscape)
      }
    }, [menuOpen])

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
      setPropsError(null)
      setPropsDraft(JSON.stringify(propsOverrides, null, 2))
      setMenuPosition({
        x: event.clientX,
        y: event.clientY,
      })
    }

    const applyPropsOverrides = () => {
      const { parsed, error } = parsePropsOverride(propsDraft)
      if (error || !parsed) {
        setPropsError(error)
        return
      }

      setPropsOverrides(parsed as Partial<P>)
      setPropsError(null)
    }

    const resetPropsOverrides = () => {
      setPropsOverrides({})
      setPropsDraft('{}')
      setPropsError(null)
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
          <div className="reinspect-menu-grid">
            {config.editableProps.map((prop) => {
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
        ) : (
          <div className="reinspect-props-panel">
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
          </div>
        )}
      </div>
    ) : null

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
          <span className="reinspect-name-badge">{componentName}</span>
        ) : null}

        {menuElement ? createPortal(menuElement, document.body) : null}

        <div
          className="reinspect-content"
          data-reinspect-content="true"
          style={inlineStyles}
        >
          <Component {...renderedProps} />
        </div>
      </div>
    )
  }

  ReinspectWrappedComponent.displayName = `withReinspect(${componentName})`
  return ReinspectWrappedComponent
}
