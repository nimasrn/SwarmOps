import { ReactNode } from 'react';
import { IconName } from './icon';
export interface AssistantStep {
    /** What the assistant did before answering — searched, ran, read. Shown
        collapsed: it is evidence for the answer, not the answer. */
    detail?: ReactNode;
    icon?: IconName;
    label: string;
    status?: 'done' | 'failed' | 'running';
}
export interface AssistantTurn {
    /** Rendered as-is. The kit does not parse markdown: what an assistant's
        output is allowed to contain — which tags, which links, which code
        highlighter — is a security decision, and a component library is the
        wrong place to make it. */
    content: ReactNode;
    id: string;
    role: 'assistant' | 'user';
    /** Still arriving. Draws the caret and suppresses the actions, which cannot
        be honestly offered for an answer that is not finished. */
    streaming?: boolean;
    /** Named sources under the answer. */
    sources?: {
        href: string;
        title: string;
    }[];
    steps?: AssistantStep[];
}
export interface AssistantThreadProps {
    className?: string;
    /** The composer, pinned under the transcript. */
    composer?: ReactNode;
    /** Shown when there are no turns yet — the suggestions a blank thread needs
        to stop being a blank page. */
    empty?: ReactNode;
    labels?: Partial<typeof DEFAULT_LABELS>;
    /** Copy, retry, rate. Returning nothing for a turn hides the row. */
    onCopy?: (turn: AssistantTurn) => void;
    onRetry?: (turn: AssistantTurn) => void;
    onRate?: (turn: AssistantTurn, rating: 'down' | 'up') => void;
    /** Stopping a streaming answer. The button only exists while one is. */
    onStop?: () => void;
    turns: AssistantTurn[];
    /** The assistant's name and mark, shown against its turns. */
    assistant?: {
        icon?: IconName;
        name: string;
    };
}
declare const DEFAULT_LABELS: {
    assistant: string;
    copy: string;
    down: string;
    retry: string;
    sources: string;
    steps: string;
    stop: string;
    up: string;
    you: string;
};
/**
 * An assistant transcript: turns down the page, not bubbles across it.
 *
 * The shape is deliberate and different from `Chat`. A conversation between
 * people is short lines alternating quickly, which is what bubbles are for; an
 * answer from a model is a document — paragraphs, lists, code, tables — and a
 * document does not go in a bubble. So the assistant's turn is full measure on
 * the canvas with a mark beside it, and only the viewer's own turn keeps a
 * surface, because that is the one that has to be told apart from the answer.
 *
 * `content` is rendered as given. The kit does not parse markdown or sanitise
 * HTML: what a model's output may contain is a decision with a threat model
 * behind it, and it belongs to the product, once, rather than to a component
 * that would be making it silently for everyone.
 *
 * The transcript follows a streaming answer only while the reader is already
 * at the foot of it — the same rule as `Chat`, and for the same reason.
 */
export declare function AssistantThread({ assistant, className, composer, empty, labels, onCopy, onRate, onRetry, onStop, turns, }: AssistantThreadProps): import("react").JSX.Element;
export {};
