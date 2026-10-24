"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import KoraModel from "./KoraModel";

const features = [
  {
    id: "people",
    number: "01",
    label: "Customers",
    title: "Know who you’re working with.",
    description:
      "Keep customer records, their history, and the context behind each relationship together in the workspace.",
    signal: "Customer records · business memory",
  },
  {
    id: "work",
    number: "02",
    label: "Work",
    title: "Keep the work moving.",
    description:
      "Bring tasks, owners, priorities, and due dates into the same operating picture as the people they serve.",
    signal: "Tasks · ownership · due dates",
  },
  {
    id: "money",
    number: "03",
    label: "Money",
    title: "See what is owed and what is paid.",
    description:
      "Create and review invoice records alongside customer activity. Payment status stays tied to recorded events.",
    signal: "Invoices · payment records",
  },
  {
    id: "signals",
    number: "04",
    label: "Signals",
    title: "Make the next step explainable.",
    description:
      "Kora can surface recommendations from business records, show the evidence, and leave decisions with your team.",
    signal: "Record-based insights · human approval",
  },
  {
    id: "team",
    number: "05",
    label: "Your team",
    title: "Give each person the right context.",
    description:
      "Separate workspaces, memberships, and roles help the right people work from the right business information.",
    signal: "Workspace membership · role-aware access",
  },
] as const;

type FeatureId = (typeof features)[number]["id"];

