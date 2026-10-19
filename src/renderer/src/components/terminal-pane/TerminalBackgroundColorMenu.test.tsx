// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  terminalBackgroundColors,
  resolveTerminalBackgroundColor,
  TERMINAL_COLORS_STORAGE_KEY
} from '@/lib/terminal-background-colors'
import { TerminalBackgroundColorMenu } from './TerminalBackgroundColorMenu'
import { TerminalBackgroundColorDialog } from './TerminalBackgroundColorDialog'

const target = { worktreeId: 'repo::/dir', tabId: 'tab', leafId: 'leaf' }
beforeEach(() => {
  localStorage.removeItem(TERMINAL_COLORS_STORAGE_KEY)
  terminalBackgroundColors.getState().reload()
})
afterEach(cleanup)

async function openMenu(onCustomColor = vi.fn()) {
  render(
    <DropdownMenu open modal={false}>
      <DropdownMenuTrigger>Menu</DropdownMenuTrigger>
      <DropdownMenuContent>
        <TerminalBackgroundColorMenu target={target} onCustomColor={onCustomColor} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
  fireEvent.click(screen.getByText('Background Color'))
  await screen.findByText('Navy')
}

describe('terminal background controls', () => {
  it('changes the clicked pane and leaves its sibling unchanged', async () => {
    await openMenu()
    fireEvent.click(screen.getByText('Navy'))
    await waitFor(() =>
      expect(resolveTerminalBackgroundColor(terminalBackgroundColors.getState(), target)).toBe(
        '#1e2433'
      )
    )
    expect(
      resolveTerminalBackgroundColor(terminalBackgroundColors.getState(), {
        ...target,
        leafId: 'sibling'
      })
    ).toBeUndefined()
  })

  it('promotes a pane color to project default and returns that pane to inheritance', async () => {
    terminalBackgroundColors.getState().setColor('pane', target, '#123456')
    await openMenu()
    fireEvent.click(screen.getByText('Use This Color for Project'))
    terminalBackgroundColors.getState().setColor('project', target, '#abcdef')
    expect(resolveTerminalBackgroundColor(terminalBackgroundColors.getState(), target)).toBe(
      '#abcdef'
    )
    expect(
      resolveTerminalBackgroundColor(terminalBackgroundColors.getState(), {
        ...target,
        leafId: 'new'
      })
    ).toBe('#abcdef')
  })

  it('captures the clicked pane for a custom color even if focus changes', async () => {
    const custom = vi.fn()
    await openMenu(custom)
    fireEvent.click(screen.getByText('Custom Color…'))
    expect(custom).toHaveBeenCalledWith({ target, scope: 'pane' })
  })

  it('does not save a custom draft when cancelled', () => {
    const close = vi.fn()
    render(<TerminalBackgroundColorDialog selection={{ target, scope: 'pane' }} onClose={close} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(close).toHaveBeenCalled()
    expect(
      resolveTerminalBackgroundColor(terminalBackgroundColors.getState(), target)
    ).toBeUndefined()
  })
})
