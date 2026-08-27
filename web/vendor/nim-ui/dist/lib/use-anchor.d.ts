import { RefObject } from 'react';
export interface AnchorPosition {
    left: number;
    top: number;
}
export interface UseAnchorOptions {
    /** Called when the viewer asks to dismiss: Escape, or a click outside. */
    onDismiss: () => void;
    open: boolean;
}
/**
 * Anchored overlay placement, shared by Menu and Popover.
 *
 * Deliberately small: nim does not ship a floating-element engine. It places
 * the panel under the trigger, flips it above when the space below cannot hold
 * it, and clamps it inside the viewport. Anything needing collision detection
 * against scroll containers wants a real positioning library, not this.
 *
 * It also owns the two dismissals every overlay must honour and hand-rolled
 * ones always forget: Escape, and a pointer landing outside both elements.
 */
export declare function useAnchor<T extends HTMLElement, P extends HTMLElement>(triggerRef: RefObject<T | null>, panelRef: RefObject<P | null>, { onDismiss, open }: UseAnchorOptions): AnchorPosition;
