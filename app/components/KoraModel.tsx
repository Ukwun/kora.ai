"use client";

import { createElement, useEffect, useRef, useState } from "react";

type ModelNode = {
  name: string;
  visible: boolean;
  rotation?: { x: number; y: number; z: number };
  morphTargetInfluences?: number[];
  morphTargetDictionary?: Record<string, number>;
};

type ModelScene = {
  traverse: (callback: (object: ModelNode) => void) => void;
  queueRender: () => void;
};

type Expression = "people" | "work" | "money" | "signals" | "team";
type HeadNode = { node: ModelNode; factor: number; baseX: number; baseY: number };
type BodyNode = { node: ModelNode; factor: number; baseX: number; baseZ: number };

type ModelViewerElement = HTMLElement & {
  model?: object | null;
  autoplay: boolean;
  [key: symbol]: ModelScene | undefined;
};

function getModelScene(element: ModelViewerElement) {
  const publicScene = (element.model as { scene?: ModelScene } | null | undefined)?.scene;
  if (publicScene) return publicScene;
  // model-viewer 4.1 keeps its Three.js scene on a symbol rather than a public property.
  const sceneSymbol = Object.getOwnPropertySymbols(element).find((symbol) => symbol.description === "scene");
  return sceneSymbol ? element[sceneSymbol] : undefined;
}

function applyModelPose(
  headNodes: HeadNode[],
  bodyNodes: BodyNode[],
  faceNodes: ModelNode[],
  gaze: { x: number; y: number },
  blinking: boolean,
  expression: Expression,
  reducedMotion: boolean,
  timestamp: number,
) {
  const expressions = {
    people: { smile: 0.85, mouth: 0.02, eyes: 1 },
    work: { smile: 0.03, mouth: 0.88, eyes: 0.76 },
    money: { smile: 0.55, mouth: 0.58, eyes: 0.88 },
    signals: { smile: 0.02, mouth: 0.72, eyes: 1 },
    team: { smile: 1, mouth: 0.08, eyes: 0.94 },
  } as const;
  const face = expressions[expression];
  const setMorph = (node: ModelNode, target: string, value: number) => {
    const index = node.morphTargetDictionary?.[target];
    const influences = node.morphTargetInfluences;
    if (typeof index === "number" && influences) {
      influences[index] += (Math.max(0, Math.min(1, value)) - influences[index]) * (reducedMotion ? 1 : 0.22);
    }
  };
  faceNodes.forEach((node) => {
    setMorph(node, "eyeopenr", blinking ? 0 : face.eyes);
    setMorph(node, "eyeopenel", blinking ? 0 : face.eyes);
    setMorph(node, "smilel", face.smile);
    setMorph(node, "smiler", face.smile);
    setMorph(node, "mouthopen", face.mouth);
  });
  headNodes.forEach(({ node, factor, baseX, baseY }) => {
    if (!node.rotation) return;
    node.rotation.y = baseY + gaze.x * 0.04 * factor;
    node.rotation.x = baseX + gaze.y * 0.025 * factor;
  });
  if (!reducedMotion) {
    const breath = Math.sin(timestamp / 1500);
    bodyNodes.forEach(({ node, factor, baseX, baseZ }) => {
      if (!node.rotation) return;
      node.rotation.x = baseX + breath * 0.018 * factor;
      node.rotation.z = baseZ + Math.sin(timestamp / 2400 + factor) * 0.012 * factor;
    });
  }
}

