import { describe, expect, it } from 'vitest'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../shared/constants'
import {
  createTerminalBackgroundColorStore,
  getTerminalColorProjectKey,
  getTerminalColorPaneKey,
  resolveTerminalBackgroundColor,
  TERMINAL_COLORS_STORAGE_KEY
} from './terminal-background-colors'

const target = { worktreeId: 'repo-a::/project', tabId: 'tab-a', leafId: 'leaf-a' }

function memoryStorage(initial?: string) {
  const values = new Map<string, string>()
  if (initial) values.set(TERMINAL_COLORS_STORAGE_KEY, initial)
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) }
  }
}

describe('terminal background preferences', () => {
  it('inherits a project default across tabs and worktrees, with independent pane overrides', () => {
    const store = createTerminalBackgroundColorStore(memoryStorage())
    store.getState().setColor('project', target, '#123456')
    store.getState().setColor('pane', target, '#abcdef')
    expect(resolveTerminalBackgroundColor(store.getState(), target)).toBe('#abcdef')
    expect(resolveTerminalBackgroundColor(store.getState(), { ...target, leafId: 'leaf-b' })).toBe('#123456')
    expect(resolveTerminalBackgroundColor(store.getState(), { ...target, worktreeId: 'repo-a::/other', tabId: 'tab-b' })).toBe('#123456')
    expect(resolveTerminalBackgroundColor(store.getState(), { ...target, worktreeId: 'repo-b::/project' })).toBeUndefined()
  })

  it('reset restores project inheritance and clearing the default restores the theme', () => {
    const store = createTerminalBackgroundColorStore(memoryStorage())
    store.getState().setColor('project', target, '#123456')
    store.getState().setColor('pane', target, '#abcdef')
    store.getState().setColor('pane', target, null)
    expect(resolveTerminalBackgroundColor(store.getState(), target)).toBe('#123456')
    store.getState().setColor('project', target, null)
    expect(resolveTerminalBackgroundColor(store.getState(), target)).toBeUndefined()
  })

  it('persists normalized colors across store recreation and stable pane remounts', () => {
    const storage = memoryStorage()
    const store = createTerminalBackgroundColorStore(storage)
    store.getState().setColor('pane', target, '#ABC')
    const restored = createTerminalBackgroundColorStore(storage)
    expect(resolveTerminalBackgroundColor(restored.getState(), { ...target })).toBe('#aabbcc')
    expect(resolveTerminalBackgroundColor(restored.getState(), { ...target, tabId: 'new-tab' })).toBeUndefined()
  })

  it('rejects malformed colors and recovers from corrupt storage', () => {
    const store = createTerminalBackgroundColorStore(memoryStorage('{broken'))
    expect(store.getState().setColor('pane', target, 'url(https://example.com)')).toBe(false)
    expect(resolveTerminalBackgroundColor(store.getState(), target)).toBeUndefined()
    const restored = createTerminalBackgroundColorStore(memoryStorage(JSON.stringify({ version: 1, panes: { [getTerminalColorPaneKey(target)]: 'red' }, projects: {} })))
    expect(resolveTerminalBackgroundColor(restored.getState(), target)).toBeUndefined()
  })

  it('supports folder workspace instances and isolates remote project identities', () => {
    expect(getTerminalColorProjectKey('folder-id::/dir::workspace:uuid')).toBe('folder-id')
    expect(getTerminalColorProjectKey('remote-repo-id::/dir')).not.toBe(getTerminalColorProjectKey('local-repo-id::/dir'))
    expect(getTerminalColorProjectKey(FLOATING_TERMINAL_WORKTREE_ID)).toBeNull()
  })

  it('reports failed persistence without pretending that an unsaved color was saved', () => {
    const store = createTerminalBackgroundColorStore({ getItem: () => null, setItem: () => { throw new Error('quota') } })
    expect(store.getState().setColor('pane', target, '#123456')).toBe(false)
    expect(resolveTerminalBackgroundColor(store.getState(), target)).toBeUndefined()
  })
})