function RobotFace({
  idPrefix,
  activeFeature,
  blinking,
  gaze,
}: {
  idPrefix: string;
  activeFeature: FeatureId;
  blinking: boolean;
  gaze: { x: number; y: number };
}) {
  return (
    <svg
      className="kora-robot-face"
      viewBox="0 0 560 640"
      role="img"
      aria-label="Kora, an abstract synthetic intelligence with softly glowing violet eyes"
    >
      <defs>
        <linearGradient id={`${idPrefix}-shell`} x1="0.13" y1="0.05" x2="0.9" y2="1">
          <stop offset="0" stopColor="#38344a" />
          <stop offset="0.38" stopColor="#171622" />
          <stop offset="0.78" stopColor="#0a0a11" />
          <stop offset="1" stopColor="#40364f" />
        </linearGradient>
        <linearGradient id={`${idPrefix}-face`} x1="0" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#262332" />
          <stop offset="0.52" stopColor="#11111a" />
          <stop offset="1" stopColor="#1d1828" />
        </linearGradient>
        <linearGradient id={`${idPrefix}-eye`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f1c6ff" />
          <stop offset="0.45" stopColor="#c76aff" />
          <stop offset="1" stopColor="#7550ff" />
        </linearGradient>
        <linearGradient id={`${idPrefix}-neck`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#342c43" />
          <stop offset="0.5" stopColor="#0c0b13" />
          <stop offset="1" stopColor="#4a3157" />
        </linearGradient>
        <radialGradient id={`${idPrefix}-faceGlow`} cx="50%" cy="43%" r="57%">
          <stop offset="0" stopColor="#b044ff" stopOpacity=".22" />
          <stop offset="1" stopColor="#b044ff" stopOpacity="0" />
        </radialGradient>
        <filter id={`${idPrefix}-violetGlow`} x="-150%" y="-150%" width="400%" height="400%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id={`${idPrefix}-leftEye`}>
          <path d="M151 277 Q193 243 235 276 Q197 306 151 277Z" />
        </clipPath>
        <clipPath id={`${idPrefix}-rightEye`}>
          <path d="M325 276 Q367 243 409 277 Q363 306 325 276Z" />
        </clipPath>
      </defs>

      <ellipse cx="280" cy="570" rx="167" ry="43" fill="#a144ff" opacity=".12" filter={`url(#${idPrefix}-violetGlow)`} />
      <path d="M188 477 Q198 535 151 581 Q280 641 409 581 Q362 535 372 477Z" fill={`url(#${idPrefix}-neck)`} stroke="#6d4d83" strokeOpacity=".45" />
      <path d="M150 555 Q280 512 410 555 Q467 574 480 627 L80 627 Q93 574 150 555Z" fill={`url(#${idPrefix}-shell)`} stroke="#8b63a1" strokeOpacity=".38" />
      <path d="M131 202 Q128 87 280 64 Q432 87 429 202 L417 382 Q404 486 280 514 Q156 486 143 382Z" fill={`url(#${idPrefix}-shell)`} stroke="#9075a4" strokeOpacity=".57" strokeWidth="1.5" />
      <path d="M145 204 Q160 106 280 91 Q400 106 415 204 L402 366 Q390 449 280 478 Q170 449 158 366Z" fill={`url(#${idPrefix}-face)`} />
      <path d="M145 205 Q191 107 280 94 Q369 107 415 205 Q388 173 357 166 Q283 143 203 168 Q170 179 145 205Z" fill="#0b0b12" />
      <ellipse cx="280" cy="290" rx="138" ry="173" fill={`url(#${idPrefix}-faceGlow)`} />

      <path d="M134 222 Q108 236 117 300 Q123 340 149 349 L151 265Z" fill="#171420" stroke="#9968bb" strokeOpacity=".65" />
      <path d="M426 222 Q452 236 443 300 Q437 340 411 349 L409 265Z" fill="#171420" stroke="#9968bb" strokeOpacity=".65" />
      <path d="M123 264 Q135 249 148 264 M437 264 Q425 249 412 264" fill="none" stroke="#d39aff" strokeOpacity=".75" strokeWidth="2" />
      <circle cx="132" cy="292" r="4" fill="#d590ff" filter={`url(#${idPrefix}-violetGlow)`} />
      <circle cx="428" cy="292" r="4" fill="#d590ff" filter={`url(#${idPrefix}-violetGlow)`} />

      <path d="M151 277 Q193 243 235 276 Q197 306 151 277Z" fill="#07070c" stroke="#8b6aa0" strokeWidth="2" />
      <path d="M325 276 Q367 243 409 277 Q363 306 325 276Z" fill="#07070c" stroke="#8b6aa0" strokeWidth="2" />
      <g clipPath={`url(#${idPrefix}-leftEye)`}>
        <circle cx={193 + gaze.x} cy={276 + gaze.y} r="18" fill={`url(#${idPrefix}-eye)`} filter={`url(#${idPrefix}-violetGlow)`} />
        <circle cx={193 + gaze.x} cy={276 + gaze.y} r="7" fill="#090810" />
        <circle cx={187 + gaze.x} cy={269 + gaze.y} r="3.4" fill="#fff" opacity=".92" />
        <path className={blinking ? "kora-eye-lid kora-eye-lid-closed" : "kora-eye-lid"} d="M150 243 Q193 230 237 247 L237 281 Q196 296 150 281Z" />
      </g>
      <g clipPath={`url(#${idPrefix}-rightEye)`}>
        <circle cx={367 + gaze.x} cy={276 + gaze.y} r="18" fill={`url(#${idPrefix}-eye)`} filter={`url(#${idPrefix}-violetGlow)`} />
        <circle cx={367 + gaze.x} cy={276 + gaze.y} r="7" fill="#090810" />
        <circle cx={361 + gaze.x} cy={269 + gaze.y} r="3.4" fill="#fff" opacity=".92" />
        <path className={blinking ? "kora-eye-lid kora-eye-lid-closed" : "kora-eye-lid"} d="M323 243 Q367 230 411 247 L411 281 Q370 296 323 281Z" />
      </g>
      <path d="M151 277 Q193 243 235 276 M325 276 Q367 243 409 277" fill="none" stroke="#d5a7eb" strokeOpacity=".8" strokeWidth="2" />

      <path d="M280 282 Q274 322 264 354 Q278 366 296 354" fill="none" stroke="#87778f" strokeOpacity=".68" strokeWidth="2" />
      <path className="kora-face-mouth" d="M238 403 Q280 417 322 403" fill="none" stroke="#c481dd" strokeOpacity=".82" strokeWidth="2.5" />
      <path d="M252 404 Q280 410 308 404" fill="none" stroke="#a448d5" strokeOpacity=".5" />

      <path d="M164 330 L192 340 L205 358 M396 330 L368 340 L355 358" fill="none" stroke="#8d64a5" strokeOpacity=".47" />
      <path d="M161 348 L180 353 M399 348 L380 353" stroke="#d298ef" strokeOpacity=".63" strokeWidth="2" />
      <path d="M149 187 Q280 120 411 187" fill="none" stroke="#e0b5f4" strokeOpacity=".48" />
      <path d="M177 457 Q280 493 383 457" fill="none" stroke="#bd7bdb" strokeOpacity=".32" />
      <path d="M229 115 Q280 99 331 115" fill="none" stroke="#9f78b7" strokeOpacity=".65" strokeWidth="2" />
      <circle cx="280" cy="113" r="3" fill="#d7a0ff" filter={`url(#${idPrefix}-violetGlow)`} />
      <path d="M92 417 Q112 399 135 397 M468 417 Q448 399 425 397" fill="none" stroke="#ac70d0" strokeOpacity=".55" />

      <g className={`kora-face-signal kora-face-signal-${activeFeature}`} fill="none" stroke="#bd80f0" strokeWidth="1.5">
        <path d="M107 211 H83 V181 H65" />
        <path d="M453 211 H477 V181 H495" />
        <circle cx="65" cy="181" r="3" fill="#e1b7ff" />
        <circle cx="495" cy="181" r="3" fill="#e1b7ff" />
      </g>
    </svg>
  );
}

export default function HomeExperience() {
  const [activeFeature, setActiveFeature] = useState<FeatureId>("people");
  const [gaze, setGaze] = useState({ x: 0, y: 0 });
  const [blinking, setBlinking] = useState(false);
  const gazeTarget = useRef({ x: 0, y: 0 });
  const lastPointerAt = useRef(0);
  const active = features.find((feature) => feature.id === activeFeature) ?? features[0];

  useEffect(() => {
    let blinkTimer = 0;
    let resetTimer = 0;
    let disposed = false;

    const scheduleBlink = () => {
      blinkTimer = window.setTimeout(() => {
        if (disposed) return;
        setBlinking(true);
        resetTimer = window.setTimeout(() => {
          setBlinking(false);
          scheduleBlink();
        }, 145);
      }, 2300 + Math.random() * 3000);
    };

    scheduleBlink();
    return () => {
      disposed = true;
      window.clearTimeout(blinkTimer);
      window.clearTimeout(resetTimer);
    };
  }, []);

  useEffect(() => {
    let animationFrame = 0;
    let disposed = false;

    const animateGaze = () => {
      if (disposed) return;
      setGaze((current) => {
        const next = {
          x: current.x + (gazeTarget.current.x - current.x) * 0.16,
          y: current.y + (gazeTarget.current.y - current.y) * 0.16,
        };
        return Math.abs(next.x - current.x) < 0.02 && Math.abs(next.y - current.y) < 0.02 ? gazeTarget.current : next;
      });
      animationFrame = window.requestAnimationFrame(animateGaze);
    };

    animationFrame = window.requestAnimationFrame(animateGaze);
    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  useEffect(() => {
    const updateFromViewport = (clientX: number, clientY: number) => {
      const x = Math.max(-13, Math.min(13, (clientX / Math.max(window.innerWidth, 1) - 0.5) * 26));
      const y = Math.max(-10, Math.min(10, (clientY / Math.max(window.innerHeight, 1) - 0.5) * 20));
      gazeTarget.current = { x, y };
      lastPointerAt.current = Date.now();
    };
    const handlePointerMove = (event: globalThis.PointerEvent) => {
      if (event.pointerType !== "touch") updateFromViewport(event.clientX, event.clientY);
    };
    const idleMotion = window.setInterval(() => {
      if (Date.now() - lastPointerAt.current < 3500) return;
      const time = Date.now() / 1100;
      gazeTarget.current = { x: Math.sin(time) * 3.2, y: Math.cos(time * 0.8) * 2.2 };
    }, 1200);

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.clearInterval(idleMotion);
    };
  }, []);

  useEffect(() => {
    const sections = document.querySelectorAll<HTMLElement>("[data-kora-feature]");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (!(entry.target instanceof HTMLElement)) continue;
            const feature = entry.target.dataset.koraFeature;
            if (features.some((item) => item.id === feature)) {
              setActiveFeature(feature as FeatureId);
            }
          }
        }
      },
      { rootMargin: "-38% 0px -42% 0px", threshold: 0 },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  function followPointer(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") return;
    gazeTarget.current = {
      x: Math.max(-13, Math.min(13, (event.clientX / Math.max(window.innerWidth, 1) - 0.5) * 26)),
      y: Math.max(-10, Math.min(10, (event.clientY / Math.max(window.innerHeight, 1) - 0.5) * 20)),
    };
    lastPointerAt.current = Date.now();
  }

  return (
    <main className="kora-site">
      <header className="kora-nav-wrap">
        <nav className="kora-nav" aria-label="Main navigation">
          <Link href="/" className="kora-brand" aria-label="Kora home">
            <span className="kora-brand-mark">K</span>
            <span className="kora-brand-name">kora<span>.</span></span>
          </Link>
          <div className="kora-nav-links">
            <a href="#capabilities">Capabilities</a>
            <a href="#how-it-works">How it works</a>
            <a href="#trust">Built for real work</a>
          </div>
          <div className="kora-nav-actions">
            <Link className="kora-nav-signin" href="/auth?mode=signin">Sign in</Link>
            <Link className="kora-button kora-button-small" href="/auth?mode=signup">
              Get started <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <details className="kora-mobile-menu">
            <summary aria-label="Open navigation menu"><span /><span /></summary>
            <div className="kora-mobile-menu-panel">
              <a href="#capabilities">Capabilities</a>
              <a href="#how-it-works">How it works</a>
              <a href="#trust">Built for real work</a>
              <Link href="/auth?mode=signin">Sign in</Link>
              <Link href="/auth?mode=signup">Create a workspace</Link>
            </div>
          </details>
        </nav>
      </header>

      <section className="kora-hero" aria-labelledby="hero-title">
        <div className="kora-hero-copy">
          <p className="kora-eyebrow"><span className="kora-live-dot" /> ONE CLEARER VIEW OF YOUR BUSINESS</p>
          <h1 id="hero-title">See your whole business. <span>Clearly.</span></h1>
        </div>

        <div className="kora-hero-visual">
          <div className="kora-visual-glow" />
          <div className="kora-orbit kora-orbit-one" />
          <div className="kora-orbit kora-orbit-two" />
          <div className="kora-orbit-point kora-orbit-point-one" />
          <div className="kora-orbit-point kora-orbit-point-two" />
          <div className="kora-face-frame" data-mode={activeFeature} onPointerMove={followPointer}>
            <div className="kora-face-halo" />
            <KoraModel gaze={gaze} blinking={blinking} expression={activeFeature} fallback={<RobotFace idPrefix="hero" activeFeature={activeFeature} blinking={blinking} gaze={gaze} />} />
            <span className="kora-face-corner kora-face-corner-tl" />
            <span className="kora-face-corner kora-face-corner-br" />
          </div>
          <div className="kora-visual-label">
            <span className="kora-label-pulse" />
            <span><strong>Kora</strong> is with you</span>
            <span className="kora-label-divider" />
            <span className="kora-label-context">{active.label}</span>
          </div>
          <div className="kora-visual-note kora-note-left">
            <span className="kora-note-icon">✳</span>
            <span><strong>{active.label} in focus</strong><small>{active.signal}</small></span>
          </div>
          <div className="kora-visual-note kora-note-right">
            <span className="kora-note-icon">↗</span>
            <span><strong>Human in control</strong><small>Insight is not an instruction</small></span>
          </div>
          <span className="kora-visual-index">KORA INTELLIGENCE · 01</span>
        </div>

        <div className="kora-hero-bottom">
          <p className="kora-hero-description">
            Kora connects the people, work, and money behind your day—so you can make the next move with context, not guesswork.
          </p>
          <div className="kora-hero-actions">
            <Link className="kora-button" href="/auth?mode=signup">Build your workspace <span aria-hidden="true">↗</span></Link>
            <a className="kora-text-link" href="#capabilities">Explore what Kora knows <span aria-hidden="true">↓</span></a>
          </div>
          <div className="kora-hero-proof">
            <div className="kora-proof-icon" aria-hidden="true"><span /><span /><span /></div>
            <p><strong>One shared picture.</strong> Separate workspaces. Decisions stay yours.</p>
          </div>
        </div>
      </section>

      <section className="kora-proof-strip" aria-label="Kora operating principles">
        <p>BUILT FOR THE DETAILS THAT MAKE A BUSINESS YOURS</p>
        <div><span>People</span><i /> <span>Customers</span><i /> <span>Work</span><i /> <span>Money</span><i /> <span>Decisions</span></div>
      </section>

      <section className="kora-capabilities" id="capabilities" aria-labelledby="capabilities-title">
        <div className="kora-capabilities-intro">
          <p className="kora-eyebrow">A BUSINESS HAS MANY SIGNALS</p>
          <h2 id="capabilities-title">Kora brings them into focus.</h2>
          <p>Not another dashboard of disconnected numbers. A workspace-aware view of the people and activity behind the business.</p>
          <div
            className="kora-face-frame kora-story-face-frame"
            data-mode={activeFeature}
            onPointerMove={followPointer}
          >
            <RobotFace idPrefix="story" activeFeature={activeFeature} blinking={blinking} gaze={gaze} />
          </div>
          <div className="kora-story-caption" aria-live="polite">
            <span>NOW EXPLORING · {active.number}</span>
            <strong>{active.title}</strong>
          </div>
          <div className="kora-feature-shortcuts" aria-label="Explore capabilities">
            {features.map((feature) => (
              <a
                key={feature.id}
                href={`#${feature.id}`}
                aria-label={`Explore ${feature.label}`}
                aria-current={activeFeature === feature.id ? "step" : undefined}
                className={activeFeature === feature.id ? "is-active" : ""}
              >
                <span>{feature.number}</span>{feature.label}<span aria-hidden="true">↗</span>
              </a>
            ))}
          </div>
        </div>

        <div className="kora-feature-list">
          {features.map((feature) => (
            <article
              className={`kora-feature-card${activeFeature === feature.id ? " is-active" : ""}`}
              data-kora-feature={feature.id}
              id={feature.id}
              key={feature.id}
            >
              <span className="kora-feature-number">{feature.number} / 05</span>
              <p className="kora-feature-label">{feature.label}</p>
              <h3>{feature.title}</h3>
              <p className="kora-feature-description">{feature.description}</p>
              <p className="kora-feature-signal"><span />{feature.signal}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="kora-how" id="how-it-works" aria-labelledby="how-title">
        <div className="kora-how-heading">
          <p className="kora-eyebrow">HOW KORA WORKS</p>
          <h2 id="how-title">From what happened to what matters.</h2>
        </div>
        <div className="kora-how-steps">
          <article><span>01</span><h3>Bring the work together</h3><p>Customers, invoices, tasks, and team activity live inside an organization-aware workspace.</p></article>
          <article><span>02</span><h3>Keep the context</h3><p>Business memory connects new activity to the records and history your team already has.</p></article>
          <article><span>03</span><h3>Choose what happens next</h3><p>Evidence-backed observations help your team decide. Kora does not act on your behalf.</p></article>
        </div>
        <div className="kora-how-connector" aria-hidden="true"><span /><span /><span /></div>
      </section>

      <section className="kora-trust" id="trust" aria-labelledby="trust-title">
        <div className="kora-trust-orb" />
        <div className="kora-trust-content">
          <p className="kora-eyebrow">INTELLIGENCE WITH ACCOUNTABILITY</p>
          <h2 id="trust-title">Useful because it knows its limits.</h2>
          <p>Kora’s recommendations are grounded in the workspace records it can access. The team sees the evidence, understands the context, and stays responsible for the decision.</p>
          <div className="kora-trust-points">
            <span><i>✓</i> Workspace-aware access</span>
            <span><i>✓</i> Record-led signals</span>
            <span><i>✓</i> People stay in control</span>
          </div>
        </div>
        <div className="kora-trust-card">
          <span className="kora-card-kicker"><span className="kora-live-dot" /> HOW KORA THINKS</span>
          <div className="kora-card-line"><span className="kora-card-node">01</span><p>Read the workspace records</p></div>
          <div className="kora-card-line"><span className="kora-card-node">02</span><p>Connect activity to its context</p></div>
          <div className="kora-card-line"><span className="kora-card-node">03</span><p>Show an evidence-backed next step</p></div>
          <div className="kora-card-footer"><span>YOUR TEAM DECIDES</span><span className="kora-card-status">● In control</span></div>
        </div>
      </section>

      <section className="kora-cta">
        <div className="kora-cta-glow" />
        <p className="kora-eyebrow">START WITH YOUR BUSINESS</p>
        <h2>Let Kora get to know how you work.</h2>
        <p>Create a workspace for your team and begin building a clearer picture from your own records.</p>
        <div className="kora-cta-actions">
          <Link className="kora-button" href="/auth?mode=signup">Create your workspace <span aria-hidden="true">↗</span></Link>
          <Link className="kora-text-link" href="/auth?mode=signin">Already have an account? Sign in</Link>
        </div>
      </section>

      <footer className="kora-footer">
        <div className="kora-footer-main">
          <div className="kora-footer-brand">
            <Link href="/" className="kora-brand" aria-label="Kora home"><span className="kora-brand-mark">K</span><span className="kora-brand-name">kora<span>.</span></span></Link>
            <p>Intelligence for the business you’re actually running.</p>
          </div>
          <div><p className="kora-footer-heading">Explore</p><a href="#capabilities">Capabilities</a><a href="#how-it-works">How it works</a><a href="#trust">Our principles</a></div>
          <div><p className="kora-footer-heading">Your account</p><Link href="/auth?mode=signin">Sign in</Link><Link href="/auth?mode=signup">Create a workspace</Link><Link href="/dashboard">Open dashboard</Link></div>
          <div><p className="kora-footer-heading">Connect</p><a href="mailto:hello@kora.ng">hello@kora.ng</a></div>
        </div>
        <div className="kora-footer-bottom"><span>© {new Date().getFullYear()} Kora</span><span>Built for businesses doing real work.</span></div>
      </footer>
    </main>
  );
}
