'use client';

import { useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { BrandLogo } from '@crm-eco/ui/components/brand-logo';
import { ThemeToggle } from '@/components/crm/shell/ThemeToggle';
import '@crm-eco/ui/styles/landing.css';

// --- Arrow Icon ---
function ArrowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
  );
}

// --- Play Icon ---
function PlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
  );
}

// --- Feature Icon SVGs ---
const featureIcons = {
  contacts: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  enrollment: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>,
  commissions: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0891b2" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  workflows: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>,
  hipaa: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0891b2" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  ai: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
};

// --- Data ---
const features = [
  { icon: 'contacts', color: 'cyan', title: 'Contact Management', desc: 'Full lifecycle tracking from lead to active member. Custom fields, smart filters, and bulk operations built for benefits data.' },
  { icon: 'enrollment', color: 'emerald', title: 'Enrollment Engine', desc: 'Branded enrollment pages with QR codes, e-signatures, and real-time carrier submission. From quote to enrolled in minutes.' },
  { icon: 'commissions', color: 'cyan', title: 'Commission Tracking', desc: 'Automated commission calculations, tiered payout structures, and real-time transaction logs. Never miss a dollar.' },
  { icon: 'workflows', color: 'emerald', title: 'Workflow Automation', desc: 'Trigger email sequences, task assignments, and notifications automatically. Set it once, let the system work for you.' },
  { icon: 'hipaa', color: 'cyan', title: 'HIPAA Compliance', desc: 'PHI detection, encrypted data at rest and in transit, audit logs, and role-based access control. Built-in, not bolted on.' },
  { icon: 'ai', color: 'cyan', title: 'AI Ticket Resolution', desc: 'Gemini-powered ticket summarization, smart routing, and draft responses. Resolve member issues faster with AI assist.' },
];

const tickerItems = [
  'New enrollment processed — Plan: Secure HSA 2024',
  'Commission payout: $1,247.00 deposited',
  'Carrier rate update synced — Zion Health',
  'Compliance check passed — HIPAA verified',
  'New lead captured — Web form: Benefits Inquiry',
  'Ticket resolved — Avg response: 2.3 hrs',
  'Workflow triggered — Welcome email sequence',
  'Member renewal reminder sent — 47 upcoming',
];

const activities = [
  { text: 'New enrollment submitted', color: '#10b981', time: '2m ago' },
  { text: 'Commission calculated', color: '#0891b2', time: '5m ago' },
  { text: 'Member status updated', color: '#f59e0b', time: '12m ago' },
  { text: 'Ticket auto-assigned', color: '#059669', time: '18m ago' },
  { text: 'Workflow triggered', color: '#06b6d4', time: '24m ago' },
];

const contacts = [
  { name: 'James Morrison', initials: 'JM', plan: 'Secure HSA 2024', amount: '$487/mo', status: 'Active', statusClass: 'lp-status-active', gradient: 'linear-gradient(135deg, #06b6d4, #059669)' },
  { name: 'Sarah Rodriguez', initials: 'SR', plan: 'Care Plus 2024', amount: '$312/mo', status: 'Active', statusClass: 'lp-status-active', gradient: 'linear-gradient(135deg, #0891b2, #059669)' },
  { name: 'Kevin Park', initials: 'KP', plan: 'Premium Care', amount: 'Application submitted', status: 'Pending', statusClass: 'lp-status-pending', gradient: 'linear-gradient(135deg, #10b981, #06b6d4)' },
  { name: 'Amanda Liu', initials: 'AL', plan: 'Secure HSA', amount: 'Enrollment started', status: 'New', statusClass: 'lp-status-new', gradient: 'linear-gradient(135deg, #06b6d4, #0891b2)' },
  { name: 'David Williams', initials: 'DW', plan: 'Care Plus', amount: '$529/mo', status: 'Active', statusClass: 'lp-status-active', gradient: 'linear-gradient(135deg, #059669, #06b6d4)' },
  { name: 'Maria Chen', initials: 'MC', plan: 'Secure Care', amount: '$445/mo', status: 'Active', statusClass: 'lp-status-active', gradient: 'linear-gradient(135deg, #10b981, #0891b2)' },
  { name: 'Robert Taylor', initials: 'RT', plan: 'HSA Essential', amount: 'Review pending', status: 'Pending', statusClass: 'lp-status-pending', gradient: 'linear-gradient(135deg, #059669, #06b6d4)' },
  { name: 'Lisa Johnson', initials: 'LJ', plan: 'Premium Plus', amount: '$612/mo', status: 'Active', statusClass: 'lp-status-active', gradient: 'linear-gradient(135deg, #06b6d4, #10b981)' },
  { name: 'Michael Brown', initials: 'MB', plan: 'Care Plus', amount: 'Docs needed', status: 'New', statusClass: 'lp-status-new', gradient: 'linear-gradient(135deg, #06b6d4, #10b981)' },
  { name: 'Jennifer Davis', initials: 'JD', plan: 'Secure HSA 2024', amount: '$398/mo', status: 'Active', statusClass: 'lp-status-active', gradient: 'linear-gradient(135deg, #0891b2, #06b6d4)' },
];

