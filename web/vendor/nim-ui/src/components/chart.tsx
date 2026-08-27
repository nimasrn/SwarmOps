import { useId, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type ChartKind = 'area' | 'bar' | 'line'

export interface ChartSeries {
  /** Series colour, 1–6, taken from the colourway's qualitative ramp. Left
      unset it follows the series' position, which is what makes a chart of a
      set of charts agree with itself. */
  series?: 1 | 2 | 3 | 4 | 5 | 6
  label: string
  /** One value per category, in the same order as `categories`. A gap is
      `null` — a line breaks across it rather than pretending zero. */
  values: (number | null)[]
}

export interface ChartProps {
  /** The x axis. One label per point; the kit never invents them from an
      index, because "5" is not a date and a chart that says so is lying. */
  categories: string[]
  className?: string
  /** Force the value axis to start somewhere. A bar chart is pinned to zero
      whatever this says — a truncated bar misstates the ratio it draws. */
  min?: number
  max?: number
  /** Rendered under the plot. Omitted for a single unlabelled series. */
  legend?: boolean
  kind?: ChartKind
  /** Formats a value for the axis, the tooltip and the table. Defaults to the
      locale's own number format. */
  format?: (value: number) => string
  locale?: string
  series: ChartSeries[]
  /** Named for the reader; also the accessible name of the figure. */
  title?: string
  /** Extra note under the title — units, a period, a caveat. */
  note?: ReactNode
  /** Drawing height in px. The width is always the container's. */
  height?: number
}

/** The plot is drawn in a fixed user space and scaled by the SVG's viewBox, so
    the geometry below is arithmetic rather than layout. */
const VIEW_W = 600
const PAD_S = 8

const niceStep = (span: number, target: number): number => {
  const raw = span / Math.max(1, target)
  const power = 10 ** Math.floor(Math.log10(raw || 1))
  const scaled = raw / power
  const step = scaled > 5 ? 10 : scaled > 2 ? 5 : scaled > 1 ? 2 : 1
  return step * power
}

/**
 * A chart drawn from the token contract: no plotting library, no canvas, no
 * runtime dependency. Line, area and bar over the same shared scale.
 *
 * The picture is `aria-hidden` and the DATA is exposed as a real table in the
 * same figure, visually hidden. That is the only arrangement that works for
 * everyone: a screen reader gets numbers it can navigate rather than a summary
 * sentence, and nobody has to decide how much of a trend to put in an alt
 * string. It is also what makes the chart printable and copy-pasteable.
 *
 * Colour is assigned by series POSITION from the colourway's ramp, never by
 * meaning — a chart that paints a series red because it is falling has taken a
 * judgement that belongs to the product.
 */
export function Chart({
  categories,
  className,
  format,
  height = 220,
  kind = 'line',
  legend,
  locale,
  max,
  min,
  note,
  series,
  title,
}: ChartProps) {
  const titleId = useId()
  const [hover, setHover] = useState<number | null>(null)

  const number = useMemo(
    () => format ?? ((value: number) => new Intl.NumberFormat(locale).format(value)),
    [format, locale],
  )

  const scale = useMemo(() => {
    const all = series.flatMap((line) => line.values).filter((value): value is number => value !== null)
    const rawLow = min ?? Math.min(...all, 0)
    const rawHigh = max ?? Math.max(...all, 0)
    // A bar states a ratio by its length, so its baseline is zero whatever the
    // caller asked for; a line states a change, and may be zoomed.
    const low = kind === 'bar' ? Math.min(0, rawLow) : rawLow
    const high = rawHigh === low ? low + 1 : rawHigh
    const step = niceStep(high - low, 4)
    const bottom = Math.floor(low / step) * step
    const top = Math.ceil(high / step) * step
    const ticks: number[] = []
    for (let value = bottom; value <= top + step / 2; value += step) ticks.push(Number(value.toFixed(6)))
    return { bottom, ticks, top }
  }, [kind, max, min, series])

  const plotH = height - PAD_S * 2
  const y = (value: number) =>
    PAD_S + plotH - ((value - scale.bottom) / (scale.top - scale.bottom)) * plotH
  // Points sit at the centre of their slot: a bar needs a slot to stand in,
  // and a line whose first point is on the frame reads as clipped.
  const slot = VIEW_W / Math.max(1, categories.length)
  const x = (index: number) => slot * index + slot / 2

  const path = (values: (number | null)[], close: boolean) => {
    let d = ''
    let open = false
    values.forEach((value, index) => {
      if (value === null) {
        open = false
        return
      }
      d += `${open ? 'L' : 'M'}${x(index).toFixed(2)} ${y(value).toFixed(2)}`
      open = true
    })
    if (!close || !d) return d
    const drawn = values
      .map((value, index) => (value === null ? null : index))
      .filter((index): index is number => index !== null)
    const first = drawn[0]
    const last = drawn[drawn.length - 1]
    return `${d}L${x(last).toFixed(2)} ${y(scale.bottom).toFixed(2)}L${x(first).toFixed(2)} ${y(scale.bottom).toFixed(2)}Z`
  }

  const barWidth = (slot * 0.62) / series.length

  return (
    <figure
      aria-labelledby={title ? titleId : undefined}
      className={cn('nim-chart', className)}
      data-kind={kind}
    >
      {title || note ? (
        <figcaption className="nim-chart__head">
          {title ? (
            <span className="nim-chart__title" id={titleId}>
              {title}
            </span>
          ) : null}
          {note ? <span className="nim-chart__note">{note}</span> : null}
        </figcaption>
      ) : null}

      <div className="nim-chart__frame">
        <div aria-hidden="true" className="nim-chart__axis">
          {[...scale.ticks].reverse().map((tick) => (
            <span className="nim-chart__tick" key={tick}>
              {number(tick)}
            </span>
          ))}
        </div>

        <div className="nim-chart__plot">
          <svg
            aria-hidden="true"
            className="nim-chart__svg"
            preserveAspectRatio="none"
            style={{ blockSize: `${height}px` }}
            viewBox={`0 0 ${VIEW_W} ${height}`}
          >
            {scale.ticks.map((tick) => (
              <line
                className="nim-chart__rule"
                key={tick}
                x1={0}
                x2={VIEW_W}
                y1={y(tick)}
                y2={y(tick)}
              />
            ))}

            {series.map((line, lineIndex) => {
              const tone = `var(--nim-series-${line.series ?? ((lineIndex % 6) + 1)})`
              if (kind === 'bar') {
                return (
                  <g key={line.label}>
                    {line.values.map((value, index) =>
                      value === null ? null : (
                        <rect
                          className="nim-chart__bar"
                          fill={tone}
                          height={Math.abs(y(value) - y(Math.max(scale.bottom, 0)))}
                          key={index}
                          width={barWidth}
                          x={x(index) - (barWidth * series.length) / 2 + barWidth * lineIndex}
                          y={Math.min(y(value), y(Math.max(scale.bottom, 0)))}
                        />
                      ),
                    )}
                  </g>
                )
              }
              return (
                <g key={line.label}>
                  {kind === 'area' ? (
                    <path className="nim-chart__area" d={path(line.values, true)} fill={tone} />
                  ) : null}
                  <path className="nim-chart__line" d={path(line.values, false)} stroke={tone} />
                  {line.values.map((value, index) =>
                    value === null ? null : (
                      <circle
                        className="nim-chart__dot"
                        cx={x(index)}
                        cy={y(value)}
                        data-on={hover === index ? 'true' : undefined}
                        fill={tone}
                        key={index}
                        r={4}
                      />
                    ),
                  )}
                </g>
              )
            })}
          </svg>

          {/* One hit area per category rather than per point: the reader is
              pointing at a moment in time, not at a mark, and every series'
              value for that moment is what they want back. */}
          <div className="nim-chart__hits">
            {categories.map((category, index) => (
              <button
                className="nim-chart__hit"
                data-on={hover === index ? 'true' : undefined}
                // Categories repeat — two Tuesdays in a week, two regions with
                // one name — so the slot's position is its identity, not its
                // label.
                key={index}
                onBlur={() => setHover(null)}
                onFocus={() => setHover(index)}
                onMouseEnter={() => setHover(index)}
                onMouseLeave={() => setHover(null)}
                type="button"
              >
                <span className="nim-visually-hidden">{category}</span>
              </button>
            ))}
            {hover !== null ? (
              <div
                className="nim-chart__tip"
                style={{ insetInlineStart: `${((hover + 0.5) / categories.length) * 100}%` }}
              >
                <span className="nim-chart__tip-label">{categories[hover]}</span>
                {series.map((line, lineIndex) => (
                  <span className="nim-chart__tip-row" key={line.label}>
                    <i style={{ background: `var(--nim-series-${line.series ?? ((lineIndex % 6) + 1)})` }} />
                    <span className="nim-chart__tip-name">{line.label}</span>
                    <span className="nim-chart__tip-value">
                      {line.values[hover] === null ? '—' : number(line.values[hover] as number)}
                    </span>
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div aria-hidden="true" className="nim-chart__categories">
            {categories.map((category, index) => (
              <span className="nim-chart__category" key={index}>
                {category}
              </span>
            ))}
          </div>
        </div>
      </div>

      {(legend ?? series.length > 1) ? (
        <ul aria-hidden="true" className="nim-chart__legend">
          {series.map((line, lineIndex) => (
            <li className="nim-chart__key" key={line.label}>
              <i style={{ background: `var(--nim-series-${line.series ?? ((lineIndex % 6) + 1)})` }} />
              {line.label}
            </li>
          ))}
        </ul>
      ) : null}

      {/* The numbers themselves, for anyone the picture does not reach. */}
      <table className="nim-visually-hidden">
        {title ? <caption>{title}</caption> : null}
        <thead>
          <tr>
            <th scope="col" />
            {series.map((line) => (
              <th key={line.label} scope="col">
                {line.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {categories.map((category, index) => (
            <tr key={index}>
              <th scope="row">{category}</th>
              {series.map((line) => (
                <td key={line.label}>
                  {line.values[index] === null ? '—' : number(line.values[index] as number)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

export interface SparklineProps {
  className?: string
  /** Accessible name. A sparkline with no name is decoration and should be
      `aria-hidden` by its caller instead. */
  label: string
  series?: ChartSeries['series']
  values: number[]
}

/**
 * A trend at type size: no axis, no grid, no labels. It goes beside a number,
 * never instead of one — the shape says "rising", the figure says how much.
 */
export function Sparkline({ className, label, series = 1, values }: SparklineProps) {
  const low = Math.min(...values)
  const high = Math.max(...values)
  const span = high - low || 1
  const d = values
    .map((value, index) => {
      const px = (index / Math.max(1, values.length - 1)) * 100
      const py = 24 - ((value - low) / span) * 20 - 2
      return `${index === 0 ? 'M' : 'L'}${px.toFixed(2)} ${py.toFixed(2)}`
    })
    .join('')

  return (
    <svg
      className={cn('nim-sparkline', className)}
      preserveAspectRatio="none"
      role="img"
      viewBox="0 0 100 24"
    >
      <title>{label}</title>
      <path d={d} stroke={`var(--nim-series-${series})`} />
    </svg>
  )
}
