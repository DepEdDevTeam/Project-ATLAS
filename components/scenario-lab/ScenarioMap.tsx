"use client";

import { useEffect, useRef, useState } from "react";
import { MapPinned } from "lucide-react";
import type { RegionSignal } from "@/lib/enrollment-types";
import "mapbox-gl/dist/mapbox-gl.css";

const SOURCE_ID = "planning-regions";
const FILL_ID = "planning-regions-fill";
const SHADING_END_ZOOM = 7;
const BASEMAP_STYLE = "mapbox://styles/mapbox/standard";
// 2023 PSGC-aligned low-resolution boundaries: faeldon/philippines-json-maps (MIT).
const BOUNDARIES_URL = "/philippine-regions-2023.geojson";

const status = (value: number | null) => value === null ? "No prior comparison" : value < -1 ? "Lower enrollment" : value <= 1 ? "Within ±1%" : "Higher enrollment";

const color = (signal: string) => ({
  "Lower enrollment": "#3978df",
  "Within ±1%": "#2b8a68",
  "Higher enrollment": "#d87d3c",
}[signal] || "#8490a8");

function signalFor(name: string, signals: RegionSignal[]) {
  const region = signals.find(item => item.name === name);
  if (!region) return "No data / boundary mismatch";
  if ((region.year >= 2024 && ["Western Visayas","Central Visayas"].includes(name)) || (region.year >= 2025 && ["BARMM","Zamboanga Peninsula"].includes(name)) || (region.year < 2019 && name === "BARMM")) return "Boundary mismatch";
  return status(region.growth);
}

function fillExpression(signals: RegionSignal[]): import("mapbox-gl").Expression {
  if (!signals.length) return ["literal", "#8490a8"] as import("mapbox-gl").Expression;
  return ["match", ["get", "name"], ...signals.flatMap(region => [region.name, color(signalFor(region.name, signals))]), "#8490a8"] as import("mapbox-gl").Expression;
}

export default function ScenarioMap({ signals }: { signals: RegionSignal[] }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<import("mapbox-gl").Map | null>(null);
  const latestOutcomes = useRef(signals);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

  latestOutcomes.current = signals;

  useEffect(() => {
    if (!token || !container.current) return;
    let disposed = false;
    let instance: import("mapbox-gl").Map | undefined;

    import("mapbox-gl").then(({ default: mapboxgl }) => {
      if (disposed || !container.current) return;
      mapboxgl.accessToken = token;
      instance = new mapboxgl.Map({
        container: container.current,
        style: BASEMAP_STYLE,
        config: {
          basemap: {
            lightPreset: document.documentElement.dataset.theme === "dark" ? "night" : "day",
            show3dObjects: true,
          },
        },
        center: [122.55, 11.9],
        zoom: 4.45,
        pitch: 48,
        bearing: -7,
        attributionControl: true,
      });
      map.current = instance;
      instance.addControl(new mapboxgl.NavigationControl({ showCompass: true, visualizePitch: true }), "top-right");

      const popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 10 });
      const addRegionLayers = () => {
        if (!instance || instance.getSource(SOURCE_ID)) return;
        instance.addSource(SOURCE_ID, { type: "geojson", data: BOUNDARIES_URL });
        instance.addLayer({
          id: FILL_ID,
          type: "fill",
          source: SOURCE_ID,
          slot: "middle",
          paint: {
            "fill-color": fillExpression(latestOutcomes.current),
            "fill-opacity": ["interpolate", ["linear"], ["zoom"], 5.75, .82, SHADING_END_ZOOM, 0],
          },
        });
      };

      instance.on("style.load", addRegionLayers);
      instance.on("load", () => setReady(true));
      instance.on("error", () => setFailed(true));
      instance.on("mousemove", event => {
        if (!instance?.getLayer(FILL_ID) || instance.getZoom() >= SHADING_END_ZOOM) {
          popup.remove();
          if (instance) instance.getCanvas().style.cursor = "";
          return;
        }
        const feature = instance.queryRenderedFeatures(event.point, { layers: [FILL_ID] })[0];
        const name = feature?.properties?.name as string | undefined;
        instance.getCanvas().style.cursor = name ? "pointer" : "";
        if (name) popup.setLngLat(event.lngLat).setText(`${name} · ${signalFor(name, latestOutcomes.current)}`).addTo(instance);
        else popup.remove();
      });
      instance.on("mouseleave", () => popup.remove());
    }).catch(() => setFailed(true));

    return () => {
      disposed = true;
      instance?.remove();
      map.current = null;
    };
  }, [token]);

  useEffect(() => {
    if (ready && map.current?.getLayer(FILL_ID)) map.current.setPaintProperty(FILL_ID, "fill-color", fillExpression(signals));
  }, [signals, ready]);

  useEffect(() => {
    if (!ready || !map.current) return;
    const syncTheme = () => map.current?.setConfigProperty("basemap", "lightPreset", document.documentElement.dataset.theme === "dark" ? "night" : "day");
    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, [ready]);

  return <><div className="map-wrap">{token
    ? <div ref={container} className="map-canvas" aria-label="3D basemap with shaded Philippine planning regions" />
    : <div className="map-empty"><MapPinned size={38} strokeWidth={1.4} /><h3>Observed regional enrollment</h3><p>The basemap is unavailable. Use the area selector above to explore regional school records.</p></div>}
    {failed&&<p className="map-failure" role="status">Basemap unavailable. Use the area selector above to explore enrollment records.</p>}
  </div><div className="map-legend"><span><i className="blue"/>Lower than −1%</span><span><i className="green"/>Within ±1%</span><span><i className="orange"/>Higher than +1%</span><span><i className="gray"/>No comparison / boundary mismatch</span></div><p className="map-data-note">Descriptive changes in supplied records, not capacity or hazard signals. Source-year regions; NIR and PSO are available in the area selector but absent from the 2023 map. Reassigned regions are unshaded.</p></>;
}
