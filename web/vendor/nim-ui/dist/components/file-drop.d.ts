import { ReactNode } from 'react';
export interface FileDropProps {
    accept?: string;
    className?: string;
    /** Shown under the prompt — "PNG or PDF, up to 10 MB". Formatting a size is
        a locale decision, so the kit takes the sentence already written. */
    caption?: ReactNode;
    disabled?: boolean;
    error?: string;
    label: string;
    multiple?: boolean;
    /** Receives the picked files and nothing else. Uploading, progress and
        retries belong to the product: a component that owned the request would
        have chosen its transport, its auth and its error vocabulary too. */
    onFiles: (files: File[]) => void;
    prompt?: string;
}
/**
 * The dropzone IS a label wrapping a real `<input type="file">`, so clicking,
 * Enter, Space and the platform's own picker all work with no key handlers of
 * our own — and the control is announced as a file input rather than as a
 * mystery box.
 *
 * `dragenter`/`dragleave` fire for every child element the pointer crosses, so
 * the highlight is driven by a DEPTH counter; toggling a boolean is why most
 * dropzones flicker when the cursor passes over their own icon.
 */
export declare function FileDrop({ accept, caption, className, disabled, error, label, multiple, onFiles, prompt, }: FileDropProps): import("react").JSX.Element;
