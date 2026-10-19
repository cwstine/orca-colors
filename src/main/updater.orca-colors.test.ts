import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadUpdaterModule, warmUpdaterModule } from './updater-test-module-loader'

const { appMock, autoUpdaterMock, moduleFactories, resetUpdaterMocks } = await vi.hoisted(
  async () => (await import('./updater-test-harness')).createUpdaterMocks()
)

vi.mock('electron', () => moduleFactories.electron())
vi.mock('electron-updater', () => moduleFactories.electronUpdater())
vi.mock('./electron-updater-loader', () => moduleFactories.electronUpdaterLoader())
vi.mock('@electron-toolkit/utils', () => moduleFactories.electronToolkitUtils())
vi.mock('./ipc/pty/kill-all', () => moduleFactories.ptyKillAll())
vi.mock('./linux-update-package-type', () => moduleFactories.linuxUpdatePackageType())
vi.mock('./updater-lifecycle-diagnostics', () => moduleFactories.updaterLifecycleDiagnostics())
vi.mock('./updater-changelog', () => moduleFactories.updaterChangelog())
vi.mock('./updater-nudge', () => moduleFactories.updaterNudge())
vi.mock('./update-install-exit-watchdog', () => moduleFactories.updateInstallExitWatchdog())
vi.mock('./updater-prerelease-feed', () => moduleFactories.updaterPrereleaseFeed())
vi.mock('./local-builds/local-build-switch', () => moduleFactories.localBuildSwitch())
vi.mock('./local-builds/local-build-feed-server', () => moduleFactories.localBuildFeedServer())

warmUpdaterModule()

describe('Orca Colors stock-update protection', () => {
  beforeEach(() => resetUpdaterMocks())
  it('blocks automatic and menu checks against stock releases', async () => {
    appMock.getVersion.mockReturnValue('1.4.224-colors.123')
    const updater = await loadUpdaterModule()
    updater.setupAutoUpdater(null, { getLastUpdateCheckAt: () => Date.now() })
    autoUpdaterMock.checkForUpdates.mockClear()
    updater.checkForUpdates()
    expect(autoUpdaterMock.checkForUpdates).not.toHaveBeenCalled()
    updater.checkForUpdatesFromMenu()
    expect(updater.getUpdateStatus()).toMatchObject({
      state: 'error',
      message: expect.stringContaining('Orca Colors')
    })
    updater.checkForUpdatesFromMenu({ channel: 'stable', targetTag: 'v1.4.225' })
    expect(autoUpdaterMock.checkForUpdates).not.toHaveBeenCalled()
  })
})
