import { ReactNode } from 'react';
export type ChartKind = 'area' | 'bar' | 'line';
export interface ChartSeries {
    /** Series colour, 1–6, taken from the colourway's qualitative ramp. Left
        unset it follows the series' position, which is what makes a chart of a
        set of charts agree with itself. */
    series?: 1 | 2 | 3 | 4 | 5 | 6;
    label: string;
    /** One value per category, in the same order as `categories`. A gap is
        `null` — a line breaks across it rather than pretending zero. */
    values: (number | null)[];
}
export interface ChartProps {
    /** The x axis. One label per point; the kit never invents them from an
        index, because "5" is not a date and a chart that says so is lying. */
    categories: string[];
    className?: string;
    /** Force the value axis to start somewhere. A bar chart is pinned to zero
        whatever this says — a truncated bar misstates the ratio it draws. */
    min?: number;
    max?: number;
    /** Rendered under the plot. Omitted for a single unlabelled series. */
    legend?: boolean;
    kind?: ChartKind;
    /** Formats a value for the axis, the tooltip and the table. Defaults to the
        locale's own number format. */
    format?: (value: number) => string;
    locale?: string;
    series: ChartSeries[];
    /** Named for the reader; also the accessible name of the figure. */
    title?: string;
    /** Extra note under the title — units, a period, a caveat. */
    note?: ReactNode;
    /** Object or cohort this series describes, below its title. */
    description?: ReactNode;
    /** Already-formatted latest reading; computation belongs to the caller. */
    value?: ReactNode;
    /** Provenance, units and period rendered below the plot. */
    footer?: ReactNode;
    /** Drawing height in px. The width is always the container's. */
    height?: number;
    /** Thin only the visible axis; every category remains in the tooltip/table. */
    maxXLabels?: number;
    /** Short visual ticks without shortening tooltip or table labels. */
    formatCategory?: (category: string, index: number) => string;
    /** Opt into a visible, expandable data table. Otherwise it stays screen-reader-only. */
    dataTableLabel?: string;
    hideDataTableLabel?: string;
    noSampleLabel?: string;
}
/**
 * A chart drawn from the token contract: no plotting library, no canvas, no
 * runtime dependency. Line, area and bar over the same shared scale.
 *
 * The picture is `aria-hidden` and the DATA is exposed as a real table in the
 * same figure, visually hidden. That is the only arrangement that works for
 * everyone: a screen reader gets numbers it can navigate rather than a summary
 * sentence, and nobody has to decide how much of a trend to put in an alt
 * string. It is also what makes the chart printable and copy-pasteable.
 *
 * Colour is assigned by series POSITION from the colourway's ramp, never by
 * meaning — a chart that paints a series red because it is falling has taken a
 * judgement that belongs to the product.
 */
export declare function Chart({ categories, className, dataTableLabel, hideDataTableLabel, noSampleLabel, description, footer, format, formatCategory, height, kind, legend, locale, max, maxXLabels, min, note, series, title, value, }: ChartProps): import("react").JSX.Element;
export interface SparklineProps {
    className?: string;
    /** Accessible name. A sparkline with no name is decoration and should be
        `aria-hidden` by its caller instead. */
    label: string;
    series?: ChartSeries['series'];
    values: number[];
}
/**
 * A trend at type size: no axis, no grid, no labels. It goes beside a number,
 * never instead of one — the shape says "rising", the figure says how much.
 */
export declare function Sparkline({ className, label, series, values }: SparklineProps): import("react").JSX.Element;
