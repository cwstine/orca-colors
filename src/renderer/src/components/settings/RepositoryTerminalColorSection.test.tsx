// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  terminalBackgroundColors,
  resolveTerminalBackgroundColor,
  TERMINAL_COLORS_STORAGE_KEY
} from '@/lib/terminal-background-colors'
import { RepositoryTerminalColorSection } from './RepositoryTerminalColorSection'
import { getRepositoryPaneSearchEntries } from './repository-search'
import { useAppStore } from '../../store'

const repo = {
  id: 'website',
  path: '/projects/website',
  displayName: 'Website',
  badgeColor: '#999999',
  addedAt: 0
}
const pane = { worktreeId: 'website::/projects/website', tabId: 'tab', leafId: 'pane' }
const resolve = (worktreeId = pane.worktreeId, leafId = pane.leafId) =>
  resolveTerminalBackgroundColor(terminalBackgroundColors.getState(), {
    ...pane,
    worktreeId,
    leafId
  })
beforeEach(() => {
  localStorage.removeItem(TERMINAL_COLORS_STORAGE_KEY)
  terminalBackgroundColors.getState().reload()
  useAppStore.setState({ settingsSearchQuery: '' })
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('project terminal color settings', () => {
  it('sets a persistent project default for existing and new worktree terminals', () => {
    render(<RepositoryTerminalColorSection repo={repo} />)
    fireEvent.click(screen.getByRole('button', { name: 'Forest' }))
    expect(resolve()).toBe('#1f2d24')
    expect(resolve('website::/projects/feature', 'new-pane')).toBe('#1f2d24')
    expect(resolve('another::/projects/another')).toBeUndefined()
    terminalBackgroundColors.getState().reload()
    expect(resolve()).toBe('#1f2d24')
  })

  it('preserves pane overrides when changing and clearing the project default', () => {
    terminalBackgroundColors.getState().setColor('pane', pane, '#123456')
    render(<RepositoryTerminalColorSection repo={repo} />)
    fireEvent.click(screen.getByRole('button', { name: 'Navy' }))
    expect(resolve()).toBe('#123456')
    expect(resolve(pane.worktreeId, 'sibling')).toBe('#1e2433')
    fireEvent.click(screen.getByRole('button', { name: 'Use Terminal Theme' }))
    expect(resolve()).toBe('#123456')
    expect(resolve(pane.worktreeId, 'sibling')).toBeUndefined()
  })

  it('edits the currently selected project after switching projects', () => {
    const { rerender } = render(<RepositoryTerminalColorSection repo={repo} />)
    fireEvent.click(screen.getByRole('button', { name: 'Navy' }))
    rerender(
      <RepositoryTerminalColorSection
        repo={{ ...repo, id: 'api', path: '/api', displayName: 'API' }}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Plum' }))
    expect(resolve()).toBe('#1e2433')
    expect(resolve('api::/api')).toBe('#2a1f2d')
  })

  it('reports storage failures without pretending the project color changed', () => {
    render(<RepositoryTerminalColorSection repo={repo} />)
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('full')
    })
    fireEvent.click(screen.getByRole('button', { name: 'Navy' }))
    expect(screen.getByRole('alert').textContent).toContain('Could not save')
    expect(resolve()).toBeUndefined()
  })

  it('is discoverable through project settings search', () => {
    expect(
      getRepositoryPaneSearchEntries(repo).some((entry) => entry.title === 'Terminal Background')
    ).toBe(true)
    useAppStore.setState({ settingsSearchQuery: 'terminal background' })
    render(<RepositoryTerminalColorSection repo={repo} />)
    expect(screen.getByRole('button', { name: 'Forest' })).toBeTruthy()
  })
})
