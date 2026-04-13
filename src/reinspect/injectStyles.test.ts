import { beforeEach, describe, expect, it } from 'vitest'
import { injectReinspectStyles } from './injectStyles'

describe('injectReinspectStyles', () => {
  beforeEach(() => {
    const existing = document.getElementById('reinspect-runtime-styles')
    if (existing) {
      existing.remove()
    }
  })

  it('appends runtime styles to the document head', () => {
    injectReinspectStyles('.reinspect-floating-toggle { color: red; }')

    const styleElement = document.getElementById('reinspect-runtime-styles')
    expect(styleElement).not.toBeNull()
    expect(styleElement?.textContent).toContain('reinspect-floating-toggle')
  })

  it('does not append duplicate style elements', () => {
    injectReinspectStyles('.first { color: red; }')
    injectReinspectStyles('.second { color: blue; }')

    const styleElements = document.querySelectorAll('#reinspect-runtime-styles')
    expect(styleElements).toHaveLength(1)
    expect(styleElements[0]?.textContent).toContain('.first')
    expect(styleElements[0]?.textContent).not.toContain('.second')
  })
})
