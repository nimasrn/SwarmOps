/**
 * nim — public surface.
 *
 * Importing the kit brings its stylesheet with it, so a consumer can never end
 * up with nim markup and no nim styles. Apps that need to control CSS order
 * themselves can import `nim/styles.css` explicitly instead.
 *
 * Wrap the tree in <NimProvider> to pick a style, colourway, scheme, and
 * direction.
 */

import '@/theme/index.css'

export { ActivityFeed, AdminShell, DetailHeader, FilterChips } from '@/components/admin-shell'
export type {
  ActivityEvent,
  ActivityFeedProps,
  AdminNavGroup,
  AdminNavItem,
  AdminShellProps,
  DetailHeaderProps,
  FilterChip,
  FilterChipsProps,
} from '@/components/admin-shell'

export {
  CodeBlock,
  Columns,
  CopyChip,
  DetailLayout,
  Facts,
  Metric,
  MetricGrid,
  Mono,
  Page,
  Panel,
  Rail,
  RailSection,
  RecordLink,
  StatusDot,
  Toolbar,
} from '@/components/console'
export type {
  CodeBlockProps,
  ColumnsProps,
  ColumnsTemplate,
  CopyChipProps,
  DetailLayoutProps,
  Fact,
  FactsProps,
  MetricGridProps,
  MetricProps,
  MonoProps,
  PageProps,
  PageWidth,
  PanelProps,
  RailProps,
  RailSectionProps,
  RecordLinkProps,
  StatusDotProps,
  StatusTone,
  ToolbarProps,
} from '@/components/console'

export { Brand } from '@/components/brand'
export type { BrandProps, BrandSize } from '@/components/brand'

export { BrandMark, brandFor } from '@/components/brand-mark'
export type { BrandMarkProps, BrandMarkSize, BrandName } from '@/components/brand-mark'

export { DataTable } from '@/components/data-table'
export type { DataTableProps, DataTableSelection } from '@/components/data-table'

export { Accordion } from '@/components/accordion'
export type { AccordionItem, AccordionProps } from '@/components/accordion'

export { AppShell } from '@/components/app-shell'
export type { AppShellProps } from '@/components/app-shell'

export { AuthScreen } from '@/components/auth-screen'
export type { AuthScreenProps } from '@/components/auth-screen'

export { Avatar } from '@/components/avatar'
export type { AvatarProps, AvatarSize } from '@/components/avatar'

export { AvatarRing, ProfileHeader } from '@/components/profile-header'
export type { AvatarRingProps, ProfileHeaderProps } from '@/components/profile-header'

export { Badge } from '@/components/badge'
export type { BadgeProps, BadgeSize, BadgeTone, BadgeVariant } from '@/components/badge'

export { Banner } from '@/components/banner'
export type { BannerProps, BannerTone } from '@/components/banner'

export { Breadcrumb } from '@/components/breadcrumb'
export type { BreadcrumbProps, Crumb } from '@/components/breadcrumb'

export { Button } from '@/components/button'
export type { ButtonProps, ButtonSize, ButtonVariant } from '@/components/button'

export { Card } from '@/components/card'
export type { CardPadding, CardProps, CardVariant } from '@/components/card'

export { ActionBar, OptionCard, OrderSummary } from '@/components/checkout'
export type {
  ActionBarProps,
  OptionCardProps,
  OrderSummaryProps,
  SummaryLine,
} from '@/components/checkout'

export { Chat } from '@/components/chat'
export type {
  ChatAttachment,
  ChatMediaKind,
  ChatMessage,
  ChatProps,
  ChatQuote,
  ChatReaction,
} from '@/components/chat'

export { AssistantThread } from '@/components/assistant'
export type { AssistantStep, AssistantThreadProps, AssistantTurn } from '@/components/assistant'

export { Chart, Sparkline } from '@/components/chart'
export type { ChartKind, ChartProps, ChartSeries, SparklineProps } from '@/components/chart'

export { ConversationList, Messenger, RoomHeader } from '@/components/messenger'
export type {
  Conversation,
  ConversationKind,
  ConversationListProps,
  ConversationSection,
  MessengerProps,
  RoomHeaderProps,
} from '@/components/messenger'

export { MapView } from '@/components/map-view'
export type { MapBounds, MapMarker, MapViewProps } from '@/components/map-view'

export { MediaPlayer } from '@/components/player'
export type { MediaPlayerProps } from '@/components/player'

export { ChatComposer } from '@/components/chat-composer'
export type { ChatComposerProps, ChatDraft } from '@/components/chat-composer'

export { Checkbox, Radio, RadioGroup, Switch } from '@/components/choice'
export type {
  CheckboxProps,
  RadioGroupProps,
  RadioProps,
  SwitchProps,
} from '@/components/choice'

export { Chip, ChipInput } from '@/components/chip'
export type { ChipInputProps, ChipProps, ChipTone } from '@/components/chip'

export { DataList } from '@/components/data-list'
export type { DataListProps, DataListRow } from '@/components/data-list'

export { Combobox } from '@/components/combobox'
export type { ComboboxOption, ComboboxProps } from '@/components/combobox'

export { Calendar, DateField, DatePicker } from '@/components/date-field'
export type {
  CalendarProps,
  CalendarSystem,
  DateFieldProps,
  DatePickerProps,
  IsoDate,
} from '@/components/date-field'

