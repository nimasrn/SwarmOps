import { HTMLAttributes, ReactNode } from 'react';
import { IconName } from './icon';
export type PageWidth = 'content' | 'full' | 'wide';
export interface PageProps extends HTMLAttributes<HTMLDivElement> {
    children: ReactNode;
    /** `wide` (default) caps at the console reading limit; `content` is the
        prose column, for settings and docs; `full` bleeds to the workspace. */
    width?: PageWidth;
}
/**
 * The scrolling body of one console screen.
 *
 * It answers two questions that were previously answered per page: how wide a
 * screen is allowed to get, and how far apart two sections sit. Both are here
 * so a console reads as one document rather than as a set of pages that each
 * chose their own rhythm.
 */
export declare function Page({ children, className, width, ...props }: PageProps): import("react").JSX.Element;
export interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
    /** Buttons for this section — not for the record. Record-level actions
        belong in `DetailHeader`, where they are found without scrolling. */
    actions?: ReactNode;
    /** A stage head with nothing to show yet is a legitimate panel: the step
        keeps its place in the column so the procedure does not look shorter
        than it is. */
    children?: ReactNode;
    /** Beside the title, on the same line: the status phrase that qualifies the
        heading — "Scan completed just now", "Review and map services". Distinct
        from `description`, which is a sentence and sits under the title. */
    caption?: ReactNode;
    description?: ReactNode;
    /** Small type above the title: the category, the source, the count. */
    eyebrow?: ReactNode;
    footer?: ReactNode;
    /** A disc before the heading: the stage number of a procedure, or an icon
        for the kind of thing this section holds. It is decorative — the number
        it carries is already in the heading text of the step it names. */
    marker?: ReactNode;
    /** Drop the body padding. A table, a log, or a list draws its own edges and
        an extra 16px inside the panel just moves the rules inward. */
    flush?: boolean;
    title?: ReactNode;
}
/**
 * A titled section of a console page.
 *
 * The heading level is deliberately `h2`: a console page has exactly one `h1`
 * and it is in the topbar or the detail header. Panels that mint their own
 * `h1` are why these screens read as a stack of unrelated documents to a
 * screen reader.
 */
export declare function Panel({ actions, caption, children, className, description, eyebrow, flush, footer, marker, title, ...props }: PanelProps): import("react").JSX.Element;
export interface ToolbarProps extends HTMLAttributes<HTMLDivElement> {
    /** Pushed to the trailing edge. The primary action of the screen lives
        here, in the same place on every screen. */
    actions?: ReactNode;
    children?: ReactNode;
}
/**
 * The strip above a collection: what narrows it on one side, what can be done
 * to it on the other.
 *
 * It wraps rather than scrolls. A toolbar that scrolls horizontally hides the
 * filter an operator has already applied, and a hidden active filter is the
 * single most common reason a console is reported as showing the wrong data.
 */
export declare function Toolbar({ actions, children, className, ...props }: ToolbarProps): import("react").JSX.Element;
/** One status vocabulary for the whole console: the tone on a metric tile,
    the dot in a table row, and the rail on a panel all name the same six
    states, so nothing has to be translated between them. */
export type StatusTone = 'accent' | 'danger' | 'info' | 'neutral' | 'success' | 'warning';
export interface MetricProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onClick'> {
    /** Signed change against the previous period, already formatted. */
    delta?: ReactNode;
    deltaDirection?: 'down' | 'up';
    /** Which direction is good. Errors falling is success; revenue falling is
        not, and a tile that colours every rise green lies on half the screens
        it appears on. */
    deltaIntent?: 'less-is-better' | 'more-is-better';
    hint?: ReactNode;
    icon?: IconName;
    label: ReactNode;
    /** `stacked` (default) is the counter tile: label, then the number at the
        size a row of tiles is compared at. `inline` is the evidence chip — the
        icon beside the figure, the name and its qualifier to the side — for a
        strip that reports what a scan FOUND rather than how a number moved. */
    layout?: 'inline' | 'stacked';
    onClick?: () => void;
    /** The same vocabulary `StatusDot` speaks — one status language across the
        console, so a tile and the dot in the row it links to cannot disagree. */
    tone?: StatusTone;
    value: ReactNode;
}
/**
 * One number, its name, and how it moved.
 *
 * The value is set in the numeric face at a fixed size rather than scaled to
 * fit: a row of tiles is read by comparing the numbers, and a tile that shrank
 * its own value to fit "1,284,003" has broken that comparison.
 */
