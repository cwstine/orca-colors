import { describe, expect, it } from 'vitest'
import { agentLaunchSettingsMutationUpdates } from './agent-launch-settings'
import { structuredLaunchSeedOptions } from './native-chat-session-option-defaults'

describe('agent permission presets and new chats', () => {
  it.each([
    ['auto', 'auto'],
    ['yolo', 'full-access'],
    ['manual', 'ask']
  ] as const)('uses %s as the terminal preset and %s as the new chat default', (mode, expected) => {
    const updates = agentLaunchSettingsMutationUpdates(
      { nativeChatPermissionMode: 'accept-edits' },
      { type: 'permissions', syncNativeChat: true, mode },
      'linux'
    )
    expect(updates.nativeChatPermissionMode).toBe(expected)
    for (const agent of ['claude', 'codex'] as const) {
      expect(structuredLaunchSeedOptions(updates, agent)).toEqual({ permissionMode: expected })
    }
  })

  it('narrows Auto to Ask for new chats whose agents have no automatic reviewer', () => {
    const settings = agentLaunchSettingsMutationUpdates(
      {},
      { type: 'permissions', syncNativeChat: true, mode: 'auto' },
      'linux'
    )
    expect(structuredLaunchSeedOptions(settings, 'omp')).toEqual({ permissionMode: 'ask' })
    expect(structuredLaunchSeedOptions(settings, 'pi')).toBeUndefined()
  })

  it('keeps the separate chat default when editing terminal arguments', () => {
    const updates = agentLaunchSettingsMutationUpdates(
      { nativeChatPermissionMode: 'accept-edits' },
      { type: 'arguments', agent: 'claude', value: '--permission-mode auto' },
      'linux'
    )
    expect(updates).not.toHaveProperty('nativeChatPermissionMode')
  })
})

it.each(['manual', 'yolo', 'auto'] as const)(
  'keeps legacy %s mutations terminal-only on native-capable hosts',
  (mode) => {
    const before = {
      nativeChatPermissionMode: 'accept-edits' as const,
      agentNativeChatPermissionModes: { codex: 'auto' as const }
    }
    const updates = agentLaunchSettingsMutationUpdates(
      before,
      { type: 'permissions', mode },
      'linux'
    )
    expect(updates).not.toHaveProperty('nativeChatPermissionMode')
    expect(updates).not.toHaveProperty('agentNativeChatPermissionModes')
    expect({ ...before, ...updates }.nativeChatPermissionMode).toBe('accept-edits')
  }
)
