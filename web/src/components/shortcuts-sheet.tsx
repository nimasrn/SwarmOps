import { Body, List, ListRow, Mono, Sheet, Stack as Rows, Label } from '@nim.zone/ui'
import { shortcutGroups } from '../navigation/shortcuts'

/**
 * Every chord the console binds, in the surface the `?` key opens.
 *
 * It is generated from the same list that installs the bindings, so a shortcut
 * cannot exist without appearing here and cannot be documented without
 * existing. The `G` chords are listed with the area summaries beside them
 * because that is what makes them memorable: `G` then `F` is not a key
 * combination to learn, it is the sentence "go to fleet".
 */
export function ShortcutsSheet({ onClose, open }: { onClose: () => void; open: boolean }) {
  return (
    <Sheet closeLabel="Close keyboard shortcuts" onClose={onClose} open={open} title="Keyboard shortcuts">
      <Rows gap="md">
        <Body size="sm" tone="muted">
          Bare letters work anywhere except inside a text field, so a confirmation phrase never loses a keystroke to a shortcut.
        </Body>
        {shortcutGroups().map((group) => (
          <Rows gap="tight" key={group.title}>
            <Label as="p">{group.title}</Label>
            <List plain>
              {group.hints.map((hint) => (
                <ListRow
                  key={hint.keys}
                  subtitle={hint.hint}
                  title={hint.label}
                  trailing={<Mono>{hint.keys}</Mono>}
                />
              ))}
            </List>
          </Rows>
        ))}
      </Rows>
    </Sheet>
  )
}
