import { useMemo, useRef, useState } from 'react'
import { FieldShell } from '@/components/field'
import { Icon } from '@/components/icon'
import { IconButton } from '@/components/icon-button'
import { Popover } from '@/components/menu'
import { useNim } from '@/components/theme'
import { cn } from '@/lib/cn'
import {
  addDays,
  addMonths,
  defaultSystem,
  defaultWeekStart,
  formatNumeric,
  localeFor,
  parseNumeric,
  partsOf,
  startOfMonth,
  todayIso,
  weekdayOf,
  type CalendarSystem,
  type IsoDate,
} from '@/lib/calendars'

export type { CalendarSystem, IsoDate } from '@/lib/calendars'

export interface CalendarProps {
  className?: string
  /** Days to flag — a due date, a booking, anything the month should mark. */
  marked?: IsoDate[]
  max?: IsoDate
  min?: IsoDate
  month: IsoDate
  onMonthChange: (month: IsoDate) => void
  onSelect: (date: IsoDate) => void
  /** The calendar the grid is drawn in. Defaults to Jalali for an `fa` locale
      and Gregorian everywhere else. The value stays an ISO Gregorian date in
      both — the calendar is what the viewer reads, not what the API gets. */
  system?: CalendarSystem
  value?: IsoDate | null
  /** 1 = Monday. Defaults to Saturday on the Jalali calendar, Monday on the
      Gregorian one — the week does not start on the same day everywhere. */
  weekStart?: number
}

const labels = {
  next: 'Next month',
  previous: 'Previous month',
}

export function Calendar({
  className,
  marked = [],
  max,
  min,
  month,
  onMonthChange,
  onSelect,
  system,
  value,
  weekStart,
}: CalendarProps) {
  const { locale } = useNim()
  const calendar = system ?? defaultSystem(locale)
  const start = weekStart ?? defaultWeekStart(calendar)
  const today = todayIso()
  const intlLocale = localeFor(locale, calendar)

  // Month name, weekday names and the digits all come from the locale and the
  // calendar together. Before 0.4 the grid was Gregorian by contract and the
  // formatter was pinned to `gregory` to stop an `fa` locale labelling it
  // «شهریور» over Gregorian cells. Now the grid itself can be Jalali, so the
  // label and the cells agree either way — and pinning would be the bug.
  const monthFormat = useMemo(
    () => new Intl.DateTimeFormat(intlLocale, { month: 'long', timeZone: 'UTC', year: 'numeric' }),
    [intlLocale],
  )
  const dayFormat = useMemo(() => new Intl.NumberFormat(locale), [locale])
  const weekdayFormat = useMemo(
    () => new Intl.DateTimeFormat(intlLocale, { timeZone: 'UTC', weekday: 'short' }),
    [intlLocale],
  )

  const anchor = startOfMonth(month, calendar)
  const anchorMonth = partsOf(anchor, calendar).month

  const days = useMemo(() => {
    // How far back the grid must reach to land on the week's first day.
    const lead = (weekdayOf(anchor) - start + 7) % 7
    const gridStart = addDays(anchor, -lead)

    return Array.from({ length: 42 }, (_, index) => {
      const date = addDays(gridStart, index)
      const parts = partsOf(date, calendar)
      return { date, day: parts.day, outside: parts.month !== anchorMonth }
    })
  }, [anchor, anchorMonth, calendar, start])

  const weekdays = useMemo(() => {
    // 2024-01-07 is a Sunday, so adding the weekday index walks a real week.
    const sunday = '2024-01-07'
    return Array.from({ length: 7 }, (_, index) => ({
      key: `${start}-${index}`,
      label: weekdayFormat.format(new Date(`${addDays(sunday, (start + index) % 7)}T00:00:00Z`)),
    }))
  }, [start, weekdayFormat])

  return (
    <div className={cn('nim-calendar', className)}>
      <div className="nim-calendar__header">
        <IconButton
          label={labels.previous}
          name="chevron-back"
          onClick={() => onMonthChange(addMonths(anchor, -1, calendar))}
          size="sm"
        />
        <span className="nim-calendar__month">
          {monthFormat.format(new Date(`${anchor}T00:00:00Z`))}
        </span>
        <IconButton
          label={labels.next}
          name="chevron-forward"
          onClick={() => onMonthChange(addMonths(anchor, 1, calendar))}
          size="sm"
        />
      </div>
      <div className="nim-calendar__grid" role="grid">
        {weekdays.map((weekday) => (
          <span className="nim-calendar__weekday" key={weekday.key}>
            {weekday.label}
          </span>
        ))}
        {days.map((day) => (
          <button
            aria-selected={day.date === value}
            className={cn(
              'nim-calendar__day',
              day.outside && 'nim-calendar__day--outside',
              day.date === today && 'nim-calendar__day--today',
              marked.includes(day.date) && 'nim-calendar__day--marked',
            )}
            disabled={(min !== undefined && day.date < min) || (max !== undefined && day.date > max)}
            key={day.date}
            onClick={() => onSelect(day.date)}
            role="gridcell"
            type="button"
          >
            {dayFormat.format(day.day)}
          </button>
        ))}
      </div>
    </div>
  )
}

