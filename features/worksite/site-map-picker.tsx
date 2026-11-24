"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import { Icon } from "@/components/ui/icon";

export type SitePosition = { latitude: number; longitude: number };

const mapStyle = process.env.NEXT_PUBLIC_WORKSITE_MAP_STYLE_URL || "https://tiles.openfreemap.org/styles/liberty";
const searchEndpoint = process.env.NEXT_PUBLIC_WORKSITE_GEOCODER_URL || "https://photon.komoot.io/api";
const defaultCenter: [number, number] = [36.8219, -1.2921];
const zoomForRadius = (radius: number) => Math.max(10, Math.min(18, 17 - Math.log2(radius / 75)));

type Place = { name: string; longitude: number; latitude: number };

function boundary(center: SitePosition, metres: number) {
  const earthRadius = 6371008.8;
  const lat = center.latitude * Math.PI / 180;
  const lon = center.longitude * Math.PI / 180;
  const distance = metres / earthRadius;
  const points: number[][] = [];
  for (let step = 0; step <= 96; step += 1) {
    const bearing = step / 96 * Math.PI * 2;
    const nextLat = Math.asin(Math.sin(lat) * Math.cos(distance) + Math.cos(lat) * Math.sin(distance) * Math.cos(bearing));
    const nextLon = lon + Math.atan2(Math.sin(bearing) * Math.sin(distance) * Math.cos(lat), Math.cos(distance) - Math.sin(lat) * Math.sin(nextLat));
    points.push([nextLon * 180 / Math.PI, nextLat * 180 / Math.PI]);
  }
  return { type: "Feature" as const, properties: {}, geometry: { type: "Polygon" as const, coordinates: [points] } };
}

