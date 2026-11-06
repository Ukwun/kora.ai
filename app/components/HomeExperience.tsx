"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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
const leadMarkets = ["Africa", "UK & Europe", "China & Japan", "US & Canada", "Australia"] as const;
const leadChannels = ["Email delivery", "Email strategy", "Cold DM strategy", "WhatsApp", "Campaign ads"] as const;

const leadTiers = [
  {
    id: "tier-1",
    name: "Tier 1",
    price: "₦15,000",
    volume: "25 leads / month",
    description: "A focused starting list of prospective customers for your business.",
    includes: ["Names and professional titles", "Email addresses and phone numbers", "Prospect list prepared for your business email"],
  },
  {
    id: "tier-2",
    name: "Tier 2",
    price: "₦75,000",
    volume: "50 leads / month",
    description: "More context plus a one-day campaign built to start conversations.",
    includes: ["Emails, phone numbers, company names and websites", "One-day audience-targeted ad campaign", "Prospective customers directed to your WhatsApp DMs after connection and consent"],
  },
  {
    id: "tier-3",
    name: "Tier 3",
    price: "₦120,000",
    volume: "Up to 100 leads / month",
    description: "A richer professional audience with tailored email copy and a longer campaign.",
    includes: [
      "Professional emails, phone numbers, LinkedIn URLs and business social handles where lawfully available",
      "Company names and websites, plus professional employee and employer names",
      "Personalized first-touch and follow-up email copy for each lead",
      "Three-day audience-targeted ad campaign",
    ],
  },
] as const;

