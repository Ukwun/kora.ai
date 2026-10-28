"use client";

import { createElement, useEffect, useRef, useState } from "react";

type ModelViewerElement = HTMLElement & {
  model?: { scene?: { traverse: (callback: (object: Record<string, unknown>) => void) => void } };
};

export default function KoraModel({ gaze, blinking, expression, fallback }: { gaze: { x: number; y: number }; blinking: boolean; expression: "people" | "work" | "money" | "signals" | "team"; fallback: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [mobile, setMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
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
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) setVisible(true);
    }, { rootMargin: "240px 0px", threshold: 0.01 });
    if (containerRef.current) observer.observe(containerRef.current);
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const viewportQuery = window.matchMedia("(max-width: 640px)");
    const motionTimer = window.setTimeout(() => setReducedMotion(motionQuery.matches), 0);
    const viewportTimer = window.setTimeout(() => setMobile(viewportQuery.matches), 0);
    const updateMotion = () => setReducedMotion(motionQuery.matches);
    const updateViewport = () => setMobile(viewportQuery.matches);
    motionQuery.addEventListener("change", updateMotion);
    viewportQuery.addEventListener("change", updateViewport);
    return () => {
      observer.disconnect();
      window.clearTimeout(motionTimer);
      window.clearTimeout(viewportTimer);
      motionQuery.removeEventListener("change", updateMotion);
      viewportQuery.removeEventListener("change", updateViewport);
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    let disposed = false;
    const sources = [
      "https://unpkg.com/@google/model-viewer@4.1.0/dist/model-viewer.min.js",
      "https://cdn.jsdelivr.net/npm/@google/model-viewer@4.1.0/dist/model-viewer.min.js",
    ];
    const loadRuntime = (index: number) => {
      if (disposed) return;
      if (customElements.get("model-viewer")) {
        setReady(true);
        return;
      }
      const existing = document.querySelector('script[data-kora-model-viewer]');
      if (existing) {
        customElements.whenDefined("model-viewer").then(() => { if (!disposed) setReady(true); }).catch(() => setFailed(true));
        return;
      }
      if (!sources[index]) {
        setFailed(true);
        return;
      }
      const script = document.createElement("script");
      script.type = "module";
      script.src = sources[index];
      script.dataset.koraModelViewer = "true";
      script.onload = () => customElements.whenDefined("model-viewer").then(() => { if (!disposed) setReady(true); }).catch(() => loadRuntime(index + 1));
      script.onerror = () => { script.remove(); loadRuntime(index + 1); };
      document.head.appendChild(script);
    };
    loadRuntime(0);
    return () => { disposed = true; };
  }, [visible]);

  useEffect(() => {
    if (!ready || reducedMotion) return;
    modelRef.current = containerRef.current?.querySelector("[data-kora-model]") as ModelViewerElement | null;
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
  }, [ready, reducedMotion, modelLoaded]);

  const loadingFallback = <div className="relative flex h-full w-full items-center justify-center">{fallback}<span className="absolute bottom-3 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-slate-400">Kora is waking up</span></div>;
  const model = ready && visible && !failed ? createElement("model-viewer", {
    "data-kora-model": "true",
    onError: () => setFailed(true),
    onLoad: () => setModelLoaded(true),
    src: "/models/Korar1-mobile.glb",
    alt: "Kora animated 3D assistant",
    reveal: "auto",
    loading: "eager",
    autoplay: !reducedMotion,
    animationName: reducedMotion ? undefined : "Armaturecorpo.001|Armaturecorpo.001|Armature|mixamo.com|Layer0",
    cameraControls: false,
    disableZoom: true,
    shadowIntensity: "0.8",
    exposure: "1.05",
    cameraTarget: "0m 5.4m 0m",
    cameraOrbit: `${gaze.x * (mobile ? 0.1 : 0.18)}deg ${82 - gaze.y * 0.1}deg ${mobile ? "7m" : "8m"}`,
    fieldOfView: mobile ? "24deg" : "20deg",
    style: { display: "block", width: "100%", height: "100%", background: "transparent", opacity: modelLoaded ? 1 : 0, transition: "opacity 500ms ease" },
  }) : null;

  return <div ref={containerRef} className="relative h-full w-full">
    {model}
    {(!modelLoaded || failed || !visible || !ready) && <div className="absolute inset-0">{visible && ready && !failed ? loadingFallback : fallback}</div>}
  </div>;
}