export function SiteMapPicker({ position, radius, onPositionChange, locating, onLocate }: {
  position: SitePosition | null;
  radius: number;
  onPositionChange: (position: SitePosition) => void;
  locating: boolean;
  onLocate: () => void;
}) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const previousRadius = useRef(radius);
  const selectedSearch = useRef("");
  const positionRef = useRef(position);
  const radiusRef = useRef(radius);
  const changeRef = useRef(onPositionChange);
  const [mapError, setMapError] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [search, setSearch] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  useEffect(() => {
    positionRef.current = position;
    radiusRef.current = radius;
    changeRef.current = onPositionChange;
  }, [position, radius, onPositionChange]);

  useEffect(() => {
    let disposed = false;
    let observer: ResizeObserver | undefined;
    let currentMap: MapLibreMap | undefined;
    import("maplibre-gl").then(({ Map, Marker, NavigationControl, setWorkerUrl }) => {
      if (disposed || !mapContainer.current) return;
      setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).toString());
      currentMap = new Map({
        container: mapContainer.current,
        style: mapStyle,
        center: positionRef.current ? [positionRef.current.longitude, positionRef.current.latitude] : defaultCenter,
        zoom: positionRef.current ? zoomForRadius(radiusRef.current) : 11,
      });
      map.current = currentMap;
      currentMap.addControl(new NavigationControl({ showCompass: false }), "bottom-right");
      currentMap.on("error", (event) => {
        if (event.error) setMapError(true);
      });
      currentMap.on("load", () => {
        if (!currentMap) return;
        setMapReady(true);
        currentMap.addSource("site-boundary", {
          type: "geojson",
          data: positionRef.current ? boundary(positionRef.current, radiusRef.current) : { type: "FeatureCollection", features: [] },
        });
        currentMap.addLayer({ id: "site-boundary-fill", type: "fill", source: "site-boundary", paint: { "fill-color": "#087d79", "fill-opacity": 0.24 } });
        currentMap.addLayer({ id: "site-boundary-line", type: "line", source: "site-boundary", paint: { "line-color": "#087d79", "line-width": 2.5, "line-opacity": 0.82 } });
        if (positionRef.current && !marker.current) {
          const pin = document.createElement("div");
          pin.className = "worksite-map-pin";
          pin.setAttribute("aria-label", "Facility centre");
          marker.current = new Marker({ element: pin, draggable: true })
            .setLngLat([positionRef.current.longitude, positionRef.current.latitude])
            .addTo(currentMap);
          marker.current.on("dragend", () => {
            const selected = marker.current?.getLngLat();
            if (selected) changeRef.current({ latitude: selected.lat, longitude: selected.lng });
          });
        }
      });
      currentMap.on("click", (event) => changeRef.current({ latitude: event.lngLat.lat, longitude: event.lngLat.lng }));
      observer = new ResizeObserver(() => currentMap?.resize());
      observer.observe(mapContainer.current);
      window.setTimeout(() => currentMap?.resize(), 100);
    }).catch(() => setMapError(true));
    return () => {
      disposed = true;
      observer?.disconnect();
      marker.current?.remove();
      marker.current = null;
      currentMap?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const currentMap = map.current;
    if (!currentMap || !position) return;
    const source = currentMap.getSource("site-boundary") as import("maplibre-gl").GeoJSONSource | undefined;
    source?.setData(boundary(position, radius));
    const center = currentMap.getCenter();
    if (Math.abs(center.lat - position.latitude) > 0.002 || Math.abs(center.lng - position.longitude) > 0.002 || previousRadius.current !== radius) {
      currentMap.easeTo({ center: [position.longitude, position.latitude], zoom: zoomForRadius(radius), duration: 300, essential: true });
    }
    previousRadius.current = radius;
    if (!marker.current && currentMap.isStyleLoaded()) {
      import("maplibre-gl").then(({ Marker }) => {
        if (map.current !== currentMap || marker.current) return;
        const pin = document.createElement("div");
        pin.className = "worksite-map-pin";
        pin.setAttribute("aria-label", "Drag facility centre");
        marker.current = new Marker({ element: pin, draggable: true }).setLngLat([position.longitude, position.latitude]).addTo(currentMap);
        marker.current.on("dragend", () => {
          const selected = marker.current?.getLngLat();
          if (selected) changeRef.current({ latitude: selected.lat, longitude: selected.lng });
        });
      });
    } else marker.current?.setLngLat([position.longitude, position.latitude]);
  }, [position, radius]);

  useEffect(() => {
    const query = search.trim();
    if (query.length < 3 || selectedSearch.current === query) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const url = new URL(searchEndpoint);
        url.searchParams.set("q", query);
        url.searchParams.set("limit", "3");
        const response = await fetch(url, { headers: { Accept: "application/json" }, signal: controller.signal });
        if (!response.ok) throw new Error("Search unavailable");
        const data: { features?: Array<{ geometry?: { coordinates?: number[] }; properties?: Record<string, unknown> }> } = await response.json();
        const found = (data.features ?? []).flatMap((feature) => {
          const [longitude, latitude] = feature.geometry?.coordinates ?? [];
          if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return [];
          const props = feature.properties ?? {};
          const name = [props.name, props.city, props.state, props.country].filter((part) => typeof part === "string" && part.length).join(", ");
          return [{ name: name || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`, longitude, latitude }];
        });
        setPlaces(found.slice(0, 3));
        setActiveIndex(-1);
        if (!found.length) setSearchError("No places found. Try another name or choose a point on the map.");
      } catch {
        if (!controller.signal.aborted) setSearchError("Place search is unavailable. Choose a point on the map.");
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 450);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [search]);

  const selectPlace = (place: Place) => {
    onPositionChange({ latitude: place.latitude, longitude: place.longitude });
    map.current?.flyTo({ center: [place.longitude, place.latitude], zoom: 15, essential: true });
    setPlaces([]);
    setActiveIndex(-1);
    setSearchError("");
    selectedSearch.current = place.name;
    setSearch(place.name);
  };

  return <section className="worksite-map-picker" aria-label="Choose facility centre on a map">
    <div className="worksite-map-toolbar">
      <div role="search" className="worksite-map-search">
        <label className="sr-only" htmlFor="worksite-place-search">Search for a place</label>
        <input id="worksite-place-search" type="search" role="combobox" aria-expanded={places.length > 0} aria-controls="worksite-place-results" aria-autocomplete="list" aria-activedescendant={activeIndex >= 0 ? `worksite-place-${activeIndex}` : undefined} value={search} onChange={(event) => { selectedSearch.current = ""; setSearch(event.target.value); setPlaces([]); setActiveIndex(-1); setSearchError(""); setSearching(false); }} onKeyDown={(event) => {
          if (!places.length) return;
          if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((index) => (index + 1) % places.length); }
          if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => (index - 1 + places.length) % places.length); }
          if (event.key === "Enter" && activeIndex >= 0) { event.preventDefault(); selectPlace(places[activeIndex]); }
          if (event.key === "Escape") { setPlaces([]); setActiveIndex(-1); }
        }} placeholder="Search hospital, street or place" />
        <Icon name="search" size={17} outline />
      </div>
      <button type="button" className="worksite-locate-button" onClick={onLocate} disabled={locating}>
        <Icon name="location" size={17} /> {locating ? "Locating…" : "My location"}
      </button>
    </div>
    {places.length > 0 && <div id="worksite-place-results" className="worksite-map-results" role="listbox" aria-label="Place suggestions">
      {places.map((place, index) => <button type="button" role="option" aria-selected={activeIndex === index} id={`worksite-place-${index}`} key={`${place.latitude}-${place.longitude}-${index}`} onClick={() => selectPlace(place)}><Icon name="location" size={16} />{place.name}</button>)}
    </div>}
    {searching && <p className="worksite-search-status" role="status">Searching…</p>}
    {searchError && <p className="worksite-search-error" role="alert">{searchError}</p>}
    <div ref={mapContainer} className="worksite-map-canvas" aria-label="Interactive map. Click to choose the facility centre." />
    {!mapReady && !mapError && <p className="worksite-map-loading" role="status">Loading map…</p>}
    {mapError && <p className="worksite-map-error" role="status">Map tiles could not load. Place search and current location may still be available.</p>}
    <div className="worksite-map-bottom">
      <p>{position ? "Drag the pin or click another point to move the centre." : "Click the map to place the facility centre."}</p>
      <button type="button" disabled={!mapReady} onClick={() => {
        const centre = map.current?.getCenter();
        if (centre) onPositionChange({ latitude: centre.lat, longitude: centre.lng });
      }}>Use map centre</button>
    </div>
    <p className="worksite-map-credit">Map © OpenStreetMap contributors · OpenFreeMap · Search by Photon</p>
  </section>;
}