export default function HomeExperience() {
  const [activeFeature, setActiveFeature] = useState<FeatureId>("people");
  const [ambientExpression, setAmbientExpression] = useState<FeatureId>("people");
  const [selectedMarket, setSelectedMarket] = useState<(typeof leadMarkets)[number]>("Africa");
  const [selectedChannels, setSelectedChannels] = useState<(typeof leadChannels)[number][]>(["Email strategy"]);
  const [blinking, setBlinking] = useState(false);
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
    const updateFromViewport = (clientX: number) => {
      lastPointerAt.current = Date.now();
      const expressionIndex = Math.min(
        Math.floor((clientX / Math.max(window.innerWidth, 1)) * features.length),
        features.length - 1,
      );
      setAmbientExpression(features[expressionIndex].id);
    };
    const handlePointerMove = (event: globalThis.PointerEvent) => {
      if (event.pointerType !== "touch") updateFromViewport(event.clientX);
    };
    const idleMotion = window.setInterval(() => {
      if (Date.now() - lastPointerAt.current < 3500) return;
      setAmbientExpression(features[Math.floor(Date.now() / 5200) % features.length].id);
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
              setAmbientExpression(feature as FeatureId);
            }
          }
        }
      },
      { rootMargin: "-38% 0px -42% 0px", threshold: 0 },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  function toggleLeadChannel(channel: (typeof leadChannels)[number]) {
    setSelectedChannels((current) =>
      current.includes(channel)
        ? current.filter((item) => item !== channel)
        : [...current, channel],
    );
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
            <a href="#lead-growth">Find customers</a>
            <a href="#how-it-works">How it works</a>
            <a href="#trust">Built for real work</a>
          </div>
          <div className="kora-nav-actions">
            <Link className="kora-nav-signin" href="/auth?mode=signin">Sign in</Link>
            <Link className="kora-button kora-button-small" href="/auth?mode=signup">
              Get started <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <details
            className="kora-mobile-menu"
            onClick={(event) => {
              if (event.target instanceof Element && event.target.closest("a")) {
                event.currentTarget.open = false;
              }
            }}
          >
            <summary aria-label="Toggle navigation menu"><span /><span /></summary>
            <div className="kora-mobile-menu-panel">
              <a href="#capabilities">Capabilities</a>
              <a href="#lead-growth">Find customers</a>
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
          <div className="kora-face-frame" data-mode={activeFeature}>
            <div className="kora-face-halo" />
            <KoraModel
              blinking={blinking}
              expression={ambientExpression}
              priority
            />
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
          <div className="kora-face-frame kora-story-face-frame" data-mode={activeFeature}>
            <KoraModel
              blinking={blinking}
              expression={ambientExpression}
              cameraOrbit="0deg 75deg 14%"
            />
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

      <section className="kora-growth" id="lead-growth" aria-labelledby="growth-title">
        <div className="kora-growth-heading">
          <p className="kora-eyebrow"><span className="kora-live-dot" /> GROW WITH THE RIGHT PEOPLE</p>
          <h2 id="growth-title">Find your next customers—<span>wherever they are.</span></h2>
          <p>Define the companies, roles, and markets that fit your business. Request a reviewed audience across Africa, Europe, Asia-Pacific, and the Americas—subject to verified local data sources and market rules.</p>
        </div>

        <div className="kora-growth-panel">
          <div className="kora-growth-panel-heading">
            <div>
              <span className="kora-growth-kicker">YOUR IDEAL CUSTOMER, IN CONTEXT</span>
              <h3>From audience to thoughtful outreach.</h3>
            </div>
            <span className="kora-growth-orbit" aria-hidden="true">K</span>
          </div>

          <div className="kora-growth-steps">
            <article>
              <span className="kora-growth-step-number">01</span>
              <h4>Choose who you serve</h4>
              <p>Set target markets, industries, company size, and professional roles around your offer.</p>
            </article>
            <article>
              <span className="kora-growth-step-number">02</span>
              <h4>Review the right context</h4>
              <p>Request business context—company, title, public business address, website, and professional email, phone, LinkedIn, or social profile where lawfully available.</p>
            </article>
            <article>
              <span className="kora-growth-step-number">03</span>
              <h4>Plan a personal approach</h4>
              <p>Prepare tailored email, direct-message, WhatsApp, or paid-campaign strategies for the channels your business can use.</p>
            </article>
          </div>

          <div className="kora-growth-explorer">
            <div className="kora-growth-controls">
              <div>
                <p className="kora-growth-control-label">01 / Choose a market</p>
                <div className="kora-growth-markets" role="group" aria-label="Choose a target market">
                  {leadMarkets.map((market) => (
                    <button
                      type="button"
                      key={market}
                      aria-pressed={selectedMarket === market}
                      className={selectedMarket === market ? "is-selected" : ""}
                      onClick={() => setSelectedMarket(market)}
                    >
                      {market}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="kora-growth-control-label">02 / Choose your approach</p>
                <div className="kora-growth-channel-row" role="group" aria-label="Choose outreach planning channels">
                  {leadChannels.map((channel) => (
                    <button
                      type="button"
                      key={channel}
                      aria-pressed={selectedChannels.includes(channel)}
                      className={selectedChannels.includes(channel) ? "is-selected" : ""}
                      onClick={() => toggleLeadChannel(channel)}
                    >
                      <span aria-hidden="true">{selectedChannels.includes(channel) ? "✓" : "+"}</span>
                      {channel}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <aside className="kora-lead-preview" aria-live="polite">
              <div className="kora-lead-preview-heading">
                <div>
                  <span className="kora-growth-kicker">YOUR LIVE BRIEF · EXAMPLE ONLY</span>
                  <h4>{selectedMarket} audience</h4>
                </div>
                <span className="kora-lead-preview-mark" aria-hidden="true">K</span>
              </div>
              <p className="kora-lead-preview-summary">
                {selectedChannels.length
                  ? `Plan for ${selectedChannels.join(", ")}.`
                  : "Select a channel to shape your outreach plan."}
              </p>
              <ul aria-label="Potential business lead information">
                <li><span>01</span><span>Company, industry &amp; professional title</span></li>
                <li><span>02</span><span>Verified business email or phone, where available</span></li>
                <li><span>03</span><span>LinkedIn or business social profile, website &amp; public business location</span></li>
              </ul>
              <p className="kora-lead-preview-note">Illustrative fields, not real people or live lead data. Contact details require verified sources, lawful use, and regional review.</p>
            </aside>
          </div>
        </div>

        <div className="kora-growth-pricing" aria-labelledby="growth-pricing-title">
          <div className="kora-growth-pricing-heading">
            <div>
              <span className="kora-growth-kicker">LEAD SERVICE · MONTHLY TIERS</span>
              <h3 id="growth-pricing-title">Choose a starting point for your next customers.</h3>
            </div>
            <p>Reach professional audiences around the world. Plan delivery to your business email or a messaging destination, subject to availability, consent and supported connections.</p>
          </div>
          <div className="kora-growth-tier-grid">
            {leadTiers.map((tier) => (
              <article className={`kora-growth-tier-card${tier.id === "tier-3" ? " is-featured" : ""}`} key={tier.id}>
                <div className="kora-growth-tier-topline">
                  <span>{tier.name}</span>
                  {tier.id !== "tier-1" && <span className="kora-growth-tier-badge">{tier.id === "tier-3" ? "3-DAY CAMPAIGN" : "CAMPAIGN INCLUDED"}</span>}
                </div>
                <p className="kora-growth-tier-volume">{tier.volume}</p>
                <p className="kora-growth-tier-price">{tier.price}<span> / month</span></p>
                <p className="kora-growth-tier-description">{tier.description}</p>
                <ul>
                  {tier.includes.map((item) => <li key={item}><span aria-hidden="true">✓</span>{item}</li>)}
                </ul>
                <Link className="kora-growth-tier-action" href="/auth?mode=signup">
                  Create a workspace <span aria-hidden="true">↗</span>
                </Link>
              </article>
            ))}
          </div>
          <p className="kora-growth-tier-note">Lead profile details are subject to verified, lawful sources and regional review. Prices describe the proposed monthly plans; creating a workspace or requesting a review does not charge you or start lead delivery.</p>
        </div>

        <div className="kora-growth-footer">
          <p><strong>Responsible by design.</strong> Today, Kora can save a lead-service request for availability and compliance review; it does not yet source or deliver contacts or launch campaigns. Any future fulfilment requires verified sources, appropriate consent, regional review, your approval, and supported provider connections.</p>
          <div className="kora-growth-actions">
            <Link className="kora-button" href="/auth?mode=signup">Set up a workspace to request a review <span aria-hidden="true">↗</span></Link>
            <a className="kora-text-link" href="#how-it-works">See how Kora works <span aria-hidden="true">↓</span></a>
          </div>
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
          <div><p className="kora-footer-heading">Explore</p><a href="#capabilities">Capabilities</a><a href="#lead-growth">Find customers</a><a href="#how-it-works">How it works</a><a href="#trust">Our principles</a></div>
          <div><p className="kora-footer-heading">Your account</p><Link href="/auth?mode=signin">Sign in</Link><Link href="/auth?mode=signup">Create a workspace</Link><Link href="/dashboard">Open dashboard</Link></div>
          <div><p className="kora-footer-heading">Connect</p><a href="mailto:hello@kora.ng">hello@kora.ng</a></div>
        </div>
        <div className="kora-footer-bottom"><span>© {new Date().getFullYear()} Kora</span><span>Built for businesses doing real work.</span></div>
      </footer>
    </main>
  );
}
