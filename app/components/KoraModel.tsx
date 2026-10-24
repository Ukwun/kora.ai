"use client";

import { createElement, useEffect, useRef, useState } from "react";

type ModelViewerElement = HTMLElement & {
  model?: { scene?: { traverse: (callback: (object: Record<string, unknown>) => void) => void } };
};

export default function KoraModel({ gaze, blinking, expression, fallback }: { gaze: { x: number; y: number }; blinking: boolean; expression: "people" | "work" | "money" | "signals" | "team"; fallback: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const modelRef = useRef<ModelViewerElement | null>(null);
  const gazeRef = useRef(gaze);
  const blinkingRef = useRef(blinking);
  const expressionRef = useRef(expression);

  useEffect(() => {
    gazeRef.current = gaze;
    blinkingRef.current = blinking;
    expressionRef.current = expression;
  }, [gaze, blinking, expression]);

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

  useEffect(() => {
    if (!ready) return;
    modelRef.current = document.querySelector("[data-kora-model]") as ModelViewerElement | null;
    let frame = 0;
    const animateFace = () => {
      const scene = modelRef.current?.model?.scene;
      if (scene) {
        const currentGaze = gazeRef.current;
        const mood = expressionRef.current;
        scene.traverse((object) => {
          const name = String(object.name ?? "").toLowerCase();
          const rotation = object.rotation as { x?: number; y?: number } | undefined;
          if (rotation && (name.includes("neck") || name.includes("head"))) {
            const factor = name.includes("head") ? 1 : 0.55;
            rotation.y = currentGaze.x * 0.012 * factor;
            rotation.x = -currentGaze.y * 0.008 * factor;
          }
          const influences = object.morphTargetInfluences as number[] | undefined;
          const dictionary = object.morphTargetDictionary as Record<string, number> | undefined;
          if (!influences || !dictionary) return;
          const setMorph = (target: string, value: number) => {
            const index = dictionary[target];
            if (typeof index === "number") influences[index] = Math.max(0, Math.min(1, value));
          };
          const smile = mood === "people" || mood === "team" ? 0.28 : mood === "signals" ? 0.12 : 0.05;
          setMorph("eyeopenr", blinkingRef.current ? 0 : 1);
          setMorph("eyeopenel", blinkingRef.current ? 0 : 1);
          setMorph("smilel", smile);
          setMorph("smiler", smile);
          setMorph("mouthopen", mood === "work" || mood === "money" ? 0.08 : 0);
        });
      }
      frame = window.requestAnimationFrame(animateFace);
    };
    frame = window.requestAnimationFrame(animateFace);
    return () => {
      window.cancelAnimationFrame(frame);
      modelRef.current = null;
    };
  }, [ready]);

  if (failed) return fallback;
  if (!ready) return <div className="flex h-full w-full items-center justify-center">{fallback}</div>;

  return createElement("model-viewer", {
    "data-kora-model": "true",
    onError: () => setFailed(true),
    onLoad: () => setReady(true),
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
