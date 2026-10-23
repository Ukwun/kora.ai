"use client";

import { createElement, useEffect, useState } from "react";

export default function KoraModel({ gaze, fallback }: { gaze: { x: number; y: number }; fallback: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const existing = document.querySelector('script[data-kora-model-viewer]');
    if (existing) {
      const timer = window.setTimeout(() => setReady(true), 0);
      return () => window.clearTimeout(timer);
    }
    const script = document.createElement("script");
    script.type = "module";
    script.src = "https://unpkg.com/@google/model-viewer@4.1.0/dist/model-viewer.min.js";
    script.dataset.koraModelViewer = "true";
    script.onload = () => setReady(true);
    script.onerror = () => setFailed(true);
    document.head.appendChild(script);
  }, []);

  if (failed) return fallback;
  if (!ready) return <div className="flex h-full w-full items-center justify-center">{fallback}</div>;

  return createElement("model-viewer", {
    src: "/models/Korar1.glb",
    alt: "Kora animated 3D assistant",
    autoplay: true,
    animationName: "Armaturecorpo.001|Armaturecorpo.001|Armature|mixamo.com|Layer0",
    cameraControls: false,
    disableZoom: true,
    shadowIntensity: "0.8",
    exposure: "1.05",
    cameraOrbit: `${gaze.x * 0.18}deg ${90 - gaze.y * 0.1}deg auto`,
    style: { width: "100%", height: "100%", background: "transparent" },
  });
}
