import { ReactNode } from 'react';
export interface MapMarker {
    id: string;
    /** Latitude and longitude in degrees. Placement is Web Mercator, the same
        projection every raster tile in use is cut in, so a marker lands where the
        tile underneath it says it should. */
    lat: number;
    lng: number;
    label: string;
    /** Draws the marker as the viewer's own position: a pulsing dot rather than
        a pin, which is the one distinction every map on the platform makes. */
    self?: boolean;
    tone?: 'accent' | 'danger' | 'success';
}
export interface MapBounds {
    east: number;
    north: number;
    south: number;
    west: number;
}
export interface MapViewProps {
    /** Required whenever `tiles` is set. Tile data is licensed; a map that does
        not carry its attribution is a licence breach, not a design choice. */
    attribution?: ReactNode;
    /** The geographic box the tile image covers. Markers are placed inside it. */
    bounds: MapBounds;
    className?: string;
    /** Overlaid on the trailing edge — a layer switch, a recentre button. */
    controls?: ReactNode;
    labels?: Partial<typeof DEFAULT_LABELS>;
    markers?: MapMarker[];
    onSelect?: (marker: MapMarker) => void;
    /** Zoom is the product's: it owns the tile source and therefore the only
        code that can fetch the next zoom level. Unset hides the buttons. */
    onZoom?: (direction: 1 | -1) => void;
    /** The map image itself. The kit ships no tile provider and opens no
        network: pass an `<img>`, a canvas, or a third-party map component and
        this frame draws the chrome around it. */
    tiles?: ReactNode;
    /** Aspect ratio of the frame, width / height. */
    ratio?: number;
    /** Accessible name for the region. */
    title: string;
}
declare const DEFAULT_LABELS: {
    map: string;
    zoomIn: string;
    zoomOut: string;
};
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
export declare function MapView({ attribution, bounds, className, controls, labels, markers, onSelect, onZoom, ratio, tiles, title, }: MapViewProps): import("react").JSX.Element;
export {};
