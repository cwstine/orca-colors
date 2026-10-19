import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runProcess } from '@orca/process-host'

if (process.platform !== 'darwin') {
  throw new Error(
    'This packaging entry point currently targets macOS. The color feature itself is cross-platform.'
  )
}
const { version } = JSON.parse(readFileSync(resolve('package.json'), 'utf8'))
const env = {
  ...process.env,
  ORCA_LOCAL_BUILD_VERSION: `${version}${version.includes('-') ? '.' : '-'}colors.${Date.now()}`,
  ORCA_BACKGROUND_LAUNCH: '1',
  CSC_IDENTITY_AUTO_DISCOVERY: 'false'
}
const result = await runProcess({
  program: 'pnpm',
  args: [
    'exec',
    'electron-builder',
    '--config',
    'config/electron-builder.colors.cjs',
    '--mac',
    '--dir',
    `--${process.arch}`,
    '--publish',
    'never'
  ],
  env,
  cwd: process.cwd(),
  timeoutMs: 30 * 60 * 1000
})
if (result.stdout) {
  process.stdout.write(result.stdout)
}
if (result.stderr) {
  process.stderr.write(result.stderr)
}
if (result.code !== 0) {
  process.exitCode = result.code ?? 1
}
