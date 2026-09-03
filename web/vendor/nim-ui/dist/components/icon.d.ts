import { SVGProps } from 'react';
/**
 * Icons are addressed by role, not by vendor name. The registry is the whole
 * point: it keeps the icon set finite and reviewable, it stops two screens
 * meaning "delete" with two different glyphs, and it means swapping icon
 * libraries later is one file rather than a codebase sweep.
 */
declare const REGISTRY: {
    activity: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    alert: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    'arrow-back': import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    'arrow-forward': import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    chart: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    cloud: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    database: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    globe: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    key: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    layers: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    inspector: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    link: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    more: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    package: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    refresh: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    reply: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    server: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    shield: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    tag: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    terminal: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    users: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    bell: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    bookmark: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    calendar: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    camera: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    check: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    'check-circle': import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    'chevron-back': import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    'chevron-down': import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    'chevron-forward': import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    'chevron-up': import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    clock: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    close: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    copy: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    danger: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    document: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    download: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    edit: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    external: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    eye: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    chat: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    emoji: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    expand: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    filter: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    forward: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    hash: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    heart: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    home: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    info: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    loading: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    lock: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    menu: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    mic: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    minus: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    moon: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    paperclip: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    pause: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    pin: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    play: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    plus: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    search: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    send: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    settings: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    share: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    'sign-out': import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    stop: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    sparkle: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    star: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    sun: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    trash: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    'trend-down': import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    'trend-up': import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    upload: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    video: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    user: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    volume: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    'volume-off': import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
    wallet: import('react').ForwardRefExoticComponent<Omit<import('lucide-react').LucideProps, "ref"> & import('react').RefAttributes<SVGSVGElement>>;
};
export type IconName = keyof typeof REGISTRY;
export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type IconTone = 'accent' | 'danger' | 'default' | 'muted' | 'success' | 'warning';
export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'ref'> {
    /** Give a label only when the icon is the sole carrier of meaning. */
    label?: string;
    name: IconName;
    size?: IconSize;
    tone?: IconTone;
}
export declare function Icon({ className, label, name, size, tone, ...props }: IconProps): import("react").JSX.Element;
export declare const iconNames: IconName[];
export {};
