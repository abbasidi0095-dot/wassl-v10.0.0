"use client";

import { useEffect, useRef, useState } from "react";
import {
  Map as MapLibreMap,
  Marker,
  Popup,
  NavigationControl,
  AttributionControl,
  LngLatBounds,
  type MapOptions,
  type GeoJSONSource,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export type MapPoint = {
  id: string;
  lat: number;
  lng: number;
  kind: "store" | "driver" | "customer" | "pickup" | "dropoff";
  label: string;
};

/**
 * Line glyphs drawn inside the map pins. Inline SVG keeps pins crisp without
 * shipping emoji (or three extra image assets) to every map instance.
 */
const PIN_GLYPH: Record<MapPoint["kind"], string> = {
  store:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9.5 4.6 4h14.8L21 9.5"/><path d="M4.5 9.5V20h15V9.5"/><path d="M9.5 20v-5.5h5V20"/></svg>',
  driver:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 4h-3l-2.2 6.3"/><path d="M9 17.5h5l3-8h2"/></svg>',
  customer:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10.2c0 5.8-8 11.8-8 11.8s-8-6-8-11.8a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.6"/></svg>',
  pickup:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>',
  dropoff:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10.2c0 5.8-8 11.8-8 11.8s-8-6-8-11.8a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.6"/></svg>',
};

type Props = {
  points: MapPoint[];
  center?: { lat: number; lng: number };
  zoom?: number;
  height?: number;
  route?: [number, number][];
  followDriverId?: string;
  interactive?: boolean;
  onPick?: (lat: number, lng: number) => void;
  className?: string;
};

const OSM_STYLE: MapOptions["style"] = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: [
        "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

export function MapView({
  points,
  center,
  zoom = 13,
  height = 320,
  route,
  followDriverId,
  interactive = true,
  onPick,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const pickRef = useRef(onPick);
  const [unavailable, setUnavailable] = useState(false);
  pickRef.current = onPick;

  const initial = center || {
    lat: points[0]?.lat ?? 23.6848,
    lng: points[0]?.lng ?? -15.958,
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container: containerRef.current,
        style: OSM_STYLE,
        center: [initial.lng, initial.lat],
        zoom,
        attributionControl: false,
        interactive,
      });
    } catch (error) {
      // Headless browsers and older GPUs may not expose WebGL2. Keep the rest
      // of the page usable instead of letting MapLibre throw through React.
      console.warn("[map] WebGL unavailable", error);
      setUnavailable(true);
      return;
    }
    map.on("error", (event) => {
      const message = String(event?.error?.message || "");
      if (message.toLowerCase().includes("webgl")) {
        console.warn("[map] WebGL unavailable", event.error);
        setUnavailable(true);
        try {
          map.remove();
        } catch {
          // already disposed
        }
        mapRef.current = null;
      }
    });
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    map.addControl(
      new AttributionControl({ compact: true }),
      "bottom-right",
    );
    map.on("click", (event) => {
      pickRef.current?.(event.lngLat.lat, event.lngLat.lng);
    });
    mapRef.current = map;
    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      try {
        map.remove();
      } catch {
        // already disposed
      }
      mapRef.current = null;
    };
    // The map is intentionally initialized once; updates are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = points.map((point) => {
      const element = document.createElement("div");
      element.className =
        point.kind === "driver"
          ? "driver-pin"
          : point.kind === "store"
            ? "store-pin"
            : "customer-pin";
      element.title = point.label;
      const inner = document.createElement("span");
      inner.innerHTML = PIN_GLYPH[point.kind];
      element.appendChild(inner);
      return new Marker({ element, anchor: "center" })
        .setLngLat([point.lng, point.lat])
        .setPopup(
          new Popup({ offset: 20, closeButton: false }).setHTML(
            `<div style="font-family:Manrope,system-ui;font-size:12px;font-weight:700;color:#14211f">${escapeHtml(point.label)}</div>`,
          ),
        )
        .addTo(map);
    });

    const driver = points.find((point) => point.id === followDriverId);
    if (driver) {
      map.easeTo({ center: [driver.lng, driver.lat], zoom: Math.max(map.getZoom(), 14), duration: 700 });
    } else if (points.length > 1) {
      const bounds = new LngLatBounds();
      points.forEach((point) => bounds.extend([point.lng, point.lat]));
      map.fitBounds(bounds, { padding: 56, maxZoom: 15, duration: 700 });
    } else if (points.length === 1) {
      map.easeTo({ center: [points[0].lng, points[0].lat], zoom, duration: 500 });
    }
  }, [points, followDriverId, zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const coordinates = route && route.length > 1 ? route : [];
    const sourceId = "wassl-route";
    const add = () => {
      if (!map.isStyleLoaded()) return;
      const data = {
        type: "Feature" as const,
        properties: {},
        geometry: {
          type: "LineString" as const,
          coordinates,
        },
      };
      const existing = map.getSource(sourceId) as GeoJSONSource | undefined;
      if (existing) {
        existing.setData(data);
        return;
      }
      map.addSource(sourceId, { type: "geojson", data });
      map.addLayer({
        id: `${sourceId}-line`,
        type: "line",
        source: sourceId,
        paint: {
          "line-color": "#0f6e6e",
          "line-width": 4,
          "line-opacity": 0.72,
          "line-dasharray": [1.2, 1.4],
        },
      });
    };
    if (map.isStyleLoaded()) add();
    else map.once("load", add);
    return () => {
      try {
        if (map.getLayer(`${sourceId}-line`)) map.removeLayer(`${sourceId}-line`);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      } catch {
        // map may be disposed during navigation
      }
    };
  }, [route]);

  if (unavailable) {
    return (
      <div
        className={`map-shell grid place-items-center bg-ink/5 ${className || ""}`}
        style={{ height }}
        role="img"
        aria-label="Map unavailable in this browser"
      >
        <p className="max-w-xs px-4 text-center text-[11px] font-bold leading-5 text-ink/45">
          Map preview is unavailable because this browser does not support
          WebGL2. Ordering and delivery details still work.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`map-shell ${className || ""}`}
      style={{ height }}
      aria-label="Map"
    />
  );
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
