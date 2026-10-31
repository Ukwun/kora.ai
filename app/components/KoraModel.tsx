"use client";

import { createElement, useEffect, useRef, useState, type ReactNode } from "react";

type ModelNode = {
  name: string;
  visible: boolean;
  rotation?: { x: number; y: number };
  morphTargetInfluences?: number[];
  morphTargetDictionary?: Record<string, number>;
};

type ModelScene = {
  traverse: (callback: (object: ModelNode) => void) => void;
};

type ModelViewerElement = HTMLElement & {
  model?: object | null;
  autoplay: boolean;
  pause: () => void;
  [key: symbol]: ModelScene | undefined;
};

function getModelScene(element: ModelViewerElement) {
  // model-viewer 4.1 keeps its Three.js scene on a symbol rather than a public property.
  const sceneSymbol = Object.getOwnPropertySymbols(element).find((symbol) => symbol.description === "scene");
  return sceneSymbol ? element[sceneSymbol] : undefined;
}

export default function KoraModel({ gaze, blinking, expression, fallback, priority = false }: { gaze: { x: number; y: number }; blinking: boolean; expression: "people" | "work" | "money" | "signals" | "team"; fallback: ReactNode; priority?: boolean }) {
  const [ready, setReady] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState(priority);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [poseReady, setPoseReady] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const headNodesRef = useRef<{ node: ModelNode; factor: number; baseX: number; baseY: number }[]>([]);
  const faceNodesRef = useRef<ModelNode[]>([]);
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
    const motionTimer = window.setTimeout(() => setReducedMotion(motionQuery.matches), 0);
    const updateMotion = () => setReducedMotion(motionQuery.matches);
    motionQuery.addEventListener("change", updateMotion);
    return () => {
      observer.disconnect();
      window.clearTimeout(motionTimer);
      motionQuery.removeEventListener("change", updateMotion);
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    let disposed = false;
    const sources = [
      "/vendor/model-viewer.min.js",
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
    if (!visible) return;
    const element = containerRef.current?.querySelector("[data-kora-model]") as ModelViewerElement | null;
    if (!element) return;
    let initialized = false;
    const handleLoad = () => {
      if (initialized) return;
      const scene = getModelScene(element);
      if (!scene) {
        console.error("Kora's 3D scene is unavailable; showing the illustrated fallback.");
        setFailed(true);
        return;
      }

      const headNodes: { node: ModelNode; factor: number; baseX: number; baseY: number }[] = [];
      const faceNodes: ModelNode[] = [];
      let skirtFound = false;
      scene.traverse((object) => {
        const name = object.name.toLowerCase();
        if (name === "saia" || name.startsWith("saia001")) {
          object.visible = false;
          skirtFound = true;
        }
        if (object.rotation && (name.endsWith("head") || name.endsWith("neck"))) {
          headNodes.push({
            node: object,
            factor: name.endsWith("head") ? 1 : 0.55,
            baseX: object.rotation.x,
            baseY: object.rotation.y,
          });
        }
        if (object.morphTargetDictionary && object.morphTargetInfluences) faceNodes.push(object);
      });

      if (!skirtFound) {
        console.error("Kora's detached skirt mesh could not be hidden; showing the illustrated fallback.");
        setFailed(true);
        return;
      }

      initialized = true;
      headNodesRef.current = headNodes;
      faceNodesRef.current = faceNodes;
      setPoseReady(false);
      setModelLoaded(true);
      setFailed(false);
    };
    const handleError = () => {
      console.error("Kora's 3D model failed to load; showing the illustrated fallback.");
      headNodesRef.current = [];
      faceNodesRef.current = [];
      setPoseReady(false);
      setModelLoaded(false);
      setFailed(true);
    };
    element.addEventListener("load", handleLoad);
    element.addEventListener("error", handleError);
    if (element.model) queueMicrotask(handleLoad);
    const timeout = window.setTimeout(() => {
      if (!modelLoaded) {
        console.error("Kora's 3D model timed out; showing the illustrated fallback.");
        headNodesRef.current = [];
        faceNodesRef.current = [];
        setFailed(true);
      }
    }, 30000);
    return () => {
      element.removeEventListener("load", handleLoad);
      element.removeEventListener("error", handleError);
      window.clearTimeout(timeout);
    };
  }, [visible, retryNonce, modelLoaded, failed]);

  useEffect(() => {
    if (!modelLoaded || poseReady) return;
    const element = containerRef.current?.querySelector("[data-kora-model]") as ModelViewerElement | null;
    if (!element) return;
    const settleTimer = window.setTimeout(() => {
      element.pause();
      element.autoplay = false;
      headNodesRef.current.forEach(({ node, ...head }) => {
        if (!node.rotation) return;
        head.baseX = node.rotation.x;
        head.baseY = node.rotation.y;
      });
      setPoseReady(true);
    }, reducedMotion ? 150 : 900);
    return () => window.clearTimeout(settleTimer);
  }, [modelLoaded, poseReady, reducedMotion]);

  useEffect(() => {
    if (!ready || !modelLoaded || !poseReady || reducedMotion) return;
    let frame = 0;
    const animateFace = () => {
      const currentGaze = gazeRef.current;
      const mood = expressionRef.current;

      headNodesRef.current.forEach(({ node, factor, baseX, baseY }) => {
        if (!node.rotation) return;
        node.rotation.y = baseY + currentGaze.x * 0.012 * factor;
        node.rotation.x = baseX - currentGaze.y * 0.008 * factor;
      });

      const setMorph = (node: ModelNode, target: string, value: number) => {
        const index = node.morphTargetDictionary?.[target];
        const influences = node.morphTargetInfluences;
        if (typeof index === "number" && influences) influences[index] = Math.max(0, Math.min(1, value));
      };
      const smile = mood === "people" || mood === "team" ? 0.28 : mood === "signals" ? 0.12 : 0.05;
      faceNodesRef.current.forEach((node) => {
        setMorph(node, "eyeopenr", blinkingRef.current ? 0 : 1);
        setMorph(node, "eyeopenel", blinkingRef.current ? 0 : 1);
        setMorph(node, "smilel", smile);
        setMorph(node, "smiler", smile);
        setMorph(node, "mouthopen", mood === "work" || mood === "money" ? 0.08 : 0);
      });

      frame = window.requestAnimationFrame(animateFace);
    };
    frame = window.requestAnimationFrame(animateFace);
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [ready, reducedMotion, modelLoaded, poseReady]);

  const retryModel = () => {
    setFailed(false);
    setModelLoaded(false);
    setPoseReady(false);
    headNodesRef.current = [];
    faceNodesRef.current = [];
    setRetryNonce((value) => value + 1);
  };
  const model = visible && !failed ? createElement("model-viewer", {
    "data-kora-model": "true",
    key: `kora-model-${retryNonce}`,
    src: `/models/Korar1-fast.glb?v=${retryNonce}`,
    alt: "Kora's animated 3D face and upper body",
    reveal: "auto",
    loading: "eager",
    autoplay: true,
    "animation-name": "Armaturecorpo.001|Armaturecorpo.001|Armature|mixamo.com|Layer0",
    "camera-target": "39m 93m -2m",
    "camera-orbit": "0deg 75deg 20%",
    "field-of-view": "30deg",
    "min-camera-orbit": "auto auto 0m",
    cameraControls: false,
    "disable-zoom": true,
    "shadow-intensity": "0.8",
    exposure: "1.05",
    "environment-image": "neutral",
    "tone-mapping": "neutral",
    style: { position: "absolute", inset: 0, display: "block", width: "100%", height: "100%", background: "transparent" },
  }) : null;

  return <div ref={containerRef} className="relative h-full w-full" aria-busy={!modelLoaded && !failed}>
    {model}
    <div
      className={`absolute inset-0 transition-opacity duration-500 ${modelLoaded ? "pointer-events-none opacity-0" : "opacity-100"}`}
      aria-hidden={modelLoaded}
    >
      {fallback}
    </div>
    {visible && !modelLoaded && !failed && (
      <div className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center text-violet-100/70">
        <span className="text-[10px] uppercase tracking-[0.18em]">Loading Kora 3D</span>
      </div>
    )}
    {failed && (
      <div className="absolute inset-x-0 bottom-4 flex flex-col items-center gap-2 text-center">
        <p role="status" className="text-xs text-slate-300">3D preview unavailable. Showing Kora’s illustration.</p>
        <button type="button" onClick={retryModel} className="rounded-lg border border-white/15 px-3 py-2 text-xs text-slate-200 transition hover:border-violet-300/40">
          Retry 3D preview
        </button>
      </div>
    )}
  </div>;
}
