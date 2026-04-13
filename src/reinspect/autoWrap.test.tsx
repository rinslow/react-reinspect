import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { autoWrapInspectable } from './autoWrap'
import { ReinspectProvider } from './context'
import type { ReinspectConfig } from './types'
import { withReinspect } from './withReinspect'

const baseConfig: ReinspectConfig = {
  enabled: true,
  startActive: true,
  showFloatingToggle: false,
}

function renderWithConfig(
  ui: ReactNode,
  configOverrides: ReinspectConfig = {},
) {
  return render(
    <ReinspectProvider config={{ ...baseConfig, ...configOverrides }}>
      {ui}
    </ReinspectProvider>,
  )
}

describe('autoWrapInspectable', () => {
  it('does not throw when auto-wrapped components render outside provider', () => {
    const AutoRoot = autoWrapInspectable(
      () => <p>auto root</p>,
      {
        scope: 'first-party',
        fallbackName: 'AutoRoot',
      },
    )

    expect(() => render(<AutoRoot />)).not.toThrow()
    expect(screen.getByText('auto root')).toBeInTheDocument()
  })

  it('does not render inspector shell in wrapped mode for auto-wrapped components', () => {
    const AutoCard = autoWrapInspectable(
      () => <p>auto card</p>,
      {
        scope: 'first-party',
        fallbackName: 'AutoCard',
      },
    )

    renderWithConfig(<AutoCard />, { inspectMode: 'wrapped' })

    expect(screen.queryByTestId('reinspect-shell-AutoCard')).not.toBeInTheDocument()
    expect(screen.getByText('auto card')).toBeInTheDocument()
  })

  it('renders first-party auto-wrapped components in first-party mode', () => {
    const AutoCard = autoWrapInspectable(
      () => <p>auto card</p>,
      {
        scope: 'first-party',
        fallbackName: 'AutoCard',
      },
    )

    renderWithConfig(<AutoCard />, { inspectMode: 'first-party' })

    expect(screen.getByTestId('reinspect-shell-AutoCard')).toBeInTheDocument()
  })

  it('hides third-party auto-wrapped components in first-party mode', () => {
    const VendorCard = autoWrapInspectable(
      () => <p>vendor card</p>,
      {
        scope: 'third-party',
        fallbackName: 'VendorCard',
      },
    )

    renderWithConfig(<VendorCard />, { inspectMode: 'first-party' })

    expect(
      screen.queryByTestId('reinspect-shell-VendorCard'),
    ).not.toBeInTheDocument()
    expect(screen.getByText('vendor card')).toBeInTheDocument()
  })

  it('shows third-party auto-wrapped components in all-components mode', () => {
    const VendorCard = autoWrapInspectable(
      () => <p>vendor card</p>,
      {
        scope: 'third-party',
        fallbackName: 'VendorCard',
      },
    )

    renderWithConfig(<VendorCard />, { inspectMode: 'all' })

    expect(screen.getByTestId('reinspect-shell-VendorCard')).toBeInTheDocument()
  })

  it('lets manual withReinspect override an existing auto wrapper', () => {
    const AutoCard = autoWrapInspectable(
      () => <p>manual wins</p>,
      {
        scope: 'first-party',
        fallbackName: 'AutoCard',
      },
    )
    const ManualCard = withReinspect(AutoCard, { name: 'ManualCard' })

    renderWithConfig(<ManualCard />, { inspectMode: 'wrapped' })

    expect(screen.getByTestId('reinspect-shell-ManualCard')).toBeInTheDocument()
  })

  it('uses fallback names for anonymous auto-wrapped components', () => {
    const AnonymousAuto = autoWrapInspectable(
      () => <p>anon</p>,
      {
        scope: 'first-party',
        fallbackName: 'AnonymousAuto',
      },
    )

    renderWithConfig(<AnonymousAuto />, { inspectMode: 'first-party' })

    expect(screen.getByTestId('reinspect-shell-AnonymousAuto')).toBeInTheDocument()
  })
})
