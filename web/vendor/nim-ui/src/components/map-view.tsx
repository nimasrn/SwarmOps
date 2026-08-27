import { useId } from 'react'
import type { ReactNode } from 'react'
import { Icon } from '@/components/icon'
import { IconButton } from '@/components/icon-button'
import { cn } from '@/lib/cn'

export interface MapMarker {
  id: string
  /** Latitude and longitude in degrees. Placement is Web Mercator, the same
      projection every raster tile in use is cut in, so a marker lands where the
      tile underneath it says it should. */
  lat: number
  lng: number
  label: string
  /** Draws the marker as the viewer's own position: a pulsing dot rather than
      a pin, which is the one distinction every map on the platform makes. */
  self?: boolean
  tone?: 'accent' | 'danger' | 'success'
}

export interface MapBounds {
  east: number
  north: number
  south: number
  west: number
}

export interface MapViewProps {
  /** Required whenever `tiles` is set. Tile data is licensed; a map that does
      not carry its attribution is a licence breach, not a design choice. */
  attribution?: ReactNode
  /** The geographic box the tile image covers. Markers are placed inside it. */
  bounds: MapBounds
  className?: string
  /** Overlaid on the trailing edge — a layer switch, a recentre button. */
  controls?: ReactNode
  labels?: Partial<typeof DEFAULT_LABELS>
  markers?: MapMarker[]
  onSelect?: (marker: MapMarker) => void
  /** Zoom is the product's: it owns the tile source and therefore the only
      code that can fetch the next zoom level. Unset hides the buttons. */
  onZoom?: (direction: 1 | -1) => void
  /** The map image itself. The kit ships no tile provider and opens no
      network: pass an `<img>`, a canvas, or a third-party map component and
      this frame draws the chrome around it. */
  tiles?: ReactNode
  /** Aspect ratio of the frame, width / height. */
  ratio?: number
  /** Accessible name for the region. */
  title: string
}

const DEFAULT_LABELS = {
  map: 'Map',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
}

/** Web Mercator y, normalised 0–1 from the north pole. */
const mercator = (lat: number): number => {
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, lat))
  const radians = (clamped * Math.PI) / 180
  return 0.5 - Math.log(Math.tan(Math.PI / 4 + radians / 2)) / (2 * Math.PI)
}

const project = (marker: MapMarker, bounds: MapBounds) => {
  const west = bounds.west
  const east = bounds.east < bounds.west ? bounds.east + 360 : bounds.east
  const lng = marker.lng < west ? marker.lng + 360 : marker.lng
  const top = mercator(bounds.north)
  const bottom = mercator(bounds.south)
  return {
    x: ((lng - west) / (east - west)) * 100,
    y: ((mercator(marker.lat) - top) / (bottom - top)) * 100,
  }
}

/**
 * A map frame: tiles the product supplies, markers the kit places.
 *
 * The kit does not fetch tiles, hold an API key, or bundle a mapping SDK — all
 * three are decisions about a vendor, a bill and a privacy policy, and none of
 * them belong to a component library. What it does own is the part that is
 * always rebuilt badly: the frame, the pins, the selection state, the zoom
 * affordance and the attribution slot that a licence requires.
 *
 * Markers are placed by projecting latitude and longitude through Web Mercator
 * against the declared bounds. Percentages, not pixels, so the frame can be any
 * size — and `inset-inline-start` for x, so nothing has to be re-thought under
 * RTL.
 */
export function MapView({
  attribution,
  bounds,
  className,
  controls,
  labels,
  markers = [],
  onSelect,
  onZoom,
  ratio = 16 / 10,
  tiles,
  title,
}: MapViewProps) {
  const text = { ...DEFAULT_LABELS, ...labels }
  const titleId = useId()

  return (
    <section
      aria-labelledby={titleId}
      className={cn('nim-map', className)}
      style={{ aspectRatio: `${ratio}` }}
    >
      <h3 className="nim-visually-hidden" id={titleId}>
        {title}
      </h3>

      <div className="nim-map__tiles">{tiles}</div>

      {/* A list, not a scatter of divs: the markers are the map's content, and
          a reader who cannot see the tiles still gets the places on it. */}
      <ul className="nim-map__markers">
        {markers.map((marker) => {
          const point = project(marker, bounds)
          const style = { insetBlockStart: `${point.y}%`, insetInlineStart: `${point.x}%` }
          return (
            <li className="nim-map__marker" data-self={marker.self ? 'true' : undefined} key={marker.id} style={style}>
              {onSelect ? (
                <button className="nim-map__pin" data-tone={marker.tone} onClick={() => onSelect(marker)} type="button">
                  {marker.self ? <span className="nim-map__dot" /> : <Icon name="globe" size="sm" />}
                  <span className="nim-visually-hidden">{marker.label}</span>
                </button>
              ) : (
                <span className="nim-map__pin" data-tone={marker.tone}>
                  {marker.self ? <span className="nim-map__dot" /> : <Icon name="globe" size="sm" />}
                  <span className="nim-visually-hidden">{marker.label}</span>
                </span>
              )}
            </li>
          )
        })}
      </ul>

      {onZoom || controls ? (
        <div className="nim-map__controls">
          {controls}
          {onZoom ? (
            <>
              <IconButton label={text.zoomIn} name="plus" onClick={() => onZoom(1)} size="sm" variant="solid" />
              <IconButton label={text.zoomOut} name="minus" onClick={() => onZoom(-1)} size="sm" variant="solid" />
            </>
          ) : null}
        </div>
      ) : null}

      {attribution ? <p className="nim-map__attribution">{attribution}</p> : null}
    </section>
  )
}
