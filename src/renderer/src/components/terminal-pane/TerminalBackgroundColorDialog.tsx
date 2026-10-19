import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ColorPicker } from '@/components/ui/color-picker'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { translate } from '@/i18n/i18n'
import {
  getTerminalColorProjectKey,
  resolveTerminalBackgroundColor,
  terminalBackgroundColors
} from '@/lib/terminal-background-colors'
import {
  TERMINAL_BACKGROUND_PRESETS,
  type TerminalCustomColorTarget
} from './TerminalBackgroundColorMenu'

export function TerminalBackgroundColorDialog({
  selection,
  onClose
}: {
  selection: TerminalCustomColorTarget
  onClose: () => void
}): React.JSX.Element {
  const [color, setColor] = useState(() => {
    const state = terminalBackgroundColors.getState()
    const projectKey = getTerminalColorProjectKey(selection.target.worktreeId)
    return (
      (selection.scope === 'project' && projectKey
        ? state.projects[projectKey]
        : resolveTerminalBackgroundColor(state, selection.target)) ??
      TERMINAL_BACKGROUND_PRESETS[0].color
    )
  })
  const [error, setError] = useState(false)
  const title =
    selection.scope === 'project'
      ? translate('fork.colors.projectCustom', 'Choose Project Default…')
      : translate('fork.colors.custom', 'Custom Color…')
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {selection.scope === 'project'
              ? translate(
                  'fork.colors.projectHelp',
                  'Applies to this project’s terminals unless a terminal has its own color.'
                )
              : translate(
                  'fork.colors.paneHelp',
                  'Applies only to this terminal pane and is saved across restarts.'
                )}
          </DialogDescription>
        </DialogHeader>
        <ColorPicker
          label={translate('fork.colors.background', 'Background Color')}
          value={color}
          onChange={setColor}
        />
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {translate('fork.colors.saveError', 'Could not save the terminal color.')}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {translate('fork.colors.cancel', 'Cancel')}
          </Button>
          <Button
            onClick={() => {
              if (
                terminalBackgroundColors
                  .getState()
                  .setColor(selection.scope, selection.target, color)
              ) {
                onClose()
              } else {
                setError(true)
              }
            }}
          >
            {translate('fork.colors.save', 'Save Color')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