export declare function Metric({ className, delta, deltaDirection, deltaIntent, hint, icon, label, layout, onClick, tone, value, ...props }: MetricProps): import("react").JSX.Element;
export interface MetricGridProps extends HTMLAttributes<HTMLDivElement> {
    children: ReactNode;
    /** For a row of chip-form tiles (`Metric layout="inline"`). A chip stays
        legible at roughly half the width a counter tile needs, so it holds its
        column count much further down before stepping — without this the
        evidence strip folds to two-up inside any panel that has a rail beside
        it, which is every screen it appears on. */
    dense?: boolean;
    /** The count at full width. It steps down on its own below that — the grid
        is a container query, so a row of tiles inside a narrow panel wraps like
        a row of tiles on a narrow screen. */
    columns?: 2 | 3 | 4 | 5 | 6;
}
export declare function MetricGrid({ children, className, columns, dense, ...props }: MetricGridProps): import("react").JSX.Element;
export interface Fact {
    /** Machine-shaped values — ids, hashes, hosts, durations — set in the mono
        face so they can be compared and copied without being misread. */
    mono?: boolean;
    key?: string;
    label: ReactNode;
    value: ReactNode;
}
export interface FactsProps extends HTMLAttributes<HTMLDListElement> {
    columns?: 1 | 2 | 3;
    items: Fact[];
}
/**
 * The properties of a record, as a real `<dl>`.
 *
 * Two divs and a colon would look the same and carry none of the association
 * that lets a screen reader answer "what is the region of this node?" — which
 * is the entire question this block exists to answer.
 */
export declare function Facts({ className, columns, items, ...props }: FactsProps): import("react").JSX.Element;
export type ColumnsTemplate = 'aside' | 'aside-start' | 'halves' | 'one-third' | 'quarters' | 'thirds' | 'two-fifths' | 'two-thirds';
export interface ColumnsProps extends HTMLAttributes<HTMLDivElement> {
    children: ReactNode;
    /** `aside` is a main column plus a fixed rail; `halves` and `thirds` are
        equal tracks. All of them collapse to one column in a narrow container. */
    template?: ColumnsTemplate;
}
export declare function Columns({ children, className, template, ...props }: ColumnsProps): import("react").JSX.Element;
export interface StatusHeroProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
    description?: ReactNode;
    icon: IconName;
    title: ReactNode;
    tone?: StatusTone;
}
/** A large first-glance health statement for a control-room overview. */
export declare function StatusHero({ className, description, icon, title, tone, ...props }: StatusHeroProps): import("react").JSX.Element;
export interface CodeBlockProps extends Omit<HTMLAttributes<HTMLPreElement>, 'children'> {
    /** The text itself. A string rather than nodes, so it can be copied — a log
        an operator cannot paste into a ticket has failed at its one job. */
    children: string;
    copyLabel?: string;
    copiedLabel?: string;
    /** Above the block: the file, the command, the stream it came from. */
    label?: ReactNode;
    /** Off by default. Log lines are read by their leading columns and wrapping
        destroys that alignment; a stack trace or a payload wants it on. */
    wrap?: boolean;
}
/**
 * Machine output, in a box that scrolls instead of growing.
 *
 * Height is capped at `--nim-scroller-max` because the alternative — a panel
 * that grows to the length of the log — pushes every action on the page below
 * the fold exactly when something has gone wrong.
 */
