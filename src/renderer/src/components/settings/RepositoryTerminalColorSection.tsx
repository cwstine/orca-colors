import { useState } from 'react'
import { Check } from 'lucide-react'
import type { Repo } from '../../../../shared/repo-types'
import { useTerminalBackgroundColors } from '@/lib/terminal-background-colors'
import { translate } from '@/i18n/i18n'
import { TERMINAL_BACKGROUND_PRESETS } from '../terminal-pane/TerminalBackgroundColorMenu'
import { Button } from '../ui/button'
import { ColorPicker } from '../ui/color-picker'
import { Label } from '../ui/label'
import { SearchableSetting } from './SearchableSetting'
import { getRepositoryTerminalColorSectionId } from './repository-settings-targets'
import { getRepositoryTerminalColorSearchEntry } from './repository-search'

export function RepositoryTerminalColorSection({
  repo,
  forceVisible = false
}: {
  repo: Repo
  forceVisible?: boolean
}): React.JSX.Element {
  const colors = useTerminalBackgroundColors()
  const color = colors.projects[repo.id]
  const [error, setError] = useState(false)
  const entry = getRepositoryTerminalColorSearchEntry(repo)
  const save = (next: string | null) => setError(!colors.setProjectColor(repo.id, next))
  return (
    <SearchableSetting
      {...entry}
      id={getRepositoryTerminalColorSectionId(repo.id)}
      className="space-y-2"
      forceVisible={forceVisible}
    >
      <Label>{entry.title}</Label>
      <p className="text-sm text-muted-foreground">{entry.description}</p>
      <div className="flex flex-wrap items-center gap-2">
        {TERMINAL_BACKGROUND_PRESETS.map((preset) => (
          <Button
            key={preset.color}
            variant="outline"
            size="sm"
            aria-pressed={color === preset.color}
            onClick={() => save(preset.color)}
          >
            <span
              aria-hidden
              className="size-4 rounded-sm border border-border"
              style={{ backgroundColor: preset.color }}
            />
            {translate(`fork.colors.preset.${preset.label.toLowerCase()}`, preset.label)}
            {color === preset.color ? <Check aria-hidden /> : null}
          </Button>
        ))}
        <ColorPicker
          key={repo.id}
          value={color ?? TERMINAL_BACKGROUND_PRESETS[0].color}
          onChange={save}
          label={translate('fork.colors.projectCustom', 'Choose Project Default…')}
          triggerLabel={translate('fork.colors.custom', 'Custom Color…')}
          showHexInTrigger={Boolean(color)}
        />
        <Button variant="outline" size="sm" disabled={!color} onClick={() => save(null)}>
          {translate('fork.colors.useTheme', 'Use Terminal Theme')}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {translate('fork.colors.saveError', 'Could not save the terminal color.')}
        </p>
      ) : null}
    </SearchableSetting>
  )
}