export {
  addDays,
  addMonths,
  formatNumeric,
  monthLength,
  parseNumeric,
  partsOf,
  fromParts,
  startOfMonth,
  todayIso,
} from '@/lib/calendars'
export type { CalendarParts } from '@/lib/calendars'

export { Dialog } from '@/components/dialog'
export type { DialogProps } from '@/components/dialog'

export { EmptyState } from '@/components/empty-state'
export type { EmptyStateProps } from '@/components/empty-state'

export { Progress, Skeleton, Spinner } from '@/components/feedback'
export type { ProgressProps, SkeletonProps, SpinnerProps } from '@/components/feedback'

export { ResourceMeter } from '@/components/resource-meter'
export type { ResourceMeterProps, ResourceMeterTone } from '@/components/resource-meter'

export { Field, Input, Select, Textarea } from '@/components/field'
export type { FieldProps, InputProps, SelectOption, SelectProps, TextareaProps } from '@/components/field'

export { FileDrop } from '@/components/file-drop'
export type { FileDropProps } from '@/components/file-drop'

export { Icon, iconNames } from '@/components/icon'
export type { IconName, IconProps, IconSize, IconTone } from '@/components/icon'

export { IconButton } from '@/components/icon-button'
export type { IconButtonProps, IconButtonSize, IconButtonVariant } from '@/components/icon-button'

export { AppFrame, Inline, Stack } from '@/components/layout'

export { List, ListRow } from '@/components/list'
export type { ListProps, ListRowProps } from '@/components/list'

export { Menu, Popover } from '@/components/menu'
export type { MenuAction, MenuHeading, MenuItem, MenuProps, MenuSeparator, PopoverProps } from '@/components/menu'

export { Onboarding } from '@/components/onboarding'
export type { OnboardingProps, OnboardingSlide } from '@/components/onboarding'

export { OtpInput } from '@/components/otp-input'
export type { OtpInputProps } from '@/components/otp-input'

export { Pagination } from '@/components/pagination'
export type { PaginationProps } from '@/components/pagination'

export { PasswordField, scorePassword } from '@/components/password-field'
export type { PasswordFieldProps, PasswordStrength } from '@/components/password-field'

export { PhoneField, toE164 } from '@/components/phone-field'
export type { PhoneFieldProps } from '@/components/phone-field'

export { PlanCard } from '@/components/plan-card'
export type { PlanCardProps, PlanFeature } from '@/components/plan-card'

export { PlanPicker } from '@/components/plan-picker'
export type { BillingCycle, PlanOffer, PlanPickerProps } from '@/components/plan-picker'

export { ProfileScreen } from '@/components/profile-screen'
export type { ProfileRow, ProfileScreenProps, ProfileSection } from '@/components/profile-screen'

export { Rating } from '@/components/rating'
export type { RatingProps } from '@/components/rating'

export { SectionHeader } from '@/components/section-header'
export type { SectionHeaderProps } from '@/components/section-header'

export { Segmented } from '@/components/segmented'
export type { SegmentedOption, SegmentedProps } from '@/components/segmented'

export { SignInFlow } from '@/components/sign-in-flow'
export type { SignInCopy, SignInFlowProps, SignInMethod } from '@/components/sign-in-flow'

export { Sheet } from '@/components/sheet'
export type { SheetProps } from '@/components/sheet'

export { Slider } from '@/components/slider'
export type { SliderProps } from '@/components/slider'

export { Stat } from '@/components/stat'
export type { StatProps } from '@/components/stat'

export { StageTrack } from '@/components/stage-track'
export type { Stage, StageStatus, StageTrackProps } from '@/components/stage-track'

export { Stepper } from '@/components/stepper'
export type { StepperProps } from '@/components/stepper'

export { TaskProgress } from '@/components/task-progress'
export type { TaskProgressProps, TaskStep, TaskStepStatus } from '@/components/task-progress'

export { Timeline } from '@/components/timeline'
export type { TimelineEntry, TimelineProps, TimelineTone } from '@/components/timeline'

export { Table } from '@/components/table'
export type { SortDirection, TableColumn, TableProps } from '@/components/table'

export { TabBar } from '@/components/tab-bar'
export type { TabBarItem, TabBarProps } from '@/components/tab-bar'

export { Tabs } from '@/components/tabs'
export type { TabOption, TabsProps } from '@/components/tabs'

export { NimProvider, useNim, useSchemeToggle } from '@/components/theme'
export type {
  NimColorway,
  NimDirection,
  NimProviderProps,
  NimScheme,
  NimStyle,
} from '@/components/theme'

export { ToastProvider, useToast } from '@/components/toast'
export type { ToastOptions, ToastTone } from '@/components/toast'

export { Tooltip } from '@/components/tooltip'
export type { TooltipProps } from '@/components/tooltip'

export { ChoiceGrid, Wizard } from '@/components/wizard'
export type {
  ChoiceGridOption,
  ChoiceGridProps,
  WizardProps,
  WizardStep,
} from '@/components/wizard'

export { Body, Caption, Display, Label, Rule, Title } from '@/components/typography'
export type { TextTone } from '@/components/typography'

export {
  COUNTRIES,
  countryByDial,
  countryByIso2,
  countryNamer,
  toAsciiDigits,
} from '@/lib/countries'
export type { Country } from '@/lib/countries'

export { cn } from '@/lib/cn'
export type { ClassValue } from '@/lib/cn'
