import { ReactNode } from 'react';
export type StageStatus = 'active' | 'blocked' | 'done' | 'pending';
export interface Stage {
    /** Under the label: what the stage is for, in three or four words. */
    caption?: ReactNode;
    id: string;
    label: ReactNode;
    /** Makes the stage a real button. A stage nobody can return to is a wizard,
        not a track — omit it and the stage renders as static text. */
    onSelect?: () => void;
    status: StageStatus;
}
export interface StageTrackProps {
    className?: string;
    /** Names the ordered list for a screen reader. */
    label?: string;
    stages: Stage[];
}
/**
 * The numbered spine of a long console procedure: connect, select, scan,
 * review, deploy.
 *
 * Deliberately not `TaskProgress`. That component reports a job the server is
 * running and the viewer is waiting on; this one reports where a PERSON is in
 * work they are doing themselves — so the stages sit on one horizontal line
 * they can look back along, each is addressable, and there is no percentage,
 * because five decisions are five decisions and none of them is 20% of an
 * outcome.
 *
 * The connector is drawn by the stage, not between stages: a separate rule
 * would need to know which one is last, and every version of that rule that
 * did not eventually drew a line off the end of the track.
 */
export declare function StageTrack({ className, label, stages }: StageTrackProps): import("react").JSX.Element;