export declare function CodeBlock({ children, className, copiedLabel, copyLabel, label, wrap, ...props }: CodeBlockProps): import("react").JSX.Element;
export interface StatusDotProps extends HTMLAttributes<HTMLSpanElement> {
    /** Always render the word. Colour alone is not a status: it fails for a
        colour-blind operator and it fails in a screenshot pasted into a ticket. */
    children?: ReactNode;
    /** A slow halo for something in flight — provisioning, draining, deploying. */
    pulse?: boolean;
    tone?: StatusTone;
}
export declare function StatusDot({ children, className, pulse, tone, ...props }: StatusDotProps): import("react").JSX.Element;
export interface MonoProps extends HTMLAttributes<HTMLElement> {
    children: ReactNode;
    /** Set it smaller than the text around it. A hash inline in a sentence at
        the same size as the sentence swamps it; in a table cell of its own it
        should stay at the row's size. */
    size?: 'inherit' | 'sm';
}
/**
 * Machine text inline: an id, a host, a digest, a duration, a version.
 *
 * Tabular figures and `anywhere` breaking, because the two things anyone does
 * with one of these is compare it against another and paste it somewhere else,
 * and a proportional face defeats the first while `nowrap` defeats the second
 * by pushing the value out of its cell.
 */
export declare function Mono({ children, className, size, ...props }: MonoProps): import("react").JSX.Element;
export interface RecordLinkProps {
    className?: string;
    href?: string;
    /** The machine identity under the human one: id, host, sku, digest. */
    meta?: ReactNode;
    onClick?: () => void;
    title: ReactNode;
}
/**
 * The identity cell of a table row: what the record is called, and the id it
 * is called by everywhere else.
 *
 * Both consumers had written this cell by hand, and both had written it as a
 * `<div onClick>`. It is a real button or a real link here, so the row can be
 * reached with a keyboard and opened in a new tab.
 */
export declare function RecordLink({ className, href, meta, onClick, title }: RecordLinkProps): import("react").JSX.Element;
export interface RailProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
    /** One control beside the title — save, edit, reset. */
    actions?: ReactNode;
    children: ReactNode;
    /** The commitment: the button this whole rail exists to justify, plus
        whatever explains why it is disabled. */
    footer?: ReactNode;
    title: ReactNode;
}
/**
 * The standing summary of what a long screen is about to do.
 *
 * A procedure spread over five sections is read from the top, but it is
 * COMMITTED to from one place, and that place has to say what the commitment
 * covers without the operator scrolling back through the decisions that
 * produced it. So the rail sticks: the plan, its warnings, and the button stay
 * on screen while the sections beside it are worked through.
 *
 * It is not a `Panel`. A panel is a section OF the page and scrolls with it;
 * this is a fixture beside the page, and giving `Panel` a `sticky` flag would
 * have let any section of any console page claim the same privilege.
 */
export declare function Rail({ actions, children, className, footer, title, ...props }: RailProps): import("react").JSX.Element;
export interface RailSectionProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
    children: ReactNode;
    /** The count, on the trailing edge: "2 services", "3 stacks". */
    meta?: ReactNode;
    /** Colours the heading only. A rail's warnings and blockers are told apart
        by their heading, not by tinting the whole block — a rail whose every
        group carries a background is a rail with no emphasis left to spend. */
    tone?: StatusTone;
    title?: ReactNode;
}
export declare function RailSection({ children, className, meta, title, tone, ...props }: RailSectionProps): import("react").JSX.Element;
export interface CopyChipProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
    /** The text itself, and what is copied. A digest, an id, a host. */
    children: string;
    copiedLabel?: string;
    copyLabel?: string;
}
/**
 * One machine value, set in the mono face, with the copy affordance beside it.
 *
 * `CodeBlock` already does this for a block of output; a digest in a summary
 * row is a single token, and putting a scrolling `<pre>` around it to get a
 * copy button is why these values end up being retyped by hand instead.
 */
export declare function CopyChip({ children, className, copiedLabel, copyLabel, ...props }: CopyChipProps): import("react").JSX.Element;
export interface DetailLayoutProps extends HTMLAttributes<HTMLDivElement> {
    /** The rail: status, ownership, timestamps, related records. */
    aside?: ReactNode;
    children: ReactNode;
}
/**
 * A record page: the body, and the rail of facts beside it.
 *
 * The rail comes after the body in source order and is placed beside it by the
 * grid, so a narrow container and a screen reader both get the record before
 * its metadata.
 */
export declare function DetailLayout({ aside, children, className, ...props }: DetailLayoutProps): import("react").JSX.Element;
