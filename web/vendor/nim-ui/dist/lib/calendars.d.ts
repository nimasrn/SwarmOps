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
export type IsoDate = string;
/** The calendar a grid is drawn in — never what a value is stored in. */
export type CalendarSystem = 'gregory' | 'persian';
export interface CalendarParts {
    day: number;
    month: number;
    year: number;
}
export declare const isoOf: (date: Date) => IsoDate;
export declare const dateOf: (value: IsoDate) => Date;
export declare const todayIso: () => IsoDate;
/** The calendar fields a viewer of `system` would read off this instant. */
export declare function partsOf(value: IsoDate, system: CalendarSystem): CalendarParts;
/**
 * The Gregorian date on which `parts` falls in `system`.
 *
 * For Jalali this starts from the mean-year estimate and walks to the answer,
 * comparing against `partsOf` — which is ICU. The estimate is never more than
 * a few days out, and the loop is bounded, so a bad input fails by returning
 * its best effort rather than by spinning.
 */
export declare function fromParts(parts: CalendarParts, system: CalendarSystem): IsoDate;
/** The first day of the month `value` falls in, in `system`. */
export declare function startOfMonth(value: IsoDate, system: CalendarSystem): IsoDate;
/** `delta` months on from `value`, clamped into the target month's length. */
export declare function addMonths(value: IsoDate, delta: number, system: CalendarSystem): IsoDate;
/**
 * How many days that month holds — measured, not tabulated. The distance to
 * the first of the next month is the length, whatever the leap rule says, so
 * an Esfand of 30 days needs no special case here.
 */
export declare function monthLength(year: number, month: number, system: CalendarSystem): number;
export declare const addDays: (value: IsoDate, days: number) => IsoDate;
/** 0 = Sunday. The week's shape is the same fact in every calendar. */
export declare const weekdayOf: (value: IsoDate) => number;
/**
 * The locale tag that puts `Intl` into `system`. A `-u-ca-` extension already
 * on the tag wins, so an app asking for `fa-IR-u-ca-gregory` keeps it.
 */
export declare function localeFor(locale: string | undefined, system: CalendarSystem): string;
/**
 * The calendar an `fa` reader expects. Persian interfaces run on the Jalali
 * calendar; everything else this kit ships in runs on the Gregorian one.
 */
export declare const defaultSystem: (locale: string | undefined) => CalendarSystem;
/** Persian weeks begin on Saturday; the Gregorian ones here on Monday. */
export declare const defaultWeekStart: (system: CalendarSystem) => number;
/**
 * `۱۴۰۴/۰۶/۰۱` — year first, zero-padded, in the locale's digits.
 *
 * Deliberately not `Intl`'s numeric pattern, which would give `۰۱/۰۶/۱۴۰۴ ه.ش`
 * under an English locale on the Jalali calendar: field order and an era
 * suffix that no Iranian writes and this module's parser cannot read back. A
 * Jalali date is written biggest-unit-first everywhere it is written at all,
 * so `formatNumeric` and `parseNumeric` agree by construction.
 */
export declare function formatNumeric(value: IsoDate, locale: string | undefined, system: CalendarSystem): string;
/**
 * Reads `1404/06/01`, `۱۴۰۴-۰۶-۰۱`, or anything else with three numbers in
 * year, month, day order. Returns null rather than guessing at two.
 */
export declare function parseNumeric(input: string, system: CalendarSystem): IsoDate | null;
