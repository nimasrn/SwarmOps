/**
 * Calendar arithmetic for the two systems the kit draws: Gregorian and
 * Jalali (Solar Hijri).
 *
 * There is no conversion table and no leap-year rule in this file, because the
 * platform already ships one: `Intl.DateTimeFormat` with `-u-ca-persian` is
 * ICU's Persian calendar, and it is the same implementation a browser uses to
 * label a date anywhere else. So the direction that is hard — Gregorian to
 * Jalali — is asked of `Intl`, and the direction that is easy — Jalali back to
 * Gregorian — is a close estimate corrected against that same answer until it
 * round-trips. Every value this module returns has therefore been checked
 * against the platform's own calendar rather than against a table that has to
 * be maintained here and goes wrong in 1403 or 2049.
 *
 * The kit's value type never changes: an `IsoDate` is always the Gregorian
 * `YYYY-MM-DD`, in every calendar system. What the viewer reads and what the
 * API receives are different questions, and only the first one has a calendar.
 */

/** ISO `YYYY-MM-DD`, Gregorian, always. The kit never invents a date type. */
export type IsoDate = string

/** The calendar a grid is drawn in — never what a value is stored in. */
export type CalendarSystem = 'gregory' | 'persian'

export interface CalendarParts {
  day: number
  month: number
  year: number
}

const DAY_MS = 86_400_000

/** 1 Farvardin 1 — the Solar Hijri epoch, as a Gregorian UTC timestamp. */
const PERSIAN_EPOCH_MS = Date.UTC(622, 2, 22)
const PERSIAN_YEAR_DAYS = 365.2422

export const isoOf = (date: Date): IsoDate => date.toISOString().slice(0, 10)
export const dateOf = (value: IsoDate): Date => new Date(`${value}T00:00:00Z`)
export const todayIso = (): IsoDate => isoOf(new Date())

/**
 * Latin digits and the Persian calendar, regardless of the interface locale:
 * this formatter is read by the code, not by a person. What the viewer sees is
 * formatted separately, in their own locale.
 */
const PERSIAN_PARTS = new Intl.DateTimeFormat('en-u-ca-persian-nu-latn', {
  day: 'numeric',
  month: 'numeric',
  timeZone: 'UTC',
  year: 'numeric',
})

/** The calendar fields a viewer of `system` would read off this instant. */
export function partsOf(value: IsoDate, system: CalendarSystem): CalendarParts {
  const date = dateOf(value)
  if (system === 'gregory') {
    return { day: date.getUTCDate(), month: date.getUTCMonth() + 1, year: date.getUTCFullYear() }
  }

  const parts = PERSIAN_PARTS.formatToParts(date)
  const field = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? '0')
  // `year` comes back as an era year; the Persian calendar has one era in use,
  // so it is the year. `relatedYear` would be the Gregorian one — not wanted.
  return { day: field('day'), month: field('month'), year: field('year') }
}

const rank = (parts: CalendarParts) => parts.year * 10_000 + parts.month * 100 + parts.day

/**
 * The Gregorian date on which `parts` falls in `system`.
 *
 * For Jalali this starts from the mean-year estimate and walks to the answer,
 * comparing against `partsOf` — which is ICU. The estimate is never more than
 * a few days out, and the loop is bounded, so a bad input fails by returning
 * its best effort rather than by spinning.
 */
export function fromParts(parts: CalendarParts, system: CalendarSystem): IsoDate {
  if (system === 'gregory') {
    return isoOf(new Date(Date.UTC(parts.year, parts.month - 1, parts.day)))
  }

  const estimateDays =
    Math.floor((parts.year - 1) * PERSIAN_YEAR_DAYS) +
    (parts.month <= 7 ? (parts.month - 1) * 31 : 186 + (parts.month - 7) * 30) +
    parts.day -
    1
  let cursor = new Date(PERSIAN_EPOCH_MS + estimateDays * DAY_MS)
  const target = rank(parts)

  for (let step = 0; step < 40; step += 1) {
    const current = partsOf(isoOf(cursor), 'persian')
    const currentRank = rank(current)
    if (currentRank === target) break
    // Convert the disagreement into a day count: years and months are worth
    // roughly what they are worth, and the remainder is walked one day at a
    // time. In practice this lands on the second pass.
    const drift =
      (parts.year - current.year) * 365 +
      (parts.month - current.month) * 30 +
      (parts.day - current.day)
    cursor = new Date(cursor.getTime() + (drift === 0 ? (currentRank < target ? 1 : -1) : drift) * DAY_MS)
  }

  return isoOf(cursor)
}

/** The first day of the month `value` falls in, in `system`. */
export function startOfMonth(value: IsoDate, system: CalendarSystem): IsoDate {
  const parts = partsOf(value, system)
  return fromParts({ ...parts, day: 1 }, system)
}

