import { SVGProps } from 'react';
/**
 * The third-party marks a delivery console has to name: the forge a repository
 * came from, the engine a dependency will become, the stack a signal will be
 * reconciled into.
 *
 * These are NOT icons. `Icon` is a closed set addressed by ROLE — "database",
 * "package" — precisely so two screens cannot mean "delete" with two glyphs.
 * A brand mark means one specific product and nothing else, so it lives in its
 * own registry with its own rule: a mark is only ever drawn beside the name it
 * belongs to, never as a decoration and never as the sole identifier of a row.
 *
 * Each is a simplified, single-purpose rendering at UI scale, tinted with the
 * project's own colour so a row of dependencies is scannable by shape AND hue.
 * They are used nominatively — to name the software being deployed — and carry
 * no endorsement claim; a product that needs an exact trademark lockup should
 * ship the vendor's own asset instead.
 */
export type BrandName = 'gitea' | 'github' | 'gitlab' | 'grafana' | 'jaeger' | 'loki' | 'mongodb' | 'postgresql' | 'prometheus' | 'redis' | 'valkey';
export type BrandMarkSize = 'sm' | 'md' | 'lg';
export interface BrandMarkProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
    /** Names the mark for assistive tech when it stands alone. Beside the
        product's own name — which is the only place it should be — leave it
        unset and the mark is hidden, because the name is already the label. */
    label?: string;
    name: BrandName;
    size?: BrandMarkSize;
}
export declare function BrandMark({ className, label, name, size, ...props }: BrandMarkProps): import("react").JSX.Element;
/** The mark for a dependency named the way a Compose file names it. Returns
    `undefined` when nothing in the registry matches, which is the caller's
    signal to fall back to a role icon rather than guess. */
export declare function brandFor(value: string): BrandName | undefined;