const testimonials = [
  { initials: 'RM', name: 'Rachel Martinez', role: 'Agency Director, Southwest Benefits', text: '"We cut our enrollment processing time by 70%. The automation alone paid for itself in the first month."' },
  { initials: 'TH', name: 'Thomas Hayes', role: 'Managing Partner, Cascade Health Advisors', text: '"Finally, a CRM that speaks our language. No more forcing a sales CRM to do benefits work. This was built for us."' },
  { initials: 'NK', name: 'Nina Kowalski', role: 'COO, Premier Benefits Group', text: '"The commission tracking is flawless. We went from spreadsheets and guesswork to real-time visibility overnight."' },
];

const barHeights = [45, 62, 38, 71, 55, 80, 48, 65, 73, 90, 58, 85];

export default function CrmLandingPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contactPanelRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const countersStarted = useRef(false);

  // Helix canvas animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let time = 0;

    function resize() {
      if (!canvas) return;
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.offsetWidth;
      canvas.height = parent.offsetHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    function draw() {
      if (!ctx || !canvas) return;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      const amplitude = Math.min(w * 0.15, 200);
      const spacing = 30;
      const numPoints = Math.ceil(h / spacing) + 2;

      for (let i = 0; i < numPoints; i++) {
        const y = i * spacing;
        const phase = time * 0.01 + i * 0.15;
        const x1 = cx + Math.sin(phase) * amplitude;
        const x2 = cx + Math.sin(phase + Math.PI) * amplitude;

        if (i % 3 === 0) {
          ctx.beginPath();
          ctx.moveTo(x1, y);
          ctx.lineTo(x2, y);
          ctx.strokeStyle = `rgba(5, 150, 105, ${0.06 + Math.sin(phase) * 0.03})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(x1, y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(6, 182, 212, ${0.15 + Math.sin(phase) * 0.1})`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x2, y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(5, 150, 105, ${0.15 + Math.cos(phase) * 0.1})`;
        ctx.fill();
      }
      time++;
      animId = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  // Counter animation
  const animateCounters = useCallback(() => {
    document.querySelectorAll<HTMLElement>('[data-counter-target]').forEach(el => {
      const target = parseInt(el.dataset.counterTarget || '0');
      const prefix = el.dataset.counterPrefix || '';
      const suffix = el.dataset.counterSuffix || '';
      let current = 0;
      const increment = target / 80;
      const timer = setInterval(() => {
        current += increment;
        if (current >= target) { current = target; clearInterval(timer); }
        el.textContent = prefix + Math.floor(current).toLocaleString() + suffix;
      }, 20);
    });
  }, []);

  // Scroll animations & counter trigger
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const delay = parseInt((entry.target as HTMLElement).dataset.delay || '0');
          setTimeout(() => entry.target.classList.add('lp-visible'), delay);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    document.querySelectorAll('.lp-reveal, .lp-feature-card, .lp-metric, .lp-workflow-step, .lp-testimonial-card').forEach(el => observer.observe(el));

    // Counter observer
    const statsEl = statsRef.current;
    if (statsEl) {
      const statsObs = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && !countersStarted.current) {
            countersStarted.current = true;
            animateCounters();
          }
        });
      }, { threshold: 0.3 });
      statsObs.observe(statsEl);
      return () => { observer.disconnect(); statsObs.disconnect(); };
    }

    return () => observer.disconnect();
  }, [animateCounters]);

  // Metric counters
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target.querySelector<HTMLElement>('.lp-metric-value');
          if (!el || el.dataset.counted) return;
          el.dataset.counted = '1';
          const target = parseFloat(el.dataset.count || '0');
          const isDecimal = target % 1 !== 0;
          const startTime = performance.now();
          function update(now: number) {
            const progress = Math.min((now - startTime) / 2000, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = target * eased;
            if (!el) return;
            if (isDecimal) el.textContent = current.toFixed(1) + (target === 99.9 ? '%' : 's');
            else el.textContent = Math.floor(current).toLocaleString() + '+';
            if (progress < 1) requestAnimationFrame(update);
          }
          requestAnimationFrame(update);
        }
      });
    }, { threshold: 0.3 });

    document.querySelectorAll('.lp-metric').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Contact card rotation
  useEffect(() => {
    const interval = setInterval(() => {
      const panel = contactPanelRef.current;
      if (!panel) return;
      const shuffled = [...contacts].sort(() => Math.random() - 0.5).slice(0, 5);
      const cards = panel.querySelectorAll<HTMLElement>('.lp-contact-card');
      cards.forEach((card, i) => {
        card.style.opacity = '0';
        card.style.transform = 'translateX(20px)';
        setTimeout(() => {
          const c = shuffled[i];
          if (!c) return;
          const avatar = card.querySelector<HTMLElement>('.lp-contact-avatar');
          const nameEl = card.querySelector('.lp-contact-name');
          const metaEl = card.querySelector('.lp-contact-meta');
          const statusEl = card.querySelector<HTMLElement>('.lp-contact-status');
          if (avatar) { avatar.style.background = c.gradient; avatar.textContent = c.initials; }
          if (nameEl) nameEl.textContent = c.name;
          if (metaEl) metaEl.textContent = `${c.plan} — ${c.amount}`;
          if (statusEl) { statusEl.textContent = c.status; statusEl.className = 'lp-contact-status ' + c.statusClass; }
          card.style.transition = 'all 0.4s ease';
          card.style.opacity = '1';
          card.style.transform = 'translateX(0)';
        }, i * 100 + 200);
      });
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  // Nav scroll effect
  useEffect(() => {
    const handler = () => {
      document.getElementById('lp-navbar')?.classList.toggle('lp-nav-scrolled', window.scrollY > 50);
    };
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <div className="lp-root">
      {/* Nav — floating island */}
      <div className="lp-nav-wrap">
        <nav id="lp-navbar" className="lp-nav" aria-label="Primary">
          <Link href="/" className="lp-nav-brand">
            <BrandLogo variant="full" size="sm" tone="auto" priority />
          </Link>
          <div className="lp-nav-links">
            <a href="#features">Features</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#demo">Platform</a>
            <a href="#testimonials">Testimonials</a>
            <a
              href="https://doublehelixhub.com"
              target="_blank"
              rel="noopener noreferrer"
              className="lp-nav-platform"
              aria-label="Visit the Double Helix platform site"
            >
              Platform <span aria-hidden="true">↗</span>
            </a>
          </div>
          <div className="lp-nav-actions">
            <ThemeToggle variant="icon" className="lp-theme-btn !h-9 !w-9" />
            <Link href="/crm-login" className="lp-nav-link-login">Log In</Link>
            <Link href="/crm-login" className="lp-nav-cta">Get Started</Link>
          </div>
        </nav>
      </div>

      {/* Hero */}
      <section className="lp-hero">
        <canvas ref={canvasRef} className="lp-helix-canvas" />
        <div className="lp-hero-bg" />
        <div className="lp-hero-grid" />
        <div className="lp-orb lp-orb-1" />
        <div className="lp-orb lp-orb-2" />
        <div className="lp-orb lp-orb-3" />

        <div className="lp-hero-content">
          <div className="lp-hero-badge">
            <span className="lp-dot" />
            Now in Beta — Early Access Open
          </div>
          <h1>The CRM Built for<br/><span className="lp-gradient">Health Benefits</span></h1>
          <p>
            Double Helix CRM unifies contacts, enrollments, commissions, and
            compliance into one intelligent platform — purpose-built for
            benefits advisors and agencies, and engineered alongside{' '}
            <a
              href="https://admin.doublehelixhub.com"
              target="_blank"
              rel="noopener noreferrer"
              className="lp-inline-link"
            >
              Double Helix Admin
            </a>{' '}
            for end-to-end member operations.
          </p>
          <div className="lp-hero-actions">
            <Link href="/crm-login" className="lp-btn-primary"><ArrowIcon /> Start Free Trial</Link>
            <a href="#demo" className="lp-btn-secondary"><PlayIcon /> Watch Demo</a>
          </div>
        </div>
      </section>

      {/* Dashboard Preview */}
      <div className="lp-dashboard-preview">
        <div className="lp-dashboard-frame">
          <div className="lp-bezel-inner">
          <div className="lp-dashboard-topbar">
            <span className="lp-dot-r" /><span className="lp-dot-y" /><span className="lp-dot-g" />
            <span className="lp-dashboard-url">crm.doublehelix.com/dashboard</span>
          </div>
          <div className="lp-dashboard-body">
            <div className="lp-dash-sidebar">
              {['Dashboard', 'Contacts', 'Enrollments', 'Leads', 'Commissions', 'Tickets', 'Settings'].map((item, i) => (
                <div key={item} className={`lp-dash-sidebar-item${i === 0 ? ' active' : ''}`}>
                  <span className="lp-dash-icon">{'■●◆★►□⚙'[i]}</span> {item}
                </div>
              ))}
            </div>
            <div className="lp-dash-main">
              <div className="lp-dash-stats" ref={statsRef}>
                <div className="lp-dash-stat">
                  <div className="lp-dash-stat-label">Active Members</div>
                  <div className="lp-dash-stat-value" data-counter-target="12847">0</div>
                  <div className="lp-dash-stat-change up">+12.4% this month</div>
                </div>
                <div className="lp-dash-stat">
                  <div className="lp-dash-stat-label">Monthly Premium</div>
                  <div className="lp-dash-stat-value" data-counter-target="487320" data-counter-prefix="$">$0</div>
                  <div className="lp-dash-stat-change up">+8.2% this month</div>
                </div>
                <div className="lp-dash-stat">
                  <div className="lp-dash-stat-label">New Enrollments</div>
                  <div className="lp-dash-stat-value" data-counter-target="342">0</div>
                  <div className="lp-dash-stat-change up">+24.1% this month</div>
                </div>
                <div className="lp-dash-stat">
                  <div className="lp-dash-stat-label">Retention Rate</div>
                  <div className="lp-dash-stat-value" data-counter-target="96" data-counter-suffix="%">0%</div>
                  <div className="lp-dash-stat-change up">+1.3% this month</div>
                </div>
              </div>
              <div className="lp-dash-chart-row">
                <div className="lp-dash-chart">
                  <div className="lp-dash-chart-title">Enrollment Trends</div>
                  <div className="lp-chart-bars">
                    {barHeights.map((h, i) => (
                      <div key={i} className={`lp-chart-bar${i % 2 === 0 ? '' : ' alt'}`} style={{ height: h + '%', animationDelay: i * 0.08 + 's' }} />
                    ))}
                  </div>
                </div>
                <div className="lp-dash-chart">
                  <div className="lp-dash-chart-title">Recent Activity</div>
                  <div className="lp-dash-activity">
                    {activities.map((a, i) => (
                      <div key={i} className="lp-activity-item" style={{ animationDelay: i * 0.15 + 0.5 + 's' }}>
                        <span className="lp-activity-dot" style={{ background: a.color }} />
                        <span className="lp-activity-text">{a.text}</span>
                        <span className="lp-activity-time">{a.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>

      {/* Ticker */}
      <div className="lp-ticker-bar">
        <div className="lp-ticker-track">
          {[...tickerItems, ...tickerItems].map((item, i) => (
            <span key={i} className="lp-ticker-item"><span className="lp-ticker-dot" /> {item}</span>
          ))}
        </div>
      </div>

      {/* Features */}
      <section id="features" className="lp-section">
        <div className="lp-section-header lp-reveal">
          <div className="lp-section-badge">Platform Features</div>
          <h2>Everything You Need.<br/><span className="lp-gradient">Nothing You Don&apos;t.</span></h2>
          <p>Purpose-built modules that work together seamlessly — from first contact to commission payout.</p>
        </div>
        <div className="lp-features-grid">
          {features.map((f, i) => (
            <div key={f.title} className="lp-feature-card" data-delay={i * 100}>
              <div className="lp-bezel-inner">
                <div className={`lp-feature-icon ${f.color}`}>
                  {featureIcons[f.icon as keyof typeof featureIcons]}
                </div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Metrics */}
      <section className="lp-metrics-section lp-section">
        <div className="lp-metrics-grid">
          {[
            { value: '99.9', label: 'Uptime SLA' },
            { value: '50000', label: 'Members Managed' },
            { value: '247', label: 'Agencies Onboarded' },
            { value: '4.2', label: 'Avg Response (sec)' },
          ].map((m, i) => (
            <div key={m.label} className="lp-metric" data-delay={i * 150}>
              <div className="lp-metric-value" data-count={m.value}>0</div>
              <div className="lp-metric-label">{m.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="lp-section">
        <div className="lp-section-header lp-reveal">
          <div className="lp-section-badge">How It Works</div>
          <h2>Three Steps to<br/><span className="lp-gradient">Operational Excellence</span></h2>
          <p>Get your agency running on Double Helix CRM in days, not months.</p>
        </div>
        <div className="lp-workflow-steps">
          {[
            { n: '1', title: 'Import & Configure', desc: 'Bulk import your contacts, map your fields, set up carrier integrations, and configure your commission tiers. We handle the migration.' },
            { n: '2', title: 'Enroll & Automate', desc: 'Create branded enrollment pages, set up workflow automations, and start processing applications through the platform.' },
            { n: '3', title: 'Scale & Optimize', desc: 'Track commissions in real-time, monitor retention metrics, and use AI-powered insights to grow your book of business.' },
          ].map((s, i) => (
            <div key={s.n} className="lp-workflow-step" data-delay={i * 200}>
              <div className="lp-bezel-inner">
                <div className={`lp-step-number step-${s.n}`}>{s.n}</div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="lp-glow-line" />

      {/* Demo Section */}
      <section id="demo" className="lp-section">
        <div className="lp-demo-container">
          <div className="lp-demo-text lp-reveal">
            <div className="lp-section-badge">Live Platform</div>
            <h2>See It <span className="lp-gradient">In Action</span></h2>
            <p>Every interaction is tracked, every enrollment is automated, every commission is calculated — in real-time.</p>
            <div className="lp-demo-features">
              {[
                { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>, title: 'Real-Time Dashboards', desc: 'Live KPIs, enrollment trends, and premium analytics at a glance' },
                { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>, title: 'Multi-Portal Architecture', desc: 'Dedicated portals for admins, advisors, and members — one platform' },
                { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>, title: 'AI-Powered Intelligence', desc: 'Gemini AI for ticket triage, smart search, and next-best-action recommendations' },
              ].map(f => (
                <div key={f.title} className="lp-demo-feature">
                  <div className="lp-demo-feature-icon">{f.icon}</div>
                  <div><h4>{f.title}</h4><p>{f.desc}</p></div>
                </div>
              ))}
            </div>
          </div>

          <div className="lp-demo-visual lp-reveal" data-delay="200">
            <div className="lp-bezel-inner">
              <div className="lp-demo-panel-header">
                <span className="lp-demo-panel-title">Contact Manager</span>
                <span className="lp-demo-panel-badge">Live</span>
              </div>
              <div ref={contactPanelRef} className="lp-demo-panel-body">
                {contacts.slice(0, 5).map(c => (
                  <div key={c.initials} className="lp-contact-card">
                    <div className="lp-contact-avatar" style={{ background: c.gradient }}>{c.initials}</div>
                    <div className="lp-contact-info">
                      <div className="lp-contact-name">{c.name}</div>
                      <div className="lp-contact-meta">{c.plan} — {c.amount}</div>
                    </div>
                    <span className={`lp-contact-status ${c.statusClass}`}>{c.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="lp-section">
        <div className="lp-section-header lp-reveal">
          <div className="lp-section-badge">Trusted By Agencies</div>
          <h2>Built With Advisors.<br/><span className="lp-gradient">Loved By Teams.</span></h2>
        </div>
        <div className="lp-testimonials-grid">
          {testimonials.map((t, i) => (
            <div key={t.initials} className="lp-testimonial-card" data-delay={i * 150}>
              <div className="lp-bezel-inner">
                <div className="lp-testimonial-stars">{'★★★★★'}</div>
                <div className="lp-testimonial-text">{t.text}</div>
                <div className="lp-testimonial-author">
                  <div className="lp-testimonial-avatar">{t.initials}</div>
                  <div>
                    <div className="lp-testimonial-name">{t.name}</div>
                    <div className="lp-testimonial-role">{t.role}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="lp-cta-section">
        <div className="lp-reveal">
          <h2>Ready to <span className="lp-gradient">Transform</span><br/>Your Agency?</h2>
          <p>Join the agencies already running their entire operation on Double Helix CRM.</p>
          <div className="lp-hero-actions">
            <Link href="/crm-login" className="lp-btn-primary">Start Free Trial <ArrowIcon /></Link>
            <a href="#demo" className="lp-btn-secondary">Schedule a Demo</a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="lp-footer">
        <div className="lp-footer-grid">
          <div>
            <div className="lp-footer-brand">Double Helix CRM</div>
            <div className="lp-footer-desc">
              Part of the{' '}
              <a
                href="https://doublehelix.com"
                target="_blank"
                rel="noopener noreferrer"
                className="lp-inline-link"
              >
                Double Helix Software
              </a>{' '}
              platform — the CRM strand that pairs with{' '}
              <a
                href="https://admin.doublehelixhub.com"
                target="_blank"
                rel="noopener noreferrer"
                className="lp-inline-link"
              >
                Admin
              </a>{' '}
              for end-to-end member, advisor, and enrollment operations.
            </div>
          </div>
          <div className="lp-footer-col">
            <h4>Platform</h4>
            <a href="https://doublehelix.com/crm" target="_blank" rel="noopener noreferrer">CRM Overview</a>
            <a href="https://admin.doublehelixhub.com" target="_blank" rel="noopener noreferrer">Admin</a>
            <a href="#features">Features</a>
            <a href="#how-it-works">How it works</a>
          </div>
          <div className="lp-footer-col">
            <h4>Resources</h4>
            <a href="https://doublehelix.com/security" target="_blank" rel="noopener noreferrer">Security</a>
            <a href="https://doublehelix.com/integrations" target="_blank" rel="noopener noreferrer">Integrations</a>
            <a href="https://doublehelix.com/customers" target="_blank" rel="noopener noreferrer">Customers</a>
            <a href="#testimonials">Testimonials</a>
          </div>
          <div className="lp-footer-col">
            <h4>Company</h4>
            <a href="https://doublehelix.com" target="_blank" rel="noopener noreferrer">About</a>
            <a href="https://doublehelix.com/contact" target="_blank" rel="noopener noreferrer">Contact sales</a>
            <a href="https://doublehelix.com/legal/privacy" target="_blank" rel="noopener noreferrer">Privacy</a>
            <a href="https://doublehelix.com/legal/terms" target="_blank" rel="noopener noreferrer">Terms</a>
          </div>
        </div>
        <div className="lp-footer-bottom">
          <span>&copy; 2026 Double Helix Software. All rights reserved.</span>
          <span>
            <a
              href="https://doublehelix.com"
              target="_blank"
              rel="noopener noreferrer"
              className="lp-inline-link"
            >
              doublehelix.com
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
