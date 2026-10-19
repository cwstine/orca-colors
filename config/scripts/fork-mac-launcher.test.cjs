const { test } = require('node:test')
const assert = require('node:assert/strict')
const {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  copyFileSync,
  chmodSync,
  rmSync
} = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { execFileSync } = require('node:child_process')

test(
  'the bundled macOS launcher finds a renamed executable from Info.plist',
  { skip: process.platform !== 'darwin' },
  () => {
    const root = mkdtempSync(join(tmpdir(), 'orca-colors-launcher-'))
    try {
      const contents = join(root, 'Orca Colors.app', 'Contents')
      const bin = join(contents, 'Resources', 'bin')
      mkdirSync(bin, { recursive: true })
      mkdirSync(join(contents, 'MacOS'), { recursive: true })
      writeFileSync(
        join(contents, 'Info.plist'),
        '<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict><key>CFBundleExecutable</key><string>Orca Colors</string></dict></plist>'
      )
      const executable = join(contents, 'MacOS', 'Orca Colors')
      writeFileSync(
        executable,
        '#!/bin/bash\n[ "$ELECTRON_RUN_AS_NODE" = 1 ] || exit 2\n[ "$2" = --version ] || exit 3\nprintf "colors-launcher-ok"\n'
      )
      chmodSync(executable, 0o755)
      const launcher = join(bin, 'orca')
      copyFileSync('resources/darwin/bin/orca', launcher)
      assert.equal(
        execFileSync('/bin/bash', [launcher, '--version'], { encoding: 'utf8' }),
        'colors-launcher-ok'
      )
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }
)
