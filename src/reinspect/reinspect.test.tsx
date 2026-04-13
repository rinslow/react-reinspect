import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ReinspectProvider,
  useReinspect,
  withReinspect,
  wrapInspectableMap,
  type ReinspectConfig,
} from '.'
import * as reinspectUtils from './utils'

const testConfig: ReinspectConfig = {
  enabled: true,
  startActive: true,
  showFloatingToggle: true,
  zIndexBase: 7000,
}

function renderWithReinspect(ui: ReactNode, config: ReinspectConfig = testConfig) {
  return render(<ReinspectProvider config={config}>{ui}</ReinspectProvider>)
}

function getBadgeText(componentName: string): string {
  const shell = screen.getByTestId(`reinspect-shell-${componentName}`)
  const badgeElement = shell.querySelector('.reinspect-name-badge')

  if (!badgeElement) {
    throw new Error(`Missing badge for ${componentName}`)
  }

  return badgeElement.textContent ?? ''
}

function getAttemptCount(componentName: string): number {
  const match = getBadgeText(componentName).match(/(\d+)\sattempts/)
  if (!match) {
    throw new Error(`Missing attempts count for ${componentName}`)
  }

  return Number(match[1])
}

describe('Reinspect', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

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

  it('uses session inspect mode over config inspect mode', () => {
    window.sessionStorage.setItem(
      reinspectUtils.REINSPECT_INSPECT_MODE_STORAGE_KEY,
      'all',
    )

    function Probe() {
      const { config } = useReinspect()
      return <output data-testid="inspect-mode-probe">{config.inspectMode}</output>
    }

    renderWithReinspect(<Probe />, {
      enabled: true,
      inspectMode: 'wrapped',
      showFloatingToggle: false,
    })

    expect(screen.getByTestId('inspect-mode-probe')).toHaveTextContent('all')
  })

  it('applies inspect mode through settings and requests reload', async () => {
    const user = userEvent.setup()
    const reloadSpy = vi
      .spyOn(reinspectUtils, 'reloadWindow')
      .mockImplementation(() => undefined)

    const Wrapped = withReinspect(function ModeCard() {
      return <p>mode target</p>
    })

    renderWithReinspect(<Wrapped />, {
      enabled: true,
      inspectMode: 'wrapped',
      showFloatingToggle: true,
    })

    await user.click(screen.getByTestId('reinspect-floating-toggle'))
    const settingsMenu = screen.getByTestId('reinspect-settings-menu')

    const select = within(settingsMenu).getByTestId(
      'reinspect-setting-inspect-mode',
    )
    const applyButton = within(settingsMenu).getByTestId(
      'reinspect-apply-inspect-mode',
    )

    expect(applyButton).toBeDisabled()

    fireEvent.change(select, { target: { value: 'first-party' } })
    expect(applyButton).toBeEnabled()

    await user.click(applyButton)

    expect(
      window.sessionStorage.getItem(
        reinspectUtils.REINSPECT_INSPECT_MODE_STORAGE_KEY,
      ),
    ).toBe('first-party')
    expect(reloadSpy).toHaveBeenCalledTimes(1)

    reloadSpy.mockRestore()
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
    const settingsMenu = screen.getByTestId('reinspect-settings-menu')
    await user.click(
      within(settingsMenu).getByTestId('reinspect-setting-inspector-active'),
    )

    const demoShell = screen.getByTestId('reinspect-shell-DemoCard')
    expect(demoShell.querySelector('.reinspect-name-badge')).toBeNull()
    expect(
      screen.queryByRole('dialog', { name: 'DemoCard inspector controls' }),
    ).not.toBeInTheDocument()
  })

  it('inspector setting switches all wrapped components together', async () => {
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
    const settingsMenu = screen.getByTestId('reinspect-settings-menu')
    await user.click(
      within(settingsMenu).getByTestId('reinspect-setting-inspector-active'),
    )

    const headerShell = screen.getByTestId('reinspect-shell-Header')
    const bodyShell = screen.getByTestId('reinspect-shell-Body')

    expect(headerShell.querySelector('.reinspect-name-badge')).toBeNull()
    expect(bodyShell.querySelector('.reinspect-name-badge')).toBeNull()
  })

  it('counts rerenders when SHOULD_COUNT_RENDERS is enabled globally', async () => {
    const user = userEvent.setup()

    const Wrapped = withReinspect(function CountedCard({
      value,
    }: {
      value: number
    }) {
      return <p>count value: {value}</p>
    }, { name: 'CountedCard' })

    function Harness() {
      const [value, setValue] = useState(0)

      return (
        <>
          <button type="button" onClick={() => setValue((current) => current + 1)}>
            rerender
          </button>
          <Wrapped value={value} />
        </>
      )
    }

    renderWithReinspect(<Harness />)

    await user.click(screen.getByTestId('reinspect-floating-toggle'))
    const settingsMenu = screen.getByTestId('reinspect-settings-menu')
    await user.click(
      within(settingsMenu).getByTestId('reinspect-setting-should-count-renders'),
    )

    expect(getAttemptCount('CountedCard')).toBe(0)

    await user.click(screen.getByRole('button', { name: 'rerender' }))
    const firstCount = getAttemptCount('CountedCard')
    expect(firstCount).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: 'rerender' }))
    const secondCount = getAttemptCount('CountedCard')
    expect(secondCount).toBeGreaterThan(firstCount)
  })

  it('supports component-specific render counting when global setting is off', async () => {
    const user = userEvent.setup()

    const CountedHeader = withReinspect(function CountedHeader({
      value,
    }: {
      value: number
    }) {
      return <h1>header: {value}</h1>
    }, { name: 'CountedHeader' })

    const PlainBody = withReinspect(function PlainBody({
      value,
    }: {
      value: number
    }) {
      return <p>body: {value}</p>
    }, { name: 'PlainBody' })

    function Harness() {
      const [value, setValue] = useState(0)

      return (
        <>
          <button type="button" onClick={() => setValue((current) => current + 1)}>
            rerender
          </button>
          <CountedHeader value={value} />
          <PlainBody value={value} />
        </>
      )
    }

    renderWithReinspect(<Harness />)

    fireEvent.contextMenu(screen.getByTestId('reinspect-shell-CountedHeader'))
    const dialog = screen.getByRole('dialog', {
      name: 'CountedHeader inspector controls',
    })
    await user.click(
      within(dialog).getByTestId('reinspect-component-render-toggle-CountedHeader'),
    )

    expect(getAttemptCount('CountedHeader')).toBe(0)
    expect(getBadgeText('PlainBody')).toBe('PlainBody')

    fireEvent.click(screen.getByRole('button', { name: 'rerender' }))

    expect(getAttemptCount('CountedHeader')).toBeGreaterThan(0)
    expect(getBadgeText('PlainBody')).toBe('PlainBody')
  })

  it('shows both render attempts and commit counts when RENDER_CAPTURE_MODE is both', async () => {
    const user = userEvent.setup()

    const Wrapped = withReinspect(function CounterCard({
      value,
    }: {
      value: number
    }) {
      return <p>counter value: {value}</p>
    }, { name: 'CounterCard' })

    function Harness() {
      const [value, setValue] = useState(0)
      return (
        <>
          <button type="button" onClick={() => setValue((current) => current + 1)}>
            rerender
          </button>
          <Wrapped value={value} />
        </>
      )
    }

    renderWithReinspect(<Harness />)

    await user.click(screen.getByTestId('reinspect-floating-toggle'))
    const settingsMenu = screen.getByTestId('reinspect-settings-menu')

    fireEvent.change(
      within(settingsMenu).getByTestId('reinspect-setting-render-capture-mode'),
      { target: { value: 'both' } },
    )

    await user.click(
      within(settingsMenu).getByTestId('reinspect-setting-should-count-renders'),
    )

    expect(getBadgeText('CounterCard')).toBe('CounterCard | 0 attempts | 0 commits')

    await user.click(screen.getByRole('button', { name: 'rerender' }))
    expect(getBadgeText('CounterCard')).toBe('CounterCard | 1 attempts | 1 commits')
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

  it('filters CSS properties in the right-click inspector menu', async () => {
    const user = userEvent.setup()

    const Wrapped = withReinspect(function FilterCard() {
      return <div>filter card</div>
    }, { name: 'FilterCard' })

    renderWithReinspect(<Wrapped />)

    fireEvent.contextMenu(screen.getByTestId('reinspect-shell-FilterCard'))

    const dialog = screen.getByRole('dialog', {
      name: 'FilterCard inspector controls',
    })

    const filterInput = within(dialog).getByPlaceholderText('Filter')
    await user.type(filterInput, 'padding')

    expect(within(dialog).getByLabelText('Padding (px)')).toBeInTheDocument()
    expect(within(dialog).queryByLabelText('Margin (px)')).not.toBeInTheDocument()
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
    await user.click(within(dialog).getByRole('button', { name: 'Raw' }))
    const textarea = within(dialog).getByLabelText('Props JSON')
    fireEvent.change(textarea, {
      target: { value: '{"message":"overridden"}' },
    })
    await user.click(within(dialog).getByRole('button', { name: 'apply' }))

    expect(screen.getByText('overridden')).toBeInTheDocument()
  })

  it('auto-detects props keys and shows effective values', async () => {
    const user = userEvent.setup()

    const Wrapped = withReinspect(function DiffCard({
      message,
    }: {
      message: string
    }) {
      return <p>{message}</p>
    }, { name: 'DiffCard' })

    renderWithReinspect(<Wrapped message="original" />)

    fireEvent.contextMenu(screen.getByTestId('reinspect-shell-DiffCard'))
    const dialog = screen.getByRole('dialog', {
      name: 'DiffCard inspector controls',
    })

    await user.click(within(dialog).getByRole('button', { name: 'Props' }))

    const initialValueCell = within(dialog).getByTestId(
      'reinspect-prop-value-message',
    )
    expect(within(initialValueCell).getByText('"original"')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Raw' }))
    const textarea = within(dialog).getByLabelText('Props JSON')
    fireEvent.change(textarea, {
      target: { value: '{"message":"overridden"}' },
    })
    await user.click(within(dialog).getByRole('button', { name: 'apply' }))

    await user.click(within(dialog).getByRole('button', { name: 'Detected' }))

    const valueCell = within(dialog).getByTestId('reinspect-prop-value-message')
    expect(within(valueCell).getByText('"overridden"')).toBeInTheDocument()
  })

  it('shows function previews in detected props', async () => {
    const user = userEvent.setup()

    const Wrapped = withReinspect(function FnCard({
      onSave,
    }: {
      onSave: () => void
    }) {
      return <button onClick={onSave}>save</button>
    }, { name: 'FnCard' })

    renderWithReinspect(<Wrapped onSave={() => undefined} />)

    fireEvent.contextMenu(screen.getByTestId('reinspect-shell-FnCard'))
    const dialog = screen.getByRole('dialog', {
      name: 'FnCard inspector controls',
    })

    await user.click(within(dialog).getByRole('button', { name: 'Props' }))

    const valueCell = within(dialog).getByTestId('reinspect-prop-value-onSave')
    expect(within(valueCell).getByText('Function onSave(0)')).toBeInTheDocument()
    expect(
      within(valueCell).getByRole('button', { name: 'Copy function source' }),
    ).toBeInTheDocument()
  })

  it('lazily shows json preview for object props', async () => {
    const user = userEvent.setup()

    const Wrapped = withReinspect(function JsonCard({
      config,
    }: {
      config: { theme: string; size: number }
    }) {
      return <p>{config.theme}</p>
    }, { name: 'JsonCard' })

    renderWithReinspect(<Wrapped config={{ theme: 'dark', size: 2 }} />)

    fireEvent.contextMenu(screen.getByTestId('reinspect-shell-JsonCard'))
    const dialog = screen.getByRole('dialog', {
      name: 'JsonCard inspector controls',
    })

    await user.click(within(dialog).getByRole('button', { name: 'Props' }))

    const showJsonButton = within(dialog).getByTestId(
      'reinspect-prop-show-json-config',
    )
    await user.click(showJsonButton)

    const preview = within(dialog).getByTestId(
      'reinspect-prop-json-preview-config',
    )
    expect(preview).toHaveTextContent('"theme": "dark"')
    expect(preview).toHaveTextContent('"size": 2')
  })

  it('edits object props through the modal editor', async () => {
    const user = userEvent.setup()

    const Wrapped = withReinspect(function EditCard({
      config,
    }: {
      config: { theme: string }
    }) {
      return <p>theme: {config.theme}</p>
    }, { name: 'EditCard' })

    renderWithReinspect(<Wrapped config={{ theme: 'dark' }} />)

    fireEvent.contextMenu(screen.getByTestId('reinspect-shell-EditCard'))
    const dialog = screen.getByRole('dialog', {
      name: 'EditCard inspector controls',
    })

    await user.click(within(dialog).getByRole('button', { name: 'Props' }))
    await user.click(within(dialog).getByTestId('reinspect-prop-edit-config'))

    const modal = screen.getByTestId('reinspect-prop-edit-modal')
    const textarea = within(modal).getByTestId('reinspect-prop-edit-textarea')

    fireEvent.change(textarea, {
      target: { value: '{"theme":"light"}' },
    })
    await user.click(within(modal).getByRole('button', { name: 'apply' }))

    expect(screen.getByText('theme: light')).toBeInTheDocument()
  })

  it('prefills raw json placeholders and skips placeholder overrides on apply', async () => {
    const user = userEvent.setup()

    const Wrapped = withReinspect(function PlaceholderCard({
      onPing,
    }: {
      onPing: () => void
    }) {
      return <p>onPing is {typeof onPing}</p>
    }, { name: 'PlaceholderCard' })

    renderWithReinspect(<Wrapped onPing={() => undefined} />)

    fireEvent.contextMenu(screen.getByTestId('reinspect-shell-PlaceholderCard'))
    const dialog = screen.getByRole('dialog', {
      name: 'PlaceholderCard inspector controls',
    })

    await user.click(within(dialog).getByRole('button', { name: 'Props' }))
    await user.click(within(dialog).getByRole('button', { name: 'Raw' }))

    const textarea = within(dialog).getByLabelText('Props JSON')
    expect((textarea as HTMLTextAreaElement).value).toContain(
      '__reinspect_placeholder__',
    )

    await user.click(within(dialog).getByRole('button', { name: 'apply' }))

    expect(screen.getByText('onPing is function')).toBeInTheDocument()
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
