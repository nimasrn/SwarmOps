/**
 * The kit's only class-name helper. nim components compose a small, fixed set
 * of semantic class names, so a full `clsx`-style dependency would buy nothing
 * that this does not already do.
 */
export type ClassValue = string | false | null | undefined

export const cn = (...values: ClassValue[]) => values.filter(Boolean).join(' ')
