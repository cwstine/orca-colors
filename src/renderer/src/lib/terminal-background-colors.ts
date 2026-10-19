import { createStore } from 'zustand/vanilla'
import { useStore } from 'zustand'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../shared/constants'
import { getRepoIdFromWorktreeId } from '../../../shared/worktree/id'
import { normalizeRepoBadgeColor } from '../../../shared/repo-badge-color'

export const TERMINAL_COLORS_STORAGE_KEY = 'orca-colors.backgrounds.v1'
export type TerminalColorTarget = { worktreeId: string; tabId: string; leafId: string }
export type TerminalColorScope = 'pane' | 'project'
type ColorRecords = { panes: Record<string, string>; projects: Record<string, string> }
type ColorStorage = Pick<Storage, 'getItem' | 'setItem'>
type ColorState = ColorRecords & {
  setColor: (
    scope: TerminalColorScope,
    target: TerminalColorTarget,
    color: string | null
  ) => boolean
  setProjectColor: (projectId: string, color: string | null) => boolean
  reload: () => void
}

export function getTerminalColorPaneKey(target: TerminalColorTarget): string {
  return JSON.stringify([target.worktreeId, target.tabId, target.leafId])
}

export function getTerminalColorProjectKey(worktreeId: string): string | null {
  return worktreeId === FLOATING_TERMINAL_WORKTREE_ID ? null : getRepoIdFromWorktreeId(worktreeId)
}

export function resolveTerminalBackgroundColor(
  colors: ColorRecords,
  target: TerminalColorTarget
): string | undefined {
  const project = getTerminalColorProjectKey(target.worktreeId)
  return (
    colors.panes[getTerminalColorPaneKey(target)] ??
    (project ? colors.projects[project] : undefined)
  )
}

function readColorMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, color]) => {
      const normalized = normalizeRepoBadgeColor(color)
      return normalized && !['__proto__', 'constructor', 'prototype'].includes(key)
        ? [[key, normalized]]
        : []
    })
  )
}

function readColors(storage?: ColorStorage): ColorRecords {
  try {
    const value: unknown = JSON.parse(storage?.getItem(TERMINAL_COLORS_STORAGE_KEY) ?? 'null')
    if (value && typeof value === 'object' && 'version' in value && value.version === 1) {
      return {
        panes: readColorMap('panes' in value ? value.panes : null),
        projects: readColorMap('projects' in value ? value.projects : null)
      }
    }
  } catch {
    /* A corrupt preference must not prevent the terminal from opening. */
  }
  return { panes: {}, projects: {} }
}

export function createTerminalBackgroundColorStore(storage?: ColorStorage) {
  return createStore<ColorState>((set) => {
    const saveColor = (
      scope: TerminalColorScope,
      key: string | null,
      color: string | null
    ): boolean => {
      const normalized = color === null ? null : normalizeRepoBadgeColor(color)
      if (!storage || !key || (color !== null && !normalized)) {
        return false
      }
      const { panes, projects } = readColors(storage)
      const next = { panes: { ...panes }, projects: { ...projects } }
      const map = scope === 'pane' ? next.panes : next.projects
      if (normalized) {
        map[key] = normalized
      } else {
        delete map[key]
      }
      try {
        storage.setItem(TERMINAL_COLORS_STORAGE_KEY, JSON.stringify({ version: 1, ...next }))
      } catch {
        return false
      }
      set(next)
      return true
    }
    return {
      ...readColors(storage),
      reload: () => set(readColors(storage)),
      setProjectColor: (projectId, color) => saveColor('project', projectId, color),
      setColor: (scope, target, color) =>
        saveColor(
          scope,
          scope === 'pane'
            ? getTerminalColorPaneKey(target)
            : getTerminalColorProjectKey(target.worktreeId),
          color
        )
    }
  })
}

function browserStorage(): ColorStorage | undefined {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

export const terminalBackgroundColors = createTerminalBackgroundColorStore(browserStorage())

export function useTerminalBackgroundColors() {
  return useStore(terminalBackgroundColors)
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === TERMINAL_COLORS_STORAGE_KEY || event.key === null) {
      terminalBackgroundColors.getState().reload()
    }
  })
}
