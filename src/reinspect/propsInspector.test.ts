import { describe, expect, it } from 'vitest'
import {
  buildDetectedPropsRows,
  isEditableChildrenPropValue,
  isEditablePropValue,
  parseEditablePropValueInput,
  parsePropsOverridesInput,
  REINSPECT_PLACEHOLDER_DISPLAY_NAME_KEY,
  REINSPECT_PLACEHOLDER_KEY,
  serializePropsForRawEditor,
  serializeValueForJson,
} from './propsInspector'

describe('propsInspector', () => {
  it('builds shallow detected rows from effective props', () => {
    const rows = buildDetectedPropsRows({
      first: 'a',
      second: 2,
      third: true,
    })

    expect(rows.map((row) => row.key)).toEqual(['first', 'second', 'third'])
    expect(rows[0].value.summary).toBe('"a"')
    expect(rows[1].value.summary).toBe('2')
    expect(rows[2].value.summary).toBe('true')
  })

  it('serializes non-JSON values to placeholders for raw editor prefill', () => {
    const value = {
      title: 'hello',
      onClick: () => undefined,
      nested: {
        token: Symbol('x'),
      },
    }

    const raw = serializePropsForRawEditor(value)
    expect(raw).toContain('"title": "hello"')
    expect(raw).toContain('"nested": {}')
    expect(raw).not.toContain('"onClick"')
    expect(raw).not.toContain('"token"')
    expect(raw).not.toContain(REINSPECT_PLACEHOLDER_KEY)
    expect(raw).not.toContain('"display":')
    expect(raw).not.toContain(REINSPECT_PLACEHOLDER_DISPLAY_NAME_KEY)
  })

  it('includes placeholder display name only in complete mode', () => {
    const distilled = serializePropsForRawEditor({
      onClick: () => undefined,
    })
    expect(distilled).not.toContain(REINSPECT_PLACEHOLDER_DISPLAY_NAME_KEY)
    expect(distilled).not.toContain('"display":')

    const complete = serializePropsForRawEditor(
      {
        onClick: () => undefined,
      },
      { mode: 'complete' },
    )
    expect(complete).toContain(REINSPECT_PLACEHOLDER_DISPLAY_NAME_KEY)
    expect(complete).not.toContain(REINSPECT_PLACEHOLDER_KEY)
    expect(complete).not.toContain('"display":')
  })

  it('strips placeholder-marked values when parsing raw overrides', () => {
    const { parsed, error } = parsePropsOverridesInput(`{
      "title": "next",
      "onClick": {
        "__reinspect_placeholder__": "function",
        "display": "[Function onClick]"
      },
      "settings": {
        "theme": "light",
        "afterSave": {
          "__reinspect_placeholder__": "function",
          "display": "[Function afterSave]"
        }
      }
    }`)

    expect(error).toBeNull()
    expect(parsed).toEqual({
      title: 'next',
      settings: {
        theme: 'light',
      },
    })
  })

  it('skips array branches that still contain placeholder values', () => {
    const { parsed, error } = parsePropsOverridesInput(`{
      "items": [1, {
        "__reinspect_placeholder__": "symbol",
        "display": "Symbol(id)"
      }],
      "count": 2
    }`)

    expect(error).toBeNull()
    expect(parsed).toEqual({
      count: 2,
    })
  })

  it('strips placeholder-marked values with namespaced display key', () => {
    const { parsed, error } = parsePropsOverridesInput(`{
      "onClick": {
        "__reinspect__displayName__": "[Function onClick]"
      },
      "count": 2
    }`)

    expect(error).toBeNull()
    expect(parsed).toEqual({
      count: 2,
    })
  })

  it('returns parse error for non-object raw payloads', () => {
    const { parsed, error } = parsePropsOverridesInput('["x"]')
    expect(parsed).toBeNull()
    expect(error).toContain('must be an object')
  })

  it('serializes a single value to json for lazy preview/edit', () => {
    const json = serializeValueForJson({
      theme: 'dark',
      size: 2,
    })

    expect(json).toContain('"theme": "dark"')
    expect(json).toContain('"size": 2')
  })

  it('distills React element internals by default and keeps them in complete mode', () => {
    const elementLikeValue = {
      $$typeof: Symbol('react.element'),
      type: () => null,
      key: 'item-1',
      props: {
        title: 'Card',
      },
      _owner: {
        tag: 0,
      },
      _store: {},
    }

    const distilled = serializeValueForJson(elementLikeValue)
    expect(distilled).toContain('"key": "item-1"')
    expect(distilled).toContain('"props"')
    expect(distilled).not.toContain('"_owner"')
    expect(distilled).not.toContain('"$$typeof"')

    const complete = serializeValueForJson(elementLikeValue, {
      mode: 'complete',
    })
    expect(complete).toContain('"_owner"')
    expect(complete).toContain('"$$typeof"')
  })

  it('marks only primitives, arrays and plain objects as editable', () => {
    expect(isEditablePropValue('x')).toBe(true)
    expect(isEditablePropValue(1)).toBe(true)
    expect(isEditablePropValue(false)).toBe(true)
    expect(isEditablePropValue(null)).toBe(true)
    expect(isEditablePropValue([1, 2, 3])).toBe(true)
    expect(isEditablePropValue({ value: 1 })).toBe(true)

    expect(isEditablePropValue(() => undefined)).toBe(false)
    expect(isEditablePropValue(Symbol('x'))).toBe(false)
    expect(isEditablePropValue(new Date())).toBe(false)
    expect(isEditablePropValue(undefined)).toBe(false)
  })

  it('only allows json-safe children values for children prop edits', () => {
    expect(isEditableChildrenPropValue('label')).toBe(true)
    expect(isEditableChildrenPropValue(3)).toBe(true)
    expect(isEditableChildrenPropValue(false)).toBe(true)
    expect(isEditableChildrenPropValue(null)).toBe(true)
    expect(isEditableChildrenPropValue(['one', 2, null, [true]])).toBe(true)

    expect(isEditableChildrenPropValue({ key: 'item-1', props: {} })).toBe(false)
    expect(isEditableChildrenPropValue([{ key: 'item-1', props: {} }])).toBe(false)
    expect(isEditableChildrenPropValue(undefined)).toBe(false)
  })

  it('parses editable prop value input', () => {
    expect(parseEditablePropValueInput('"hello"')).toEqual({
      parsed: 'hello',
      error: null,
    })
    expect(parseEditablePropValueInput('[1,2]')).toEqual({
      parsed: [1, 2],
      error: null,
    })
    expect(parseEditablePropValueInput('{"a":1}')).toEqual({
      parsed: { a: 1 },
      error: null,
    })

    const invalid = parseEditablePropValueInput('')
    expect(invalid.parsed).toBeNull()
    expect(invalid.error).toContain('cannot be empty')
  })
})
