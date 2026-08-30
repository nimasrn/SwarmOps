import { Brand as KitBrand } from '@nim.zone/ui'
import type { BrandSize as KitBrandSize } from '@nim.zone/ui'

/* SwarmOps · the mark.

   THE IDEA — "Quorum". A Swarm's control plane is not one machine, it is the
   three managers that have to agree before anything happens. The mark is those
   three: hive cells packed the way a honeycomb packs, in the tonal ladder of a
   comb lit from one side. It is the product's subject rather than a monogram —
   a letter in a box says nothing about the software and has to be explained
   everywhere it appears.

   WHY THREE CELLS AND NOT A CLUSTER OF DOTS — the first cut was a manager ring
   with six workers around it, and at every size below the sign-in screen it
   read as a daisy: six petals and a centre is a flower before it is a swarm.
   Three hexagons cannot be read as anything but cells, they carry the quorum
   meaning exactly, and three shapes is few enough that the mark needs no
   simplified variant — the sign-in screen and a 16px favicon draw the same
   geometry.

   WHY MALACHITE — the approved control-plane canvas uses one accent language
   from brand through navigation and primary actions. Health never relies on
   that colour alone: every state still carries a word, so the mark can share
   the malachite accent without becoming an ambiguous status indicator. */

export interface SwarmOpsMarkProps {
  /** Rendered size in px. The geometry is a 32-unit box scaled to this. */
  size?: number
  /** Give the mark an accessible name only where it stands alone. Beside the
      wordmark it is decorative, because the name is right there. */
  title?: string
}

const MARK_COLOR = 'var(--nim-accent)'

const CELL = 7.2
const GAP = 0.9
const WIDTH = Math.sqrt(3) * CELL

/* Pointy-top hexagons: neighbours in a row sit one width apart, the next row
   drops by three quarters of the height. The whole comb is then nudged up so
   the shape's optical centre — not its bounding box — sits in the middle of
   the 32-unit box. */
const RISE = 1.5
const ROW_ONE = 11.4 - RISE
const ROW_TWO = ROW_ONE + CELL * 1.5 + GAP

const CELLS = [
  { x: 16 - WIDTH / 2 - GAP / 2, y: ROW_ONE },
  { x: 16 + WIDTH / 2 + GAP / 2, y: ROW_ONE },
  { x: 16, y: ROW_TWO },
]

/* The corners are rounded by stroking the polygon in its own fill with a round
   join, rather than by hand-writing an arc at each vertex: the radius is then
   one number, and the shape stays a hexagon that can be re-tuned in a line. */
const JOIN = 1.8

function points(cx: number, cy: number) {
  return [0, 1, 2, 3, 4, 5]
    .map((step) => {
      const angle = ((-90 + step * 60) * Math.PI) / 180
      const radius = CELL - JOIN / 2
      return `${(cx + Math.cos(angle) * radius).toFixed(2)},${(cy + Math.sin(angle) * radius).toFixed(2)}`
    })
    .join(' ')
}

export function SwarmOpsMark({ size = 32, title }: SwarmOpsMarkProps) {
  return (
    <svg
      aria-hidden={title ? undefined : true}
      height={size}
      role={title ? 'img' : undefined}
      viewBox="0 0 32 32"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      {title ? <title>{title}</title> : null}
      {CELLS.map((cell) => (
        <polygon
          fill="none"
          key={`${cell.x}-${cell.y}`}
          points={points(cell.x, cell.y)}
          stroke={MARK_COLOR}
          strokeLinejoin="round"
          strokeWidth={JOIN}
        />
      ))}
    </svg>
  )
}

export interface BrandProps {
  /** The line under the wordmark. Dropped where the name alone identifies the
      product — a topbar, a collapsed rail. */
  subtitle?: string
  size?: KitBrandSize
}

/* THE WORDMARK — "Swarm" in ink, "Ops" in the malachite accent. The name states
   what the product is about twice over: the swarm is the subject, and the
   operator's half of it is the half this software actually is. Tying the
   second run to the mark's own colour is also what stops the lockup reading as
   an icon that happens to sit beside a heading.

   The type, the tracking and the lockup itself are the kit's `Brand`; what
   belongs to this product is the mark, the two words, and the one custom
   property that colours the second — which is set in `styles.css`, the only
   place this app is allowed an identity. */
export function Brand({ size = 'md', subtitle = 'Remote Docker Swarm operations' }: BrandProps) {
  return (
    <KitBrand
      mark={<SwarmOpsMark size={size === 'lg' ? 38 : 30} title="SwarmOps" />}
      name="Swarm"
      nameAccent="Ops"
      size={size}
      tagline={subtitle}
    />
  )
}
