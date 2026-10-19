import { describe, expect, it } from 'vitest'
import { isOrcaColorsBuild } from './orca-colors-build'

describe('Orca Colors build identity', () => {
  it('recognizes fork builds including upstream prereleases', () => {
    expect(isOrcaColorsBuild('1.4.224-colors.123')).toBe(true)
    expect(isOrcaColorsBuild('1.4.224-rc.1.colors.123')).toBe(true)
  })
  it('does not change stock or ordinary local build behavior', () => {
    expect(isOrcaColorsBuild('1.4.224')).toBe(false)
    expect(isOrcaColorsBuild('1.4.224-local.123.abc')).toBe(false)
  })
})
