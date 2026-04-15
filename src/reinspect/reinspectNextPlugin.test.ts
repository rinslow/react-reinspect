import { describe, expect, it } from 'vitest'
import reinspectNextAutoDiscoverLoader from '../plugin/reinspectNextAutoDiscoverLoader'
import { withReinspectAutoDiscover } from '../plugin/reinspectNextPlugin'

describe('withReinspectAutoDiscover', () => {
  it('injects loader rule in dev webpack config', () => {
    const wrappedConfig = withReinspectAutoDiscover({})
    const webpackConfig = wrappedConfig.webpack?.(
      { module: { rules: [] } },
      { dev: true },
    )

    expect(webpackConfig?.module?.rules?.length).toBe(1)
  })

  it('does not inject loader rule for server webpack builds', () => {
    const wrappedConfig = withReinspectAutoDiscover({})
    const webpackConfig = wrappedConfig.webpack?.(
      { module: { rules: [] } },
      { dev: true, isServer: true },
    )

    expect(webpackConfig?.module?.rules?.length).toBe(0)
  })

  it('does not inject loader rule in production by default', () => {
    const wrappedConfig = withReinspectAutoDiscover({})
    const webpackConfig = wrappedConfig.webpack?.(
      { module: { rules: [] } },
      { dev: false },
    )

    expect(webpackConfig?.module?.rules?.length).toBe(0)
  })
})

describe('reinspectNextAutoDiscoverLoader', () => {
  it('wraps first-party components with autoWrapInspectable', () => {
    const source = `
      const Card = () => <div>card</div>
      export default Card
    `

    const transformed = reinspectNextAutoDiscoverLoader.call(
      {
        resourcePath: '/repo/src/Card.tsx',
      },
      source,
    )

    expect(transformed).toContain('autoWrapInspectable')
    expect(transformed).toContain('from "react-reinspect/internal/auto-wrap"')
  })

  it('skips third-party modules by default', () => {
    const source = `
      const VendorCard = () => <div>card</div>
      export default VendorCard
    `

    const transformed = reinspectNextAutoDiscoverLoader.call(
      {
        resourcePath: '/repo/node_modules/vendor-lib/Card.js',
      },
      source,
    )

    expect(transformed).toBe(source)
  })

  it('supports third-party transforms when enabled', () => {
    const source = `
      const VendorCard = () => <div>card</div>
      export default VendorCard
    `

    const transformed = reinspectNextAutoDiscoverLoader.call(
      {
        resourcePath: '/repo/node_modules/vendor-lib/Card.js',
        getOptions() {
          return { includeThirdParty: true }
        },
      },
      source,
    )

    expect(transformed).toContain('autoWrapInspectable')
  })
})