/** `delta` months on from `value`, clamped into the target month's length. */
export function addMonths(value: IsoDate, delta: number, system: CalendarSystem): IsoDate {
  const parts = partsOf(value, system)
  const zero = parts.year * 12 + (parts.month - 1) + delta
  const year = Math.floor(zero / 12)
  const month = (zero % 12) + 1
  const length = monthLength(year, month, system)
  return fromParts({ day: Math.min(parts.day, length), month, year }, system)
}

/**
 * How many days that month holds — measured, not tabulated. The distance to
 * the first of the next month is the length, whatever the leap rule says, so
 * an Esfand of 30 days needs no special case here.
 */
export function monthLength(year: number, month: number, system: CalendarSystem): number {
  const first = dateOf(fromParts({ day: 1, month, year }, system)).getTime()
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  const next = dateOf(fromParts({ day: 1, month: nextMonth, year: nextYear }, system)).getTime()
  return Math.round((next - first) / DAY_MS)
}

export const addDays = (value: IsoDate, days: number): IsoDate =>
  isoOf(new Date(dateOf(value).getTime() + days * DAY_MS))

/** 0 = Sunday. The week's shape is the same fact in every calendar. */
export const weekdayOf = (value: IsoDate): number => dateOf(value).getUTCDay()

/**
 * The locale tag that puts `Intl` into `system`. A `-u-ca-` extension already
 * on the tag wins, so an app asking for `fa-IR-u-ca-gregory` keeps it.
 */
export function localeFor(locale: string | undefined, system: CalendarSystem): string {
  const base = locale ?? 'en'
  if (base.includes('-u-ca-') || base.includes('-u-')) return base
  return `${base}-u-ca-${system}`
}

/**
 * The calendar an `fa` reader expects. Persian interfaces run on the Jalali
 * calendar; everything else this kit ships in runs on the Gregorian one.
 */
export const defaultSystem = (locale: string | undefined): CalendarSystem =>
  locale?.startsWith('fa') ? 'persian' : 'gregory'

/** Persian weeks begin on Saturday; the Gregorian ones here on Monday. */
export const defaultWeekStart = (system: CalendarSystem): number => (system === 'persian' ? 6 : 1)

const DIGIT_CACHE = new Map<string, string[]>()

/** The locale's own ten digits, so `1404` can be written as `۱۴۰۴`. */
function digitsOf(locale: string | undefined): string[] {
  const key = locale ?? 'en'
  const cached = DIGIT_CACHE.get(key)
  if (cached) return cached
  const format = new Intl.NumberFormat(key, { useGrouping: false })
  const digits = Array.from({ length: 10 }, (_, digit) => format.format(digit))
  DIGIT_CACHE.set(key, digits)
  return digits
}

/**
 * `۱۴۰۴/۰۶/۰۱` — year first, zero-padded, in the locale's digits.
 *
 * Deliberately not `Intl`'s numeric pattern, which would give `۰۱/۰۶/۱۴۰۴ ه.ش`
 * under an English locale on the Jalali calendar: field order and an era
 * suffix that no Iranian writes and this module's parser cannot read back. A
 * Jalali date is written biggest-unit-first everywhere it is written at all,
 * so `formatNumeric` and `parseNumeric` agree by construction.
 */
export function formatNumeric(value: IsoDate, locale: string | undefined, system: CalendarSystem): string {
  const parts = partsOf(value, system)
  const digits = digitsOf(locale)
  const write = (number: number, width = 1) =>
    String(number)
      .padStart(width, '0')
      .replace(/\d/g, (digit) => digits[Number(digit)])
  return `${write(parts.year)}/${write(parts.month, 2)}/${write(parts.day, 2)}`
}

/**
 * Reads `1404/06/01`, `۱۴۰۴-۰۶-۰۱`, or anything else with three numbers in
 * year, month, day order. Returns null rather than guessing at two.
 */
export function parseNumeric(input: string, system: CalendarSystem): IsoDate | null {
  const ascii = toAsciiDigits(input)
  const numbers = ascii.match(/\d+/g)
  if (!numbers || numbers.length < 3) return null
  const [year, month, day] = numbers.map(Number)
  if (month < 1 || month > 12 || day < 1) return null
  if (day > monthLength(year, month, system)) return null
  const value = fromParts({ day, month, year }, system)
  // The round trip is the validation: anything ICU disagrees with is rejected
  // rather than silently snapped to a neighbouring day.
  const back = partsOf(value, system)
  return back.year === year && back.month === month && back.day === day ? value : null
}

/**
 * Persian (۰–۹) and Arabic-Indic (٠–٩) digits to ASCII, separators kept — a
 * Persian keyboard types ۱۴۰۴/۰۶/۰۱ and the parser above wants 1404/06/01.
 * `lib/countries.ts` has the digits-only twin, which phone entry needs.
 */
function toAsciiDigits(input: string): string {
  let output = ''
  for (const character of input) {
    const code = character.codePointAt(0) ?? 0
    if (code >= 0x06f0 && code <= 0x06f9) output += String.fromCodePoint(code - 0x06f0 + 0x30)
    else if (code >= 0x0660 && code <= 0x0669) output += String.fromCodePoint(code - 0x0660 + 0x30)
    else output += character
  }
  return output
}
