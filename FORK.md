# Orca Colors

Personal fork of [stablyai/orca](https://github.com/stablyai/orca), maintained at [cwstine/orca-colors](https://github.com/cwstine/orca-colors). The customized branch is **staging**. The initial **main** branch is an unmodified upstream snapshot; the update job compares directly with upstream main.

## Terminal colors

Open a project’s **⋯ → Terminal Background…**, or **Project Settings → Terminal Background**, to choose a preset or custom color for all its terminals. Changes save immediately and apply across worktrees; **Use Terminal Theme** clears the project default. Individual terminal overrides remain in force.

Right-click a terminal pane and open **Background Color**:

- Choose Navy, Plum, Forest, Olive, Teal or Maroon, or **Custom Color…** for the existing color picker and hex input.
- **Use This Color for Project** makes the selected color the project default and returns this pane to inheritance.
- **Choose Project Default…** sets a default for all of that project's terminals, including other worktrees and new panes. Existing pane overrides remain in force.
- **Use Project Default / Theme** clears this pane's override.
- **Clear Project Default** returns inheriting panes to the application theme.

The order is **pane override → project default → terminal theme**. Colors are applied directly to xterm, without typing anything into the shell or agent. Orca's opacity and contrast settings still apply. Applications that deliberately repaint their own background can temporarily cover the selected color.

Preferences are saved in the local profile's renderer storage (`orca-colors.backgrounds.v1`). They survive app restarts and theme changes. A pane is identified by workspace, tab and stable layout leaf, not its temporary renderer number. Folder projects are supported; floating terminals have pane colors but no project default. Remote projects are colored locally; preferences are not written to the remote machine or shared with another device. The menu belongs to the terminal view; it does not recolor native chat transcripts or the entire app window.

## Upstream updates

**Fork upstream updates** runs **hourly at minute 23** and can also be run from the Actions page. It compares upstream `stablyai/orca:main` with this fork's `staging` branch and opens one update PR when there are new commits. Automatic PR creation is enabled through `ORCA_COLORS_CREATE_UPDATE_PRS=true`. If that variable is disabled, the workflow reports a comparison link. Each update uses a branch pinned to one upstream commit. While that PR is open, repeated runs retry its checks without moving its source branch. Newer upstream commits are picked up after it merges. GitHub may delay scheduled runs; this is hourly polling, not immediate delivery.

### Sync credential

Add an Actions repository secret named **`ORCA_COLORS_SYNC_TOKEN`** in [this fork's secret settings](https://github.com/cwstine/orca-colors/settings/secrets/actions). Create a fine-grained personal access token owned by `cwstine`, restricted to **only `orca-colors`**, with these repository permissions:

- **Actions: Read and write** — dispatch the fork's validation workflow.
- **Contents: Read and write** — create pinned upstream branches and merge updates.
- **Pull requests: Read and write** — create update PRs, close the replaced moving-head PR, and enable auto-merge.
- **Workflows: Read and write** — import upstream commits that modify workflow files.

Metadata read access is automatic. Choose an expiry and replace the secret before the token expires. Enter the value directly into GitHub; never commit it or include it in a PR description. See [GitHub's token setup instructions](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens).

The secret is required for automatic update PRs and merges, with no default. GitHub's built-in token cannot grant the Workflows permission needed here. The former fallback to a direct upstream PR also failed to enable auto-merge, so missing credentials or permissions now produce an explicit setup error. Report-only polling still works without a secret.

The workflows expose this secret as the internal `SYNC_TOKEN` environment variable only in trusted proposal/report steps. Candidate code receives no sync credential. Status reporting continues to use the built-in token; the dedicated client enables auto-merge only after successful validation of the current head and base. This token does not need Commit statuses or Administration write access.

Updates are **merged automatically after the required fork checks pass**, using `ORCA_COLORS_AUTO_MERGE=true` and GitHub auto-merge. Checks test a pinned merge of upstream and this fork, with a required `Orca Colors checks` status on the upstream commit. Conflicts and failed checks leave the PR open for attention. This tracks all changes on upstream main, including changes before an official release. Rebuild the app after source updates; this workflow does not install app updates.

**Fork checks** tests the color feature, updater guard, automation and renderer types using standard GitHub runners. Upstream's inherited workflows use Stably infrastructure and are kept disabled in this fork; their YAML remains intact to reduce future merge conflicts. These focused checks do not replace upstream's full multi-platform test matrix.

The hourly update workflow explicitly dispatches **Fork checks** from trusted `staging` with the upstream PR number, avoiding bot-created PR approval prompts. Candidate code runs in a separate job with read-only permissions and no secrets. A separate trusted job publishes the required status only if the tested head and base are still current, then enables auto-merge with the sync credential. To retry, run **Fork upstream updates** manually. If conflicts prevent a merge candidate from existing, resolve them first. GitHub may disable scheduled workflows after 60 days without repository activity; re-enable **Fork upstream updates** on the Actions page if that happens.

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
node --test config/scripts/fork-upstream-proposal.test.cjs config/scripts/fork-mac-launcher.test.cjs config/scripts/fork-check-status.test.cjs
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
