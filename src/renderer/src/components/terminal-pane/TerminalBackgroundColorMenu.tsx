import { Check, Palette } from 'lucide-react'
import { toast } from 'sonner'
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger
} from '@/components/ui/dropdown-menu'
import { translate } from '@/i18n/i18n'
import {
  getTerminalColorPaneKey,
  getTerminalColorProjectKey,
  resolveTerminalBackgroundColor,
  useTerminalBackgroundColors,
  type TerminalColorTarget,
  type TerminalColorScope
} from '@/lib/terminal-background-colors'

export type TerminalCustomColorTarget = { target: TerminalColorTarget; scope: TerminalColorScope }

// User-selectable terminal colors, not application chrome tokens.
export const TERMINAL_BACKGROUND_PRESETS = [
  { label: 'Navy', color: '#1e2433' },
  { label: 'Plum', color: '#2a1f2d' },
  { label: 'Forest', color: '#1f2d24' },
  { label: 'Olive', color: '#2d2a1f' },
  { label: 'Teal', color: '#1f2a2d' },
  { label: 'Maroon', color: '#2d1f1f' }
] as const

export function TerminalBackgroundColorMenu({
  target,
  onCustomColor
}: {
  target: TerminalColorTarget
  onCustomColor: (target: TerminalCustomColorTarget) => void
}): React.JSX.Element {
  const colors = useTerminalBackgroundColors()
  const current = resolveTerminalBackgroundColor(colors, target)
  const paneColor = colors.panes[getTerminalColorPaneKey(target)]
  const projectKey = getTerminalColorProjectKey(target.worktreeId)
  const save = (scope: TerminalColorScope, color: string | null) => {
    if (!colors.setColor(scope, target, color)) {
      toast.error(translate('fork.colors.saveError', 'Could not save the terminal color.'))
    }
  }
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Palette />
        {translate('fork.colors.background', 'Background Color')}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        {TERMINAL_BACKGROUND_PRESETS.map(({ label, color }) => (
          <DropdownMenuItem key={color} onSelect={() => save('pane', color)}>
            <span
              aria-hidden
              className="size-4 rounded-sm border border-border"
              style={{ backgroundColor: color }}
            />
            {translate(`fork.colors.preset.${label.toLowerCase()}`, label)}
            {current === color ? <Check className="ml-auto" /> : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem onSelect={() => onCustomColor({ target, scope: 'pane' })}>
          {translate('fork.colors.custom', 'Custom Color…')}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!paneColor} onSelect={() => save('pane', null)}>
          {translate('fork.colors.resetPane', 'Use Project Default / Theme')}
        </DropdownMenuItem>
        {projectKey ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={!current}
              onSelect={() => {
                if (current && colors.setColor('project', target, current)) {
                  save('pane', null)
                } else {
                  toast.error(
                    translate('fork.colors.saveError', 'Could not save the terminal color.')
                  )
                }
              }}
            >
              {translate('fork.colors.useForProject', 'Use This Color for Project')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onCustomColor({ target, scope: 'project' })}>
              {translate('fork.colors.projectCustom', 'Choose Project Default…')}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!colors.projects[projectKey]}
              onSelect={() => save('project', null)}
            >
              {translate('fork.colors.resetProject', 'Clear Project Default')}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}
