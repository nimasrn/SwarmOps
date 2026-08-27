import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Cloud,
  Database,
  Globe,
  KeyRound,
  Layers,
  Link2,
  MoreHorizontal,
  Package,
  RefreshCw,
  Server,
  ShieldCheck,
  Tag,
  Terminal,
  Users,
  Bell,
  Bookmark,
  Calendar,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  CircleStop,
  CircleCheck,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  Forward,
  Hash,
  Heart,
  Home,
  Info,
  Loader,
  Lock,
  LogOut,
  Maximize2,
  MessageCircle,
  Menu,
  Mic,
  Minus,
  Moon,
  Paperclip,
  Pause,
  Pencil,
  Pin,
  Play,
  Plus,
  Reply,
  Search,
  Send,
  Settings,
  SmilePlus,
  Share2,
  Sparkles,
  Star,
  Sun,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
  Video,
  User,
  Volume2,
  VolumeX,
  Wallet,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { SVGProps } from 'react'
import { cn } from '@/lib/cn'

/**
 * Icons are addressed by role, not by vendor name. The registry is the whole
 * point: it keeps the icon set finite and reviewable, it stops two screens
 * meaning "delete" with two different glyphs, and it means swapping icon
 * libraries later is one file rather than a codebase sweep.
 */
const REGISTRY = {
  activity: Activity,
  alert: AlertTriangle,
  'arrow-back': ArrowLeft,
  'arrow-forward': ArrowRight,
  chart: BarChart3,
  cloud: Cloud,
  database: Database,
  globe: Globe,
  key: KeyRound,
  layers: Layers,
  link: Link2,
  more: MoreHorizontal,
  package: Package,
  refresh: RefreshCw,
  reply: Reply,
  server: Server,
  shield: ShieldCheck,
  tag: Tag,
  terminal: Terminal,
  users: Users,
  bell: Bell,
  bookmark: Bookmark,
  calendar: Calendar,
  camera: Camera,
  check: Check,
  'check-circle': CircleCheck,
  'chevron-back': ChevronLeft,
  'chevron-down': ChevronDown,
  'chevron-forward': ChevronRight,
  'chevron-up': ChevronUp,
  clock: Clock,
  close: X,
  copy: Copy,
  danger: CircleAlert,
  document: FileText,
  download: Download,
  edit: Pencil,
  external: ExternalLink,
  eye: Eye,
  chat: MessageCircle,
  emoji: SmilePlus,
  expand: Maximize2,
  filter: Filter,
  forward: Forward,
  hash: Hash,
  heart: Heart,
  home: Home,
  info: Info,
  loading: Loader,
  lock: Lock,
  menu: Menu,
  mic: Mic,
  minus: Minus,
  moon: Moon,
  paperclip: Paperclip,
  pause: Pause,
  pin: Pin,
  play: Play,
  plus: Plus,
  search: Search,
  send: Send,
  settings: Settings,
  share: Share2,
  'sign-out': LogOut,
  stop: CircleStop,
  sparkle: Sparkles,
  star: Star,
  sun: Sun,
  trash: Trash2,
  'trend-down': TrendingDown,
  'trend-up': TrendingUp,
  upload: Upload,
  video: Video,
  user: User,
  volume: Volume2,
  'volume-off': VolumeX,
  wallet: Wallet,
} satisfies Record<string, LucideIcon>

/**
 * Icons that point somewhere. These mirror under `dir="rtl"`, because a
 * "forward" arrow in Persian points left; everything else — a plus, a check, a
 * clock — means the same thing in both directions and must NOT be flipped.
 * Getting this wrong per-component is why RTL interfaces end up with mirrored
 * checkmarks, so the decision lives here, once.
 */
const DIRECTIONAL = new Set<string>([
  'arrow-back',
  'arrow-forward',
  'chevron-back',
  'chevron-forward',
  'external',
  'forward',
  'reply',
  'send',
  'share',
  'sign-out',
])

export type IconName = keyof typeof REGISTRY
export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
export type IconTone = 'accent' | 'danger' | 'default' | 'muted' | 'success' | 'warning'

const SIZES: Record<IconSize, number> = { xs: 14, sm: 16, md: 20, lg: 24, xl: 32 }

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'ref'> {
  /** Give a label only when the icon is the sole carrier of meaning. */
  label?: string
  name: IconName
  size?: IconSize
  tone?: IconTone
}

export function Icon({ className, label, name, size = 'md', tone = 'default', ...props }: IconProps) {
  const Glyph = REGISTRY[name]

  return (
    <Glyph
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={cn('nim-icon', className)}
      data-flip={DIRECTIONAL.has(name) ? 'true' : undefined}
      data-tone={tone === 'default' ? undefined : tone}
      focusable="false"
      height={SIZES[size]}
      role={label ? 'img' : undefined}
      strokeWidth={1.75}
      width={SIZES[size]}
      {...props}
    />
  )
}

export const iconNames = Object.keys(REGISTRY) as IconName[]
