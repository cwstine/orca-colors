export function isOrcaColorsBuild(version: string): boolean {
  return /(?:-|\.)colors\./.test(version)
}

export const ORCA_COLORS_UPDATE_MESSAGE =
  'This is an Orca Colors build. Update the staging branch of cwstine/orca-colors and rebuild to keep your custom features. Stock Orca updates would remove them.'