interface DateEntryProps extends Omit<CalendarProps, 'month' | 'onMonthChange' | 'onSelect' | 'value'> {
  error?: string
  hint?: string
  id?: string
  label?: string
  onChange: (value: IsoDate) => void
  required?: boolean
  value: IsoDate
}

export type DateFieldProps = DateEntryProps

/**
 * The typed half of date entry, shared by the field and the picker.
 *
 * On the Gregorian calendar this is `<input type="date">`: the mobile date
 * keyboard, the locale's field order and form validation all come from the
 * platform, and none of it is worth reimplementing. On the Jalali calendar the
 * platform has nothing to offer — no browser ships a Jalali date input — so it
 * is a text field that reads `۱۴۰۴/۰۶/۰۱`, accepts Persian digits, and commits
 * only what round-trips through ICU.
 */
function DateEntry({
  calendar,
  describedBy,
  id,
  invalid,
  locale,
  onChange,
  value,
}: {
  calendar: CalendarSystem
  describedBy?: string
  id: string
  invalid?: boolean
  locale: string | undefined
  onChange: (value: IsoDate) => void
  value: IsoDate
}) {
  // What the viewer is typing, kept apart from the committed value so a
  // half-written year is not repeatedly reformatted under the caret.
  const [draft, setDraft] = useState<string | null>(null)

  if (calendar === 'gregory') {
    return (
      <input
        aria-describedby={describedBy}
        aria-invalid={invalid ? true : undefined}
        className="nim-input"
        id={id}
        onChange={(event) => onChange(event.target.value)}
        type="date"
        value={value}
      />
    )
  }

  const shown = draft ?? (value ? formatNumeric(value, locale, calendar) : '')

  return (
    <input
      aria-describedby={describedBy}
      aria-invalid={invalid ? true : undefined}
      className="nim-input"
      dir="ltr"
      id={id}
      inputMode="numeric"
      onBlur={() => setDraft(null)}
      onChange={(event) => {
        setDraft(event.target.value)
        const parsed = parseNumeric(event.target.value, calendar)
        if (parsed) onChange(parsed)
        else if (event.target.value.trim() === '') onChange('')
      }}
      placeholder={formatNumeric(todayIso(), locale, calendar)}
      type="text"
      value={shown}
    />
  )
}

/**
 * A text field with a calendar under it, in that order of importance: typing a
 * date always works, which matters more to more people than the grid does.
 *
 * Both halves answer the same calendar system, so a Persian interface types
 * ۱۴۰۴/۰۶/۰۱ into a Jalali grid — and still hands the caller `2025-08-23`.
 */
