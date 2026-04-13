import { describe, expect, it } from 'vitest'
import {
  shouldSkipThirdPartyModule,
  transformModuleForAutoDiscover,
} from '../../reinspectAutoDiscoverPlugin'

describe('transformModuleForAutoDiscover', () => {
  it('wraps top-level PascalCase function declarations', () => {
    const input = `
      import React from 'react'
      function TodoHeader() {
        return <h1>title</h1>
      }
    `

    const output = transformModuleForAutoDiscover(
      input,
      '/app/src/TodoHeader.tsx',
      'first-party',
    )

    expect(output.modified).toBe(true)
    expect(output.code).toContain(
      "import { autoWrapInspectable } from \"/src/reinspect/autoWrap\";",
    )
    expect(output.code).toContain('TodoHeader = autoWrapInspectable(TodoHeader')
  })

  it('wraps PascalCase variable components and memo/forwardRef calls', () => {
    const input = `
      import { memo } from 'react'
      const Card = () => <div>card</div>
      const Item = memo(function Item() {
        return <li />
      })
    `

    const output = transformModuleForAutoDiscover(
      input,
      '/app/src/components.tsx',
      'first-party',
    )

    expect(output.modified).toBe(true)
    expect(output.code).toContain('const Card = autoWrapInspectable(')
    expect(output.code).toContain('const Item = autoWrapInspectable(')
  })

  it('does not rewrite non-component helper declarations', () => {
    const input = `
      const helper = () => 42
      function runTask() {
        return helper()
      }
    `

    const output = transformModuleForAutoDiscover(
      input,
      '/app/src/helpers.ts',
      'first-party',
    )

    expect(output.modified).toBe(false)
  })

  it('rewrites anonymous default exports into wrapped local bindings', () => {
    const input = `
      export default function () {
        return <main />
      }
    `

    const output = transformModuleForAutoDiscover(
      input,
      '/app/src/Page.tsx',
      'first-party',
    )

    expect(output.modified).toBe(true)
    expect(output.code).toContain(
      'const __reinspect_default_component = autoWrapInspectable(',
    )
    expect(output.code).toContain('export default __reinspect_default_component;')
  })

  it('does not double-wrap already wrapped initializers', () => {
    const input = `
      import { withReinspect } from './reinspect'
      const Card = withReinspect(() => <div />)
    `

    const output = transformModuleForAutoDiscover(
      input,
      '/app/src/AlreadyWrapped.tsx',
      'first-party',
    )

    expect(output.modified).toBe(false)
  })
})

describe('shouldSkipThirdPartyModule', () => {
  it('skips known unsafe third-party internals', () => {
    expect(
      shouldSkipThirdPartyModule('/repo/node_modules/react/index.js'),
    ).toBe(true)
    expect(
      shouldSkipThirdPartyModule('/repo/node_modules/react-dom/client.js'),
    ).toBe(true)
  })

  it('allows non-skipped third-party modules', () => {
    expect(
      shouldSkipThirdPartyModule('/repo/node_modules/some-ui-lib/index.js'),
    ).toBe(false)
  })
})