export default function KoraModel({ blinking, expression, priority = false, cameraOrbit = "0deg 75deg 20%" }: { blinking: boolean; expression: Expression; priority?: boolean; cameraOrbit?: string }) {
  const [ready, setReady] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState(priority);
  const [inView, setInView] = useState(priority);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [poseReady, setPoseReady] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const headNodesRef = useRef<{ node: ModelNode; factor: number; baseX: number; baseY: number }[]>([]);
  const bodyNodesRef = useRef<BodyNode[]>([]);
  const faceNodesRef = useRef<ModelNode[]>([]);
  const gazeRef = useRef({ x: 0, y: 0 });
  const gazeTargetRef = useRef({ x: 0, y: 0 });
  const lastPointerAtRef = useRef(0);
  const blinkingRef = useRef(blinking);
  const expressionRef = useRef(expression);
  const initialOpenAtRef = useRef(0);

  useEffect(() => {
    blinkingRef.current = blinking;
    expressionRef.current = expression;
  }, [blinking, expression]);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      const isIntersecting = entry?.isIntersecting ?? false;
      if (isIntersecting) setVisible(true);
      setInView(isIntersecting);
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
    const configureDecoder = () => {
      const modelViewerWindow = window as Window & {
        ModelViewerElement?: { dracoDecoderLocation?: string };
      };
      if (!modelViewerWindow.ModelViewerElement) modelViewerWindow.ModelViewerElement = {};
      modelViewerWindow.ModelViewerElement.dracoDecoderLocation = "/vendor/draco/";

      const modelViewer = customElements.get("model-viewer") as
        | (CustomElementConstructor & { dracoDecoderLocation?: string })
        | undefined;
      if (modelViewer) modelViewer.dracoDecoderLocation = "/vendor/draco/";
    };
    const sources = [
      "/vendor/model-viewer.min.js",
      "https://unpkg.com/@google/model-viewer@4.1.0/dist/model-viewer.min.js",
      "https://cdn.jsdelivr.net/npm/@google/model-viewer@4.1.0/dist/model-viewer.min.js",
    ];
    const configureRuntime = () => {
      configureDecoder();
      if (!disposed) setReady(true);
    };
    const loadRuntime = (index: number) => {
      if (disposed) return;
      configureDecoder();
      if (customElements.get("model-viewer")) {
        configureRuntime();
        return;
      }
      const existing = document.querySelector('script[data-kora-model-viewer]');
      if (existing) {
        customElements.whenDefined("model-viewer").then(configureRuntime).catch(() => {
          if (!disposed) setFailed(true);
        });
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
      script.onload = () => customElements.whenDefined("model-viewer").then(configureRuntime).catch(() => loadRuntime(index + 1));
      script.onerror = () => { script.remove(); loadRuntime(index + 1); };
      document.head.appendChild(script);
    };
    loadRuntime(0);
    return () => { disposed = true; };
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    lastPointerAtRef.current = Date.now();

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      if (event.pointerType === "touch") return;
      const bounds = containerRef.current?.getBoundingClientRect();
      if (!bounds) return;
      const nextGaze = {
        x: Math.max(-13, Math.min(13, ((event.clientX - bounds.left) / Math.max(bounds.width, 1) - 0.5) * 26)),
        y: Math.max(-10, Math.min(10, ((event.clientY - bounds.top) / Math.max(bounds.height, 1) - 0.5) * 20)),
      };
      gazeTargetRef.current = nextGaze;
      lastPointerAtRef.current = Date.now();

      if (reducedMotion) {
        gazeRef.current = nextGaze;
        if (modelLoaded && inView) {
          applyModelPose(
            headNodesRef.current,
            bodyNodesRef.current,
            faceNodesRef.current,
            nextGaze,
            blinkingRef.current,
            expressionRef.current,
            true,
            0,
          );
          const element = containerRef.current?.querySelector("[data-kora-model]") as ModelViewerElement | null;
          if (element) getModelScene(element)?.queueRender();
        }
      }
    };
    const idleMotion = window.setInterval(() => {
      if (reducedMotion || Date.now() - lastPointerAtRef.current < 3500) return;
      const time = Date.now() / 1100;
      gazeTargetRef.current = { x: Math.sin(time) * 3.2, y: Math.cos(time * 0.8) * 2.2 };
    }, 1200);

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.clearInterval(idleMotion);
    };
  }, [visible, reducedMotion, modelLoaded, inView]);

  useEffect(() => {
    if (!visible) return;
    const element = containerRef.current?.querySelector("[data-kora-model]") as ModelViewerElement | null;
    if (!element) return;
    let initialized = false;
    const handleLoad = () => {
      if (initialized) return;
      const scene = getModelScene(element);
      if (!scene) return;
      const headNodes: { node: ModelNode; factor: number; baseX: number; baseY: number }[] = [];
      const bodyNodes: BodyNode[] = [];
      const faceNodes: ModelNode[] = [];
      scene.traverse((object) => {
        const name = object.name.toLowerCase();
        if (name === "saia" || name.startsWith("saia001")) {
          object.visible = false;
        }
        if (object.rotation && (name.endsWith("head") || name.endsWith("neck"))) {
          headNodes.push({
            node: object,
            factor: name.endsWith("head") ? 1 : 0.55,
            baseX: object.rotation.x,
            baseY: object.rotation.y,
          });
        }
        if (object.rotation && /spine\d*$/.test(name)) {
          bodyNodes.push({
            node: object,
            factor: name.endsWith("spine") ? 1 : 0.65,
            baseX: object.rotation.x,
            baseZ: object.rotation.z,
          });
        }
        if (object.morphTargetDictionary && object.morphTargetInfluences) faceNodes.push(object);
      });

      // model-viewer can expose its scene before the glTF nodes are populated.
      if (headNodes.length === 0) return;
      initialized = true;
      headNodesRef.current = headNodes;
      bodyNodesRef.current = bodyNodes;
      faceNodesRef.current = faceNodes;
      initialOpenAtRef.current = Date.now();
      applyModelPose(headNodes, bodyNodes, faceNodes, gazeRef.current, false, expressionRef.current, true, 0);
      scene.queueRender();
      setPoseReady(true);
      setModelLoaded(true);
      setFailed(false);
    };
    const handleError = () => {
      console.error("Kora's 3D model failed to load.");
      headNodesRef.current = [];
      bodyNodesRef.current = [];
      faceNodesRef.current = [];
      setPoseReady(false);
      setModelLoaded(false);
      setFailed(true);
    };
    element.addEventListener("load", handleLoad);
    element.addEventListener("error", handleError);
    if (element.model) queueMicrotask(handleLoad);
    const scenePoll = window.setInterval(handleLoad, 100);
    const timeout = window.setTimeout(() => {
      if (!initialized) {
        console.error("Kora's 3D model timed out.");
        headNodesRef.current = [];
        bodyNodesRef.current = [];
        faceNodesRef.current = [];
        setFailed(true);
      }
    }, 30000);
    return () => {
      element.removeEventListener("load", handleLoad);
      element.removeEventListener("error", handleError);
      window.clearInterval(scenePoll);
      window.clearTimeout(timeout);
    };
  }, [ready, visible, retryNonce, modelLoaded, failed]);

  useEffect(() => {
    if (!ready || !modelLoaded || !poseReady || !inView || reducedMotion) return;
    const element = containerRef.current?.querySelector("[data-kora-model]") as ModelViewerElement | null;
    const scene = element ? getModelScene(element) : undefined;
    if (!scene) return;
    let frame = 0;
    let previousTimestamp = 0;
    const animateFace = (timestamp: number) => {
      const elapsed = previousTimestamp ? timestamp - previousTimestamp : 16.67;
      previousTimestamp = timestamp;
      const blend = 1 - Math.exp(-elapsed / 90);
      gazeRef.current = {
        x: gazeRef.current.x + (gazeTargetRef.current.x - gazeRef.current.x) * blend,
        y: gazeRef.current.y + (gazeTargetRef.current.y - gazeRef.current.y) * blend,
      };
      applyModelPose(
        headNodesRef.current,
        bodyNodesRef.current,
        faceNodesRef.current,
        gazeRef.current,
        blinkingRef.current && Date.now() - initialOpenAtRef.current >= 1000,
        expressionRef.current,
        false,
        timestamp,
      );
      scene.queueRender();
      frame = window.requestAnimationFrame(animateFace);
    };
    frame = window.requestAnimationFrame(animateFace);
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [ready, reducedMotion, modelLoaded, poseReady, inView]);

  useEffect(() => {
    if (!ready || !modelLoaded || !poseReady || !inView || !reducedMotion) return;
    gazeRef.current = gazeTargetRef.current;
    applyModelPose(headNodesRef.current, bodyNodesRef.current, faceNodesRef.current, gazeRef.current, blinking && Date.now() - initialOpenAtRef.current >= 1000, expression, true, 0);
    const element = containerRef.current?.querySelector("[data-kora-model]") as ModelViewerElement | null;
    if (element) getModelScene(element)?.queueRender();
  }, [ready, reducedMotion, modelLoaded, poseReady, inView, blinking, expression]);

  const retryModel = () => {
    setFailed(false);
    setModelLoaded(false);
    setPoseReady(false);
    headNodesRef.current = [];
    bodyNodesRef.current = [];
    faceNodesRef.current = [];
    setRetryNonce((value) => value + 1);
  };
  const model = ready && visible && !failed ? createElement("model-viewer", {
    "data-kora-model": "true",
    key: `kora-model-${retryNonce}`,
    src: `/models/Korar1-draco.glb?v=${retryNonce}`,
    alt: "Kora's animated 3D face and upper body",
    reveal: "auto",
    loading: "eager",
    autoplay: false,
    "animation-name": "Armaturecorpo.001|Armaturecorpo.001|Armature|mixamo.com|Layer0",
    // Preserve the established hero framing; interaction changes must not move Kora.
    "camera-target": "39m 93m -2m",
    "camera-orbit": cameraOrbit,
    "field-of-view": "30deg",
    "min-camera-orbit": "auto auto 0m",
    cameraControls: false,
    "disable-zoom": true,
    "shadow-intensity": "0.8",
    exposure: "1.05",
    "environment-image": "neutral",
    "tone-mapping": "neutral",
    style: { position: "absolute", inset: 0, display: "block", width: "100%", height: "100%", background: "transparent", opacity: poseReady ? 1 : 0, transition: reducedMotion ? "none" : "opacity 240ms ease" },
  }) : null;

  return <div ref={containerRef} className="relative h-full w-full" aria-busy={!poseReady && !failed}>
    {model}
    <div
      className={`absolute inset-0 transition-opacity duration-500 ${poseReady ? "pointer-events-none opacity-0" : "opacity-100"}`}
      aria-hidden={poseReady}
    >
      <div className="kora-model-loading" />
    </div>
    {visible && !poseReady && !failed && (
      <div className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center text-violet-100/70">
        <span className="text-[10px] uppercase tracking-[0.18em]">Loading Kora 3D</span>
      </div>
    )}
    {failed && (
      <div className="absolute inset-x-0 bottom-4 flex flex-col items-center gap-2 text-center">
        <p role="status" className="text-xs text-slate-300">Kora’s 3D model couldn’t load.</p>
        <button type="button" onClick={retryModel} className="rounded-lg border border-white/15 px-3 py-2 text-xs text-slate-200 transition hover:border-violet-300/40">
          Retry 3D preview
        </button>
      </div>
    )}
  </div>;
}