export function DateField({
  error,
  hint,
  id,
  label,
  onChange,
  required,
  value,
  ...calendarProps
}: DateFieldProps) {
  const { locale } = useNim()
  const calendar = calendarProps.system ?? defaultSystem(locale)
  const [month, setMonth] = useState<IsoDate>(value || todayIso())

  return (
    <FieldShell error={error} hint={hint} id={id} label={label} required={required}>
      {({ control, describedBy }) => (
        <div className="nim-stack nim-stack--tight">
          <DateEntry
            calendar={calendar}
            describedBy={describedBy}
            id={control}
            invalid={Boolean(error)}
            locale={locale}
            onChange={(next) => {
              onChange(next)
              if (next) setMonth(next)
            }}
            value={value}
          />
          <Calendar
            {...calendarProps}
            month={month}
            onMonthChange={setMonth}
            onSelect={(date) => {
              onChange(date)
              setMonth(date)
            }}
            system={calendar}
            value={value}
          />
        </div>
      )}
    </FieldShell>
  )
}

export interface DatePickerProps extends DateEntryProps {
  /** Accessible names for the two controls the picker adds. */
  labels?: { clear: string; open: string }
  /** The same date on the other calendar, under the field. On by default for
      Jalali, where a viewer often has to reconcile a Gregorian document. */
  showEquivalent?: boolean
}

/**
 * The compact form of date entry: one field, with the grid behind a button.
 *
 * Use it in a form, where a permanently open month steals the space three
 * other fields need; `DateField` is for the screen whose subject is the date.
 * On the Jalali calendar it prints the Gregorian equivalent under the field —
 * the reconciliation an Iranian office does by hand all day.
 */
export function DatePicker({
  error,
  hint,
  id,
  label,
  labels: names,
  onChange,
  required,
  showEquivalent,
  value,
  ...calendarProps
}: DatePickerProps) {
  const { locale } = useNim()
  const calendar = calendarProps.system ?? defaultSystem(locale)
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState<IsoDate>(value || todayIso())
  const trigger = useRef<HTMLButtonElement>(null)
  const text = { clear: 'Clear date', open: 'Open calendar', ...names }
  const equivalent = showEquivalent ?? calendar === 'persian'
  const other: CalendarSystem = calendar === 'persian' ? 'gregory' : 'persian'

  return (
    <FieldShell error={error} hint={hint} id={id} label={label} required={required}>
      {({ control, describedBy }) => (
        <div className="nim-date-picker">
          <div className="nim-date-picker__group">
            <DateEntry
              calendar={calendar}
              describedBy={describedBy}
              id={control}
              invalid={Boolean(error)}
              locale={locale}
              onChange={(next) => {
                onChange(next)
                if (next) setMonth(next)
              }}
              value={value}
            />
            {value ? (
              <IconButton
                label={text.clear}
                name="close"
                onClick={() => onChange('')}
                size="sm"
              />
            ) : null}
            <IconButton
              aria-expanded={open}
              label={text.open}
              name="calendar"
              onClick={() => setOpen((was) => !was)}
              ref={trigger}
              size="sm"
            />
          </div>

          {equivalent && value ? (
            <p className="nim-date-picker__equivalent">
              <Icon name="calendar" size="xs" />
              <span dir={other === 'gregory' ? 'ltr' : undefined}>
                {formatNumeric(value, locale, other)}
              </span>
            </p>
          ) : null}

          <Popover
            label={label ?? text.open}
            onClose={() => setOpen(false)}
            open={open}
            triggerRef={trigger}
          >
            <Calendar
              {...calendarProps}
              month={month}
              onMonthChange={setMonth}
              onSelect={(date) => {
                onChange(date)
                setMonth(date)
                setOpen(false)
              }}
              system={calendar}
              value={value}
            />
          </Popover>
        </div>
      )}
    </FieldShell>
  )
}
