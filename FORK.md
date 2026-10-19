# Orca Colors

Personal fork of [stablyai/orca](https://github.com/stablyai/orca), maintained at [cwstine/orca-colors](https://github.com/cwstine/orca-colors). The customized branch is **staging**. The initial **main** branch is an unmodified upstream snapshot; the update job compares directly with upstream main.

## Terminal colors

Right-click a terminal pane and open **Background Color**:

- Choose Navy, Plum, Forest, Olive, Teal or Maroon, or **Custom Color…** for the existing color picker and hex input.
- **Use This Color for Project** makes the selected color the project default and returns this pane to inheritance.
- **Choose Project Default…** sets a default for all of that project's terminals, including other worktrees and new panes. Existing pane overrides remain in force.
- **Use Project Default / Theme** clears this pane's override.
- **Clear Project Default** returns inheriting panes to the application theme.

The order is **pane override → project default → terminal theme**. Colors are applied directly to xterm, without typing anything into the shell or agent. Orca's opacity and contrast settings still apply. Applications that deliberately repaint their own background can temporarily cover the selected color.

Preferences are saved in the local profile's renderer storage (`orca-colors.backgrounds.v1`). They survive app restarts and theme changes. A pane is identified by workspace, tab and stable layout leaf, not its temporary renderer number. Folder projects are supported; floating terminals have pane colors but no project default. Remote projects are colored locally; preferences are not written to the remote machine or shared with another device. The menu belongs to the terminal view; it does not recolor native chat transcripts or the entire app window.

## Upstream updates

**Fork upstream updates** runs daily at **11:23 UTC** and can also be run from the Actions page. It compares upstream `stablyai/orca:main` with this fork's `staging` branch and opens one update PR when there are new commits. Automatic PR creation is enabled through `ORCA_COLORS_CREATE_UPDATE_PRS=true` and the approved GitHub workflow permission. If that variable is disabled, the workflow falls back to reporting a comparison link. An existing open PR continues tracking upstream directly, so repeated runs do not create duplicates.

Updates are **proposed automatically**, not automatically merged or installed. Review and merge the update PR into `staging`, resolve any conflicts while preserving the color changes, then rebuild. This keeps future upstream changes reviewable and prevents a conflict from discarding the custom feature. This tracks all changes on upstream main, including changes before an official release.

**Fork checks** tests the color feature, updater guard, automation and renderer types using standard GitHub runners. Upstream's inherited workflows use Stably infrastructure and are kept disabled in this fork; their YAML remains intact to reduce future merge conflicts. These focused checks do not replace upstream's full multi-platform test matrix.

GitHub may require approval for checks triggered by a bot-created PR. Approve the pending run, or run **Fork checks** manually with `refs/pull/NUMBER/merge`. If conflicts prevent that merge ref from existing, resolve them first. GitHub may disable scheduled workflows after 60 days without repository activity; re-enable **Fork upstream updates** on the Actions page if that happens.

## Develop and build on macOS

Use Node **24** and the exact pnpm version in `package.json`. In this repository:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

For a separate **Orca Colors.app** built for the current Mac's architecture:

```sh
pnpm run build:desktop
pnpm run build:computer-macos
pnpm run build:keyboard-layout-macos
pnpm run build:notification-status-macos
pnpm run ensure:electron-runtime
node config/scripts/build-orca-colors.mjs
```

The app is produced under `dist/`. The build uses a `colors` version suffix, disables publishing, and does not replace `/Applications/Orca.app`. It is an unsigned local build, not an Apple-notarized distribution. The packaged app blocks checks against stock Orca releases because installing one would remove the custom feature. A signed automatic app-update channel is not configured; update via this repository and rebuild.

## Verification

```sh
node --test config/scripts/fork-upstream-proposal.test.cjs config/scripts/fork-mac-launcher.test.cjs
pnpm exec vitest run --config config/vitest.config.ts \
  src/renderer/src/lib/terminal-background-colors.test.ts \
  src/renderer/src/components/terminal-pane/compose-active-terminal-theme.test.ts \
  src/renderer/src/components/terminal-pane/terminal-appearance.test.ts \
  src/renderer/src/components/terminal-pane/TerminalBackgroundColorMenu.test.tsx \
  src/shared/orca-colors-build.test.ts \
  src/main/updater.orca-colors.test.ts
node config/scripts/run-typecheck-projects-in-parallel.mjs --compiler=native --project=config/tsconfig.tc.web.json
```

The implementation is tested through unit and DOM interaction tests. A packaged app and a visual Electron session must be validated before treating the build as an installed, tested release.
