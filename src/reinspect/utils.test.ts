import { beforeEach, describe, expect, it } from 'vitest'
import {
  compileInspectFilterMatcher,
  isComponentNameInspectableByFilters,
  normalizeInspectFilter,
  REINSPECT_INSPECT_BLACKLIST_STORAGE_KEY,
  REINSPECT_INSPECT_WHITELIST_STORAGE_KEY,
  REINSPECT_PROPS_SERIALIZATION_MODE_STORAGE_KEY,
  resolveReinspectConfig,
} from './utils'

describe('inspect filter utils', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it('normalizes filter patterns by trimming and dropping empty values', () => {
    const normalized = normalizeInspectFilter({
      patterns: ['  Header  ', '', '   ', 'Footer'],
      regex: true,
      wholeWord: false,
      matchCase: true,
    })

    expect(normalized).toEqual({
      patterns: ['Header', 'Footer'],
      regex: true,
      wholeWord: false,
      matchCase: true,
    })
  })

  it('matches literal patterns as case-insensitive substrings by default', () => {
    const matcher = compileInspectFilterMatcher({
      patterns: ['card'],
      regex: false,
      wholeWord: false,
      matchCase: false,
    })

    expect(matcher.hasPatterns).toBe(true)
    expect(matcher.matches('UserCard')).toBe(true)
    expect(matcher.matches('CARD_GRID')).toBe(true)
    expect(matcher.matches('Toolbar')).toBe(false)
  })

  it('supports regex matching with case-sensitive mode', () => {
    const matcher = compileInspectFilterMatcher({
      patterns: ['^Card[A-Z]+$'],
      regex: true,
      wholeWord: false,
      matchCase: true,
    })

    expect(matcher.matches('CardABC')).toBe(true)
    expect(matcher.matches('Cardabc')).toBe(false)
  })

  it('supports whole-word matching for literal patterns', () => {
    const matcher = compileInspectFilterMatcher({
      patterns: ['Card'],
      regex: false,
      wholeWord: true,
      matchCase: false,
    })

    expect(matcher.matches('Card')).toBe(true)
    expect(matcher.matches('Main Card Panel')).toBe(true)
    expect(matcher.matches('CardHeader')).toBe(false)
  })

  it('ignores invalid regex patterns and reports them', () => {
    const matcher = compileInspectFilterMatcher({
      patterns: ['[', 'Header'],
      regex: true,
      wholeWord: false,
      matchCase: false,
    })

    expect(matcher.invalidPatterns).toEqual(['['])
    expect(matcher.hasPatterns).toBe(true)
    expect(matcher.matches('Header')).toBe(true)
  })

  it('evaluates whitelist and blacklist with blacklist precedence', () => {
    const whitelist = compileInspectFilterMatcher({
      patterns: ['Card'],
      regex: false,
      wholeWord: false,
      matchCase: false,
    })
    const blacklist = compileInspectFilterMatcher({
      patterns: ['DebugCard'],
      regex: false,
      wholeWord: false,
      matchCase: false,
    })

    expect(
      isComponentNameInspectableByFilters('UserCard', whitelist, blacklist),
    ).toBe(true)
    expect(
      isComponentNameInspectableByFilters('DebugCard', whitelist, blacklist),
    ).toBe(false)
    expect(
      isComponentNameInspectableByFilters('Toolbar', whitelist, blacklist),
    ).toBe(false)
  })

  it('resolves session-stored filters over config filters', () => {
    window.sessionStorage.setItem(
      REINSPECT_INSPECT_WHITELIST_STORAGE_KEY,
      JSON.stringify({
        patterns: ['StoredAllow'],
        regex: false,
        wholeWord: false,
        matchCase: false,
      }),
    )
    window.sessionStorage.setItem(
      REINSPECT_INSPECT_BLACKLIST_STORAGE_KEY,
      JSON.stringify({
        patterns: ['StoredBlock'],
        regex: true,
        wholeWord: false,
        matchCase: true,
      }),
    )

    const resolved = resolveReinspectConfig({
      inspectWhitelist: {
        patterns: ['ConfigAllow'],
        regex: false,
        wholeWord: false,
        matchCase: false,
      },
      inspectBlacklist: {
        patterns: ['ConfigBlock'],
        regex: false,
        wholeWord: false,
        matchCase: false,
      },
    })

    expect(resolved.inspectWhitelist).toEqual({
      patterns: ['StoredAllow'],
      regex: false,
      wholeWord: false,
      matchCase: false,
    })
    expect(resolved.inspectBlacklist).toEqual({
      patterns: ['StoredBlock'],
      regex: true,
      wholeWord: false,
      matchCase: true,
    })
  })

  it('resolves session-stored props detail mode over config mode', () => {
    window.sessionStorage.setItem(
      REINSPECT_PROPS_SERIALIZATION_MODE_STORAGE_KEY,
      'complete',
    )

    const resolved = resolveReinspectConfig({
      propsSerializationMode: 'distilled',
    })

    expect(resolved.propsSerializationMode).toBe('complete')
  })
})
