import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactNode } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  ReinspectProvider,
  useReinspect,
  withReinspect,
  type ReinspectConfig,
  type RenderCounterMode,
} from '.'
import { wrapInspectableMap } from './wrapInspectableMap'
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

  it('reacts to provider config updates without remount', async () => {
    const user = userEvent.setup()

    function Probe() {
      const { renderCounterMode } = useReinspect()
      return <output data-testid="counter-mode-probe">{renderCounterMode}</output>
    }

    function Harness() {
      const [renderCounters, setRenderCounters] =
        useState<RenderCounterMode>('off')

      return (
        <>
          <button type="button" onClick={() => setRenderCounters('both')}>
            enable counters
          </button>
          <ReinspectProvider
            config={{
              enabled: true,
              startActive: true,
              showFloatingToggle: false,
              renderCounters,
            }}
          >
            <Probe />
          </ReinspectProvider>
        </>
      )
    }

    render(<Harness />)
    expect(screen.getByTestId('counter-mode-probe')).toHaveTextContent('off')

    await user.click(screen.getByRole('button', { name: 'enable counters' }))
    expect(screen.getByTestId('counter-mode-probe')).toHaveTextContent('both')
  })

  it('derives stable colors from component name hash and caches values', () => {
    const config: ReinspectConfig = {
      enabled: true,
      startActive: true,
      showFloatingToggle: false,
    }
    const ColorCard = withReinspect(function ColorCard() {
      return <p>card</p>
    }, { name: 'ColorCard' })
    const OtherColorCard = withReinspect(function OtherColorCard() {
      return <p>other</p>
    }, { name: 'OtherColorCard' })

    const view = renderWithReinspect(
      <>
        <ColorCard />
        <ColorCard />
        <OtherColorCard />
      </>,
      config,
    )

    const cardShells = screen.getAllByTestId('reinspect-shell-ColorCard')
    expect(cardShells).toHaveLength(2)
    const firstCardShell = cardShells[0]
    const secondCardShell = cardShells[1]
    if (!firstCardShell || !secondCardShell) {
      throw new Error('Expected two ColorCard shells')
    }
    const initialColor = firstCardShell.style.getPropertyValue('--reinspect-color')

    expect(initialColor).toMatch(/^hsl\(/)
    expect(secondCardShell.style.getPropertyValue('--reinspect-color')).toBe(
      initialColor,
    )
    expect(
      screen
        .getByTestId('reinspect-shell-OtherColorCard')
        .style.getPropertyValue('--reinspect-color'),
    ).toMatch(/^hsl\(/)

    view.rerender(
      <ReinspectProvider config={config}>
        <ColorCard />
        <ColorCard />
        <OtherColorCard />
      </ReinspectProvider>,
    )

    const rerenderedCardShells = screen.getAllByTestId('reinspect-shell-ColorCard')
    expect(rerenderedCardShells).toHaveLength(2)
    const rerenderedFirstCardShell = rerenderedCardShells[0]
    const rerenderedSecondCardShell = rerenderedCardShells[1]
    if (!rerenderedFirstCardShell || !rerenderedSecondCardShell) {
      throw new Error('Expected two ColorCard shells after rerender')
    }
    expect(
      rerenderedFirstCardShell.style.getPropertyValue('--reinspect-color'),
    ).toBe(initialColor)
    expect(
      rerenderedSecondCardShell.style.getPropertyValue('--reinspect-color'),
    ).toBe(initialColor)

    view.unmount()

    renderWithReinspect(
      <>
        <ColorCard />
        <OtherColorCard />
      </>,
      config,
    )

    expect(
      screen
        .getByTestId('reinspect-shell-ColorCard')
        .style.getPropertyValue('--reinspect-color'),
    ).toBe(initialColor)
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

  it('applies inspect mode through settings live and persists it', async () => {
    const user = userEvent.setup()

    function Probe() {
      const { inspectMode } = useReinspect()
      return <output data-testid="inspect-mode-live-probe">{inspectMode}</output>
    }

    renderWithReinspect(<Probe />, {
      enabled: true,
      inspectMode: 'wrapped',
      showFloatingToggle: true,
    })

    await user.click(screen.getByTestId('reinspect-floating-toggle'))
    const settingsMenu = screen.getByTestId('reinspect-settings-menu')

    const select = within(settingsMenu).getByTestId(
      'reinspect-setting-inspect-mode',
    )
    expect(screen.getByTestId('inspect-mode-live-probe')).toHaveTextContent(
      'wrapped',
    )

    fireEvent.change(select, { target: { value: 'first-party' } })
    expect(screen.getByTestId('inspect-mode-live-probe')).toHaveTextContent(
      'first-party',
    )

    expect(
      window.sessionStorage.getItem(
        reinspectUtils.REINSPECT_INSPECT_MODE_STORAGE_KEY,
      ),
    ).toBe('first-party')
  })

  it('applies props detail mode through settings live and persists it', async () => {
    const user = userEvent.setup()

    function Probe() {
      const { propsSerializationMode } = useReinspect()
      return (
        <output data-testid="props-serialization-mode-probe">
          {propsSerializationMode}
        </output>
      )
    }

    renderWithReinspect(<Probe />, {
      enabled: true,
      propsSerializationMode: 'distilled',
      showFloatingToggle: true,
    })

    await user.click(screen.getByTestId('reinspect-floating-toggle'))
    const settingsMenu = screen.getByTestId('reinspect-settings-menu')
    await user.click(
      within(settingsMenu).getByTestId('reinspect-settings-tab-settings'),
    )

    const select = within(settingsMenu).getByTestId(
      'reinspect-setting-props-serialization-mode',
    )
    expect(screen.getByTestId('props-serialization-mode-probe')).toHaveTextContent(
      'distilled',
    )
    expect(
      within(settingsMenu).getByText(
        'Shows app-level props first and hides React internals like _owner.',
      ),
    ).toBeInTheDocument()

    fireEvent.change(select, { target: { value: 'complete' } })
    expect(screen.getByTestId('props-serialization-mode-probe')).toHaveTextContent(
      'complete',
    )
    expect(
      within(settingsMenu).getByText(
        'Shows the full object graph, including React internals and metadata.',
      ),
    ).toBeInTheDocument()
    expect(
      window.sessionStorage.getItem(
        reinspectUtils.REINSPECT_PROPS_SERIALIZATION_MODE_STORAGE_KEY,
      ),
    ).toBe('complete')
  })

  it('defaults menu theme to light and applies theme changes live', async () => {
    const user = userEvent.setup()

    const ThemeCard = withReinspect(function ThemeCard() {
      return <p>theme card</p>
    }, { name: 'ThemeCard' })

    function Probe() {
      const { menuTheme } = useReinspect()
      return <output data-testid="menu-theme-probe">{menuTheme}</output>
    }

    renderWithReinspect(
      <>
        <Probe />
        <ThemeCard />
      </>,
      {
        enabled: true,
        startActive: true,
        showFloatingToggle: true,
      },
    )

    expect(screen.getByTestId('menu-theme-probe')).toHaveTextContent('light')

    await user.click(screen.getByTestId('reinspect-floating-toggle'))
    const settingsMenu = screen.getByTestId('reinspect-settings-menu')
    await user.click(
      within(settingsMenu).getByTestId('reinspect-settings-tab-settings'),
    )

    const themeSelect = within(settingsMenu).getByTestId(
      'reinspect-setting-menu-theme',
    )
    expect(themeSelect).toHaveValue('light')

    fireEvent.change(themeSelect, { target: { value: 'dark' } })

    expect(screen.getByTestId('menu-theme-probe')).toHaveTextContent('dark')
    expect(screen.getByTestId('reinspect-floating-toggle')).toHaveAttribute(
      'data-reinspect-theme',
      'dark',
    )
    expect(settingsMenu).toHaveAttribute('data-reinspect-theme', 'dark')
    expect(
      window.sessionStorage.getItem(reinspectUtils.REINSPECT_MENU_THEME_STORAGE_KEY),
    ).toBe('dark')

    fireEvent.contextMenu(screen.getByTestId('reinspect-shell-ThemeCard'))
    expect(screen.getByRole('dialog', { name: 'ThemeCard controls' })).toHaveAttribute(
      'data-reinspect-theme',
      'dark',
    )
  })

  it('applies menu open trigger through settings live and persists it', async () => {
    const user = userEvent.setup()

    function Probe() {
      const { menuOpenGesture } = useReinspect()
      return <output data-testid="menu-open-trigger-probe">{menuOpenGesture.mode}</output>
    }

    renderWithReinspect(<Probe />, {
      enabled: true,
      showFloatingToggle: true,
    })

    await user.click(screen.getByTestId('reinspect-floating-toggle'))
    const settingsMenu = screen.getByTestId('reinspect-settings-menu')
    await user.click(
      within(settingsMenu).getByTestId('reinspect-settings-tab-settings'),
    )

    const triggerSelect = within(settingsMenu).getByTestId(
      'reinspect-setting-menu-open-trigger',
    )
    expect(triggerSelect).toHaveValue('right-click')
    expect(screen.getByTestId('menu-open-trigger-probe')).toHaveTextContent(
      'right-click',
    )

    fireEvent.change(triggerSelect, { target: { value: 'modifier-right-click' } })

    expect(screen.getByTestId('menu-open-trigger-probe')).toHaveTextContent(
      'modifier-right-click',
    )
    expect(
      window.sessionStorage.getItem(
        reinspectUtils.REINSPECT_MENU_OPEN_GESTURE_STORAGE_KEY,
      ),
    ).toContain('"mode":"modifier-right-click"')
  })

  it('records modifier macro and gates context menu opening to that macro', async () => {
    const user = userEvent.setup()

    const TriggerCard = withReinspect(function TriggerCard() {
      return <p>trigger card</p>
    }, { name: 'TriggerCard' })

    renderWithReinspect(<TriggerCard />, {
      enabled: true,
      startActive: true,
      showFloatingToggle: true,
    })

    await user.click(screen.getByTestId('reinspect-floating-toggle'))
    const settingsMenu = screen.getByTestId('reinspect-settings-menu')
    await user.click(
      within(settingsMenu).getByTestId('reinspect-settings-tab-settings'),
    )

    fireEvent.change(
      within(settingsMenu).getByTestId('reinspect-setting-menu-open-trigger'),
      { target: { value: 'modifier-right-click' } },
    )

    await user.click(
      within(settingsMenu).getByTestId(
        'reinspect-setting-menu-open-modifier-record',
      ),
    )

    fireEvent.keyDown(document, {
      key: 'k',
      altKey: true,
      shiftKey: true,
    })

    expect(
      within(settingsMenu).getByTestId('reinspect-setting-menu-open-modifier-label'),
    ).toHaveTextContent('Alt + Shift')

    fireEvent.contextMenu(screen.getByTestId('reinspect-shell-TriggerCard'))
    expect(
      screen.queryByRole('dialog', { name: 'TriggerCard controls' }),
    ).not.toBeInTheDocument()

    fireEvent.contextMenu(screen.getByTestId('reinspect-shell-TriggerCard'), {
      altKey: true,
      shiftKey: true,
    })
    expect(
      screen.getByRole('dialog', { name: 'TriggerCard controls' }),
    ).toBeInTheDocument()
  })

  it('applies inspect whitelist changes live and persists them for the session', async () => {
    const user = userEvent.setup()

    const AllowedCard = withReinspect(function AllowedCard() {
      return <p>allowed</p>
    }, { name: 'AllowedCard' })
    const BlockedCard = withReinspect(function BlockedCard() {
      return <p>blocked</p>
    }, { name: 'BlockedCard' })

    const firstRender = renderWithReinspect(
      <>
        <AllowedCard />
        <BlockedCard />
      </>,
      {
        enabled: true,
        startActive: true,
        showFloatingToggle: true,
      },
    )

    expect(screen.getByTestId('reinspect-shell-AllowedCard')).toBeInTheDocument()
    expect(screen.getByTestId('reinspect-shell-BlockedCard')).toBeInTheDocument()

    await user.click(screen.getByTestId('reinspect-floating-toggle'))
    const settingsMenu = screen.getByTestId('reinspect-settings-menu')
    const whitelistInput = within(settingsMenu).getByTestId(
      'reinspect-setting-inspect-whitelist-patterns',
    )

    fireEvent.change(whitelistInput, { target: { value: 'AllowedCard' } })

    expect(screen.getByTestId('reinspect-shell-AllowedCard')).toBeInTheDocument()
    expect(screen.queryByTestId('reinspect-shell-BlockedCard')).toBeNull()
    expect(
      window.sessionStorage.getItem(
        reinspectUtils.REINSPECT_INSPECT_WHITELIST_STORAGE_KEY,
      ),
    ).toBe(
      JSON.stringify({
        patterns: ['AllowedCard'],
        regex: false,
        wholeWord: false,
        matchCase: false,
      }),
    )

    await user.click(
      within(settingsMenu).getByTestId(
        'reinspect-setting-inspect-whitelist-patterns-clear',
      ),
    )
    expect(screen.getByTestId('reinspect-shell-BlockedCard')).toBeInTheDocument()

    fireEvent.change(whitelistInput, { target: { value: 'AllowedCard' } })
    await user.click(
      within(settingsMenu).getByTestId(
        'reinspect-setting-inspect-whitelist-patterns-add',
      ),
    )
    firstRender.unmount()

    renderWithReinspect(
      <>
        <AllowedCard />
        <BlockedCard />
      </>,
      {
        enabled: true,
        startActive: true,
        showFloatingToggle: true,
      },
    )

    expect(screen.getByTestId('reinspect-shell-AllowedCard')).toBeInTheDocument()
    expect(screen.queryByTestId('reinspect-shell-BlockedCard')).toBeNull()
  })

  it('adds include filter from the component context menu', async () => {
    const user = userEvent.setup()

    const IncludeCard = withReinspect(function IncludeCard() {
      return <p>include card</p>
    }, { name: 'IncludeCard' })
    const OtherCard = withReinspect(function OtherCard() {
      return <p>other card</p>
    }, { name: 'OtherCard' })

    renderWithReinspect(
      <>
        <IncludeCard />
        <OtherCard />
      </>,
      {
        enabled: true,
        startActive: true,
        showFloatingToggle: true,
      },
    )

    fireEvent.contextMenu(screen.getByTestId('reinspect-shell-IncludeCard'))
    const dialog = screen.getByRole('dialog', { name: 'IncludeCard controls' })
    await user.click(
      within(dialog).getByTestId('reinspect-include-component-IncludeCard'),
    )

    expect(
      screen.getByRole('dialog', { name: 'IncludeCard controls' }),
    ).toBeInTheDocument()
    expect(screen.getByTestId('reinspect-shell-IncludeCard')).toBeInTheDocument()
    expect(screen.queryByTestId('reinspect-shell-OtherCard')).toBeNull()
    expect(
      window.sessionStorage.getItem(
        reinspectUtils.REINSPECT_INSPECT_WHITELIST_STORAGE_KEY,
      ),
    ).toContain('IncludeCard')
  })

  it('keeps the context menu open when parent click-away handlers exist', async () => {
    const user = userEvent.setup()

    const IncludeCard = withReinspect(function IncludeCard() {
      return <p>include card</p>
    }, { name: 'IncludeCard' })
    const OtherCard = withReinspect(function OtherCard() {
      return <p>other card</p>
    }, { name: 'OtherCard' })

    function ClickAwayHost() {
      const [closed, setClosed] = useState(false)

      return (
        <div data-testid="click-away-host" onClick={() => setClosed(true)}>
          {closed ? (
            <p data-testid="click-away-closed">closed</p>
          ) : (
            <>
              <IncludeCard />
              <OtherCard />
            </>
          )}
        </div>
      )
    }

    renderWithReinspect(<ClickAwayHost />, {
      enabled: true,
      startActive: true,
      showFloatingToggle: true,
    })

    fireEvent.contextMenu(screen.getByTestId('reinspect-shell-IncludeCard'))
    const dialog = screen.getByRole('dialog', { name: 'IncludeCard controls' })
    await user.click(
      within(dialog).getByTestId('reinspect-include-component-IncludeCard'),
    )

    expect(screen.queryByTestId('click-away-closed')).toBeNull()
    expect(
      screen.getByRole('dialog', { name: 'IncludeCard controls' }),
    ).toBeInTheDocument()
  })

  it('toggles include filter from the component context menu', async () => {
    const user = userEvent.setup()

    const IncludeCard = withReinspect(function IncludeCard() {
      return <p>include card</p>
    }, { name: 'IncludeCard' })
    const OtherCard = withReinspect(function OtherCard() {
      return <p>other card</p>
    }, { name: 'OtherCard' })

    renderWithReinspect(
      <>
        <IncludeCard />
        <OtherCard />
      </>,
      {
        enabled: true,
        startActive: true,
        showFloatingToggle: true,
      },
    )

    fireEvent.contextMenu(screen.getByTestId('reinspect-shell-IncludeCard'))
    const dialog = screen.getByRole('dialog', { name: 'IncludeCard controls' })
    const includeButton = within(dialog).getByTestId(
      'reinspect-include-component-IncludeCard',
    )
    expect(includeButton).toHaveAttribute('data-state', 'idle')

    await user.click(includeButton)
    expect(includeButton).toHaveAttribute('data-state', 'active')

    expect(screen.queryByTestId('reinspect-shell-OtherCard')).toBeNull()
    expect(
      window.sessionStorage.getItem(
        reinspectUtils.REINSPECT_INSPECT_WHITELIST_STORAGE_KEY,
      ),
    ).toContain('IncludeCard')

    await user.click(includeButton)
    expect(includeButton).toHaveAttribute('data-state', 'idle')

    expect(screen.getByTestId('reinspect-shell-IncludeCard')).toBeInTheDocument()
    expect(screen.getByTestId('reinspect-shell-OtherCard')).toBeInTheDocument()
    expect(
      window.sessionStorage.getItem(
        reinspectUtils.REINSPECT_INSPECT_WHITELIST_STORAGE_KEY,
      ),
    ).not.toContain('IncludeCard')
  })

  it('adds exclude filter from the component context menu', async () => {
    const user = userEvent.setup()

    const ExcludeCard = withReinspect(function ExcludeCard() {
      return <p>exclude card</p>
    }, { name: 'ExcludeCard' })
    const OtherCard = withReinspect(function OtherCard() {
      return <p>other card</p>
    }, { name: 'OtherCard' })

    renderWithReinspect(
      <>
        <ExcludeCard />
        <OtherCard />
      </>,
      {
        enabled: true,
        startActive: true,
        showFloatingToggle: true,
      },
    )

    fireEvent.contextMenu(screen.getByTestId('reinspect-shell-ExcludeCard'))
    const dialog = screen.getByRole('dialog', { name: 'ExcludeCard controls' })
    await user.click(
      within(dialog).getByTestId('reinspect-exclude-component-ExcludeCard'),
    )

    expect(screen.queryByTestId('reinspect-shell-ExcludeCard')).toBeNull()
    expect(screen.getByTestId('reinspect-shell-OtherCard')).toBeInTheDocument()
    expect(
      window.sessionStorage.getItem(
        reinspectUtils.REINSPECT_INSPECT_BLACKLIST_STORAGE_KEY,
      ),
    ).toContain('ExcludeCard')
  })

  it('shows undo toast when excluding a component and restores on undo', async () => {
    const user = userEvent.setup()

    const ToastCard = withReinspect(function ToastCard() {
      return <p>toast card</p>
    }, { name: 'ToastCard' })
    const OtherCard = withReinspect(function OtherCard() {
      return <p>other card</p>
    }, { name: 'OtherCard' })

    renderWithReinspect(
      <>
        <ToastCard />
        <OtherCard />
      </>,
      {
        enabled: true,
        startActive: true,
        showFloatingToggle: true,
      },
    )

    fireEvent.contextMenu(screen.getByTestId('reinspect-shell-ToastCard'))
    const dialog = screen.getByRole('dialog', { name: 'ToastCard controls' })
    await user.click(within(dialog).getByTestId('reinspect-exclude-component-ToastCard'))

    const toast = screen.getByTestId('reinspect-hide-component-toast')
    expect(toast).toHaveTextContent('Hidden ToastCard')
    expect(toast).toHaveAttribute('data-reinspect-theme', 'light')
    expect(screen.queryByTestId('reinspect-shell-ToastCard')).toBeNull()

    await user.click(screen.getByTestId('reinspect-hide-component-undo'))

    expect(screen.queryByTestId('reinspect-hide-component-toast')).toBeNull()
    expect(screen.getByTestId('reinspect-shell-ToastCard')).toBeInTheDocument()
    expect(
      window.sessionStorage.getItem(
        reinspectUtils.REINSPECT_INSPECT_BLACKLIST_STORAGE_KEY,
      ),
    ).not.toContain('ToastCard')
  })

  it('closes the component context menu from the header close button', async () => {
    const user = userEvent.setup()

    const CloseCard = withReinspect(function CloseCard() {
      return <p>close card</p>
    }, { name: 'CloseCard' })

    renderWithReinspect(<CloseCard />)

    fireEvent.contextMenu(screen.getByTestId('reinspect-shell-CloseCard'))
    const dialog = screen.getByRole('dialog', { name: 'CloseCard controls' })
    await user.click(within(dialog).getByTestId('reinspect-menu-close-CloseCard'))

    expect(
      screen.queryByRole('dialog', { name: 'CloseCard controls' }),
    ).not.toBeInTheDocument()
  })

  it('uses session inspect filters over config filters', () => {
    window.sessionStorage.setItem(
      reinspectUtils.REINSPECT_INSPECT_WHITELIST_STORAGE_KEY,
      JSON.stringify({
        patterns: ['StoredAllow'],
        regex: false,
        wholeWord: false,
        matchCase: false,
      }),
    )
    window.sessionStorage.setItem(
      reinspectUtils.REINSPECT_INSPECT_BLACKLIST_STORAGE_KEY,
      JSON.stringify({
        patterns: ['StoredBlock'],
        regex: false,
        wholeWord: false,
        matchCase: false,
      }),
    )

    function Probe() {
      const { inspectWhitelist, inspectBlacklist } = useReinspect()
      return (
        <output data-testid="inspect-filter-probe">
          {`${inspectWhitelist.patterns.join('|')}::${inspectBlacklist.patterns.join('|')}`}
        </output>
      )
    }

    renderWithReinspect(<Probe />, {
      enabled: true,
      showFloatingToggle: false,
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

    expect(screen.getByTestId('inspect-filter-probe')).toHaveTextContent(
      'StoredAllow::StoredBlock',
    )
  })

  it('shows invalid regex warnings in settings without breaking rendering', async () => {
    const user = userEvent.setup()

    const Wrapped = withReinspect(function InvalidRegexCard() {
      return <p>invalid regex target</p>
    }, { name: 'InvalidRegexCard' })

    renderWithReinspect(<Wrapped />, {
      enabled: true,
      startActive: true,
      showFloatingToggle: true,
    })

    expect(screen.getByTestId('reinspect-shell-InvalidRegexCard')).toBeInTheDocument()

    await user.click(screen.getByTestId('reinspect-floating-toggle'))
    const settingsMenu = screen.getByTestId('reinspect-settings-menu')

    await user.click(
      within(settingsMenu).getByTestId('reinspect-setting-inspect-whitelist-regex'),
    )
    fireEvent.change(
      within(settingsMenu).getByTestId(
        'reinspect-setting-inspect-whitelist-patterns',
      ),
      { target: { value: '[' } },
    )
    await user.click(
      within(settingsMenu).getByTestId(
        'reinspect-setting-inspect-whitelist-patterns-add',
      ),
    )

    expect(
      within(settingsMenu).getByTestId(
        'reinspect-setting-inspect-whitelist-invalid',
      ),
    ).toHaveTextContent('[')
    expect(screen.getByTestId('reinspect-shell-InvalidRegexCard')).toBeInTheDocument()
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
      screen.getByRole('dialog', { name: 'DemoCard controls' }),
    ).toBeInTheDocument()

    await user.click(screen.getByTestId('reinspect-floating-toggle'))
    const settingsMenu = screen.getByTestId('reinspect-settings-menu')
    await user.click(
      within(settingsMenu).getByTestId('reinspect-setting-inspector-active'),
    )

    expect(screen.queryByTestId('reinspect-shell-DemoCard')).toBeNull()
    expect(
      screen.queryByRole('dialog', { name: 'DemoCard controls' }),
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

    expect(screen.queryByTestId('reinspect-shell-Header')).toBeNull()
    expect(screen.queryByTestId('reinspect-shell-Body')).toBeNull()
  })

  it('counts rerenders when render counters are enabled globally', async () => {
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
      within(settingsMenu).getByTestId('reinspect-settings-tab-settings'),
    )
    fireEvent.change(
      within(settingsMenu).getByTestId('reinspect-setting-render-counters'),
      { target: { value: 'attempts' } },
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
      name: 'CountedHeader controls',
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

  it('shows both render attempts and commit counts when render counters mode is both', async () => {
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
    await user.click(
      within(settingsMenu).getByTestId('reinspect-settings-tab-settings'),
    )

    fireEvent.change(
      within(settingsMenu).getByTestId('reinspect-setting-render-counters'),
      { target: { value: 'both' } },
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
      name: 'StyleTarget controls',
    })

    await user.click(within(dialog).getByRole('button', { name: 'CSS' }))
    const paddingField = within(dialog).getByLabelText('Padding (px)')
    await user.clear(paddingField)
    await user.type(paddingField, '24')

    const shell = screen.getByTestId('reinspect-shell-StyleTarget')
    const content = shell.querySelector('[data-reinspect-content="true"]') as HTMLElement

    expect(content).toHaveStyle({ padding: '24px' })
  })

  it('initializes CSS color controls from computed component styles', async () => {
    const user = userEvent.setup()

    const Wrapped = withReinspect(function StyledColorCard() {
      return <div style={{ color: '#ef4444' }}>styled color</div>
    }, { name: 'StyledColorCard' })

    renderWithReinspect(<Wrapped />)

    fireEvent.contextMenu(screen.getByTestId('reinspect-shell-StyledColorCard'))

    const dialog = screen.getByRole('dialog', {
      name: 'StyledColorCard controls',
    })

    await user.click(within(dialog).getByRole('button', { name: 'CSS' }))
    const colorInput = within(dialog).getByLabelText('Color') as HTMLInputElement

    expect(colorInput.value.toLowerCase()).toBe('#ef4444')
  })

  it('initializes numeric CSS controls from computed component styles lazily on menu open', async () => {
    const user = userEvent.setup()

    const Wrapped = withReinspect(function StyledNumericCard() {
      return <div style={{ padding: '18px', opacity: 0.45 }}>styled numeric</div>
    }, { name: 'StyledNumericCard' })

    renderWithReinspect(<Wrapped />)

    fireEvent.contextMenu(screen.getByTestId('reinspect-shell-StyledNumericCard'))

    const dialog = screen.getByRole('dialog', {
      name: 'StyledNumericCard controls',
    })

    await user.click(within(dialog).getByRole('button', { name: 'CSS' }))
    const paddingInput = within(dialog).getByLabelText(
      'Padding (px)',
    ) as HTMLInputElement
    const opacityInput = within(dialog).getByLabelText('Opacity') as HTMLInputElement

    expect(paddingInput.value).toBe('18')
    expect(opacityInput.value).toBe('0.45')
  })

  it('filters CSS properties in the right-click inspector menu', async () => {
    const user = userEvent.setup()

    const Wrapped = withReinspect(function FilterCard() {
      return <div>filter card</div>
    }, { name: 'FilterCard' })

    renderWithReinspect(<Wrapped />)

    fireEvent.contextMenu(screen.getByTestId('reinspect-shell-FilterCard'))

    const dialog = screen.getByRole('dialog', {
      name: 'FilterCard controls',
    })

    await user.click(within(dialog).getByRole('button', { name: 'CSS' }))
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
      name: 'PropsCard controls',
    })

    await user.click(within(dialog).getByRole('button', { name: 'Props' }))
    await user.click(within(dialog).getByRole('button', { name: 'Raw' }))
    const textarea = within(dialog).getByLabelText('Props JSON')
    expect(
      within(dialog)
        .getByText('Props JSON')
        .parentElement?.querySelector(
          '.reinspect-json-editor code.language-json.reinspect-code-block',
        ),
    ).not.toBeNull()
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
      name: 'DiffCard controls',
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
      name: 'FnCard controls',
    })

    await user.click(within(dialog).getByRole('button', { name: 'Props' }))

    const valueCell = within(dialog).getByTestId('reinspect-prop-value-onSave')
    expect(within(valueCell).getByText('Function onSave(0)')).toBeInTheDocument()
    expect(
      valueCell.querySelector('code.language-javascript.reinspect-code-block'),
    ).not.toBeNull()
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
      name: 'JsonCard controls',
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
    expect(
      preview.querySelector('code.language-json.reinspect-code-block'),
    ).not.toBeNull()
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
      name: 'EditCard controls',
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

  it('prefills raw json without non-serializable props in distilled mode', async () => {
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
      name: 'PlaceholderCard controls',
    })

    await user.click(within(dialog).getByRole('button', { name: 'Props' }))
    await user.click(within(dialog).getByRole('button', { name: 'Raw' }))

    const textarea = within(dialog).getByLabelText('Props JSON')
    expect((textarea as HTMLTextAreaElement).value).not.toContain(
      '__reinspect_placeholder__',
    )
    expect((textarea as HTMLTextAreaElement).value).not.toContain('"onPing"')

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
      name: 'SessionCard controls',
    })

    await user.click(within(dialog).getByRole('button', { name: 'CSS' }))
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
