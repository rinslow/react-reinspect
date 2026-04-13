import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import {
  ReinspectProvider,
  useReinspect,
  withReinspect,
  wrapInspectableMap,
  type ReinspectConfig,
} from '.'

const testConfig: ReinspectConfig = {
  enabled: true,
  startActive: true,
  showFloatingToggle: true,
  zIndexBase: 7000,
}

function renderWithReinspect(ui: ReactNode, config: ReinspectConfig = testConfig) {
  return render(<ReinspectProvider config={config}>{ui}</ReinspectProvider>)
}

describe('Reinspect', () => {
  it('propagates provider config through useReinspect', () => {
    function Probe() {
      const { config, isActive } = useReinspect()
      return (
        <output data-testid="probe">
          {`${config.enabled}-${config.zIndexBase}-${isActive}`}
        </output>
      )
    }

    renderWithReinspect(<Probe />, {
      enabled: true,
      startActive: false,
      showFloatingToggle: false,
      zIndexBase: 9230,
    })

    expect(screen.getByTestId('probe')).toHaveTextContent('true-9230-false')
  })

  it('shows inspector chrome only while inspect mode is active', async () => {
    const user = userEvent.setup()

    const Wrapped = withReinspect(function DemoCard() {
      return <p>demo</p>
    }, { name: 'DemoCard' })

    renderWithReinspect(<Wrapped />)

    expect(screen.getByText('DemoCard')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent.contextMenu(screen.getByTestId('reinspect-shell-DemoCard'))
    expect(
      screen.getByRole('dialog', { name: 'DemoCard inspector controls' }),
    ).toBeInTheDocument()

    await user.click(screen.getByTestId('reinspect-floating-toggle'))

    expect(screen.queryByText('DemoCard')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('floating toggle switches all wrapped components together', async () => {
    const user = userEvent.setup()

    const Header = withReinspect(function Header() {
      return <h1>header</h1>
    }, { name: 'Header' })

    const Body = withReinspect(function Body() {
      return <p>body</p>
    }, { name: 'Body' })

    renderWithReinspect(
      <>
        <Header />
        <Body />
      </>,
    )

    expect(screen.getByText('Header')).toBeInTheDocument()
    expect(screen.getByText('Body')).toBeInTheDocument()

    await user.click(screen.getByTestId('reinspect-floating-toggle'))

    expect(screen.queryByText('Header')).not.toBeInTheDocument()
    expect(screen.queryByText('Body')).not.toBeInTheDocument()
  })

  it('applies edited style overrides immediately', async () => {
    const user = userEvent.setup()

    const Wrapped = withReinspect(function StyleTarget() {
      return <div>card body</div>
    }, { name: 'StyleTarget' })

    renderWithReinspect(<Wrapped />)

    fireEvent.contextMenu(screen.getByTestId('reinspect-shell-StyleTarget'))

    const dialog = screen.getByRole('dialog', {
      name: 'StyleTarget inspector controls',
    })

    const paddingField = within(dialog).getByLabelText('Padding (px)')
    await user.clear(paddingField)
    await user.type(paddingField, '24')

    const shell = screen.getByTestId('reinspect-shell-StyleTarget')
    const content = shell.querySelector('[data-reinspect-content="true"]') as HTMLElement

    expect(content).toHaveStyle({ padding: '24px' })
  })

  it('wrapInspectableMap returns wrapped components with original props', () => {
    const { MessageCard } = wrapInspectableMap({
      MessageCard: ({ message }: { message: string }) => <p>{message}</p>,
    })

    renderWithReinspect(<MessageCard message="props pass through" />)

    expect(screen.getByText('props pass through')).toBeInTheDocument()
    expect(screen.getByText('MessageCard')).toBeInTheDocument()
  })

  it('applies props overrides from the Props submenu', async () => {
    const user = userEvent.setup()

    const Wrapped = withReinspect(function PropsCard({
      message,
    }: {
      message: string
    }) {
      return <p>{message}</p>
    }, { name: 'PropsCard' })

    renderWithReinspect(<Wrapped message="original message" />)

    fireEvent.contextMenu(screen.getByTestId('reinspect-shell-PropsCard'))
    const dialog = screen.getByRole('dialog', {
      name: 'PropsCard inspector controls',
    })

    await user.click(within(dialog).getByRole('button', { name: 'Props' }))
    const textarea = within(dialog).getByLabelText('Props JSON')
    fireEvent.change(textarea, {
      target: { value: '{"message":"overridden"}' },
    })
    await user.click(within(dialog).getByRole('button', { name: 'apply' }))

    expect(screen.getByText('overridden')).toBeInTheDocument()
  })

  it('keeps overrides session-only and resets after provider remount', async () => {
    const user = userEvent.setup()

    const Wrapped = withReinspect(function SessionCard() {
      return <div>session target</div>
    }, { name: 'SessionCard' })

    const firstRender = renderWithReinspect(<Wrapped />)

    fireEvent.contextMenu(screen.getByTestId('reinspect-shell-SessionCard'))

    const dialog = screen.getByRole('dialog', {
      name: 'SessionCard inspector controls',
    })

    const marginField = within(dialog).getByLabelText('Margin (px)')
    await user.clear(marginField)
    await user.type(marginField, '18')

    const shell = screen.getByTestId('reinspect-shell-SessionCard')
    const firstContent = shell.querySelector(
      '[data-reinspect-content="true"]',
    ) as HTMLElement

    expect(firstContent).toHaveStyle({ margin: '18px' })

    firstRender.unmount()

    renderWithReinspect(<Wrapped />)

    const nextShell = screen.getByTestId('reinspect-shell-SessionCard')
    const nextContent = nextShell.querySelector(
      '[data-reinspect-content="true"]',
    ) as HTMLElement

    expect(nextContent).not.toHaveStyle({ margin: '18px' })
  })
})
