import { CalendarSystem, IsoDate } from '../lib/calendars';
export type { CalendarSystem, IsoDate } from '../lib/calendars';
export interface CalendarProps {
    className?: string;
    /** Days to flag — a due date, a booking, anything the month should mark. */
    marked?: IsoDate[];
    max?: IsoDate;
    min?: IsoDate;
    month: IsoDate;
    onMonthChange: (month: IsoDate) => void;
    onSelect: (date: IsoDate) => void;
    /** The calendar the grid is drawn in. Defaults to Jalali for an `fa` locale
        and Gregorian everywhere else. The value stays an ISO Gregorian date in
        both — the calendar is what the viewer reads, not what the API gets. */
    system?: CalendarSystem;
    value?: IsoDate | null;
    /** 1 = Monday. Defaults to Saturday on the Jalali calendar, Monday on the
        Gregorian one — the week does not start on the same day everywhere. */
    weekStart?: number;
}
export declare function Calendar({ className, marked, max, min, month, onMonthChange, onSelect, system, value, weekStart, }: CalendarProps): import("react").JSX.Element;
interface DateEntryProps extends Omit<CalendarProps, 'month' | 'onMonthChange' | 'onSelect' | 'value'> {
    error?: string;
    hint?: string;
    id?: string;
    label?: string;
    onChange: (value: IsoDate) => void;
    required?: boolean;
    value: IsoDate;
}
export type DateFieldProps = DateEntryProps;
/**
 * A text field with a calendar under it, in that order of importance: typing a
 * date always works, which matters more to more people than the grid does.
 *
 * Both halves answer the same calendar system, so a Persian interface types
 * ۱۴۰۴/۰۶/۰۱ into a Jalali grid — and still hands the caller `2025-08-23`.
 */
export declare function DateField({ error, hint, id, label, onChange, required, value, ...calendarProps }: DateFieldProps): import("react").JSX.Element;
export interface DatePickerProps extends DateEntryProps {
    /** Accessible names for the two controls the picker adds. */
    labels?: {
        clear: string;
        open: string;
    };
    /** The same date on the other calendar, under the field. On by default for
        Jalali, where a viewer often has to reconcile a Gregorian document. */
    showEquivalent?: boolean;
}
/**
 * The compact form of date entry: one field, with the grid behind a button.
 *
 * Use it in a form, where a permanently open month steals the space three
 * other fields need; `DateField` is for the screen whose subject is the date.
 * On the Jalali calendar it prints the Gregorian equivalent under the field —
 * the reconciliation an Iranian office does by hand all day.
 */
export declare function DatePicker({ error, hint, id, label, labels: names, onChange, required, showEquivalent, value, ...calendarProps }: DatePickerProps): import("react").JSX.Element;
