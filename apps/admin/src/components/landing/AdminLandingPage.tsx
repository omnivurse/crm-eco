'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import Link from 'next/link';
import { BrandLogo } from '@crm-eco/ui/components/brand-logo';
import '@crm-eco/ui/styles/landing.css';

function ArrowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
  );
}

function PlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
  );
}

const featureIcons = {
  members: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  billing: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/></svg>,
  commissions: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  products: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>,
  enrollment: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>,
  compliance: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
};

const features = [
  { icon: 'enrollment', color: 'amber', title: 'Benefits Enrollment Engine', desc: 'Digital enrollment flows, e-signatures, plan selection, dependent capture, and carrier-ready submissions — from application to active member in one pipeline.' },
  { icon: 'members', color: 'cyan', title: 'Member Management (MMS)', desc: 'The core MMS registry: coverage changes, dependents, terminations, renewals, and member communications — one auditable source of truth.' },
  { icon: 'products', color: 'emerald', title: 'Benefits & Plan Catalog', desc: 'Configure health sharing products, carriers, rate tables, and enrollment rules. Launch new plans and price changes with scheduled effective dates.' },
  { icon: 'billing', color: 'blue', title: 'Billing & Payments', desc: 'Automated billing runs, NACHA exports, payment processors, invoices, and failure recovery — tied directly to enrolled member coverage.' },
  { icon: 'commissions', color: 'purple', title: 'Agent Commissions', desc: 'Enrollment-linked commission tiers, accrual runs, payout batches, and agent bill groups — every enrollment tied to compensation.' },
  { icon: 'compliance', color: 'rose', title: 'HIPAA Compliance & Audit', desc: 'PHI-safe enrollment and member data handling with encrypted storage, role-based access, and full audit logs on every action.' },
];

const showcaseModules = [
  {
    id: 'enrollment',
    title: 'Benefits Enrollment Pipeline',
    desc: 'Guide applicants from quote to enrolled member — applications, underwriting review, plan binding, and welcome communications in one workflow.',
    icon: featureIcons.enrollment,
    stageTitle: 'Enrollment Pipeline — Live',
  },
  {
    id: 'members',
    title: 'Member Management (MMS)',
    desc: 'Search, filter, and manage your entire member population with real-time coverage, billing, and enrollment history.',
    icon: featureIcons.members,
    stageTitle: 'MMS Member Directory',
  },
  {
    id: 'billing',
    title: 'Billing & Collections',
    desc: 'Orchestrate monthly billing runs, monitor failures, and export NACHA files — synced to enrolled member plans.',
    icon: featureIcons.billing,
    stageTitle: 'Billing Run — March 2026',
  },
  {
    id: 'commissions',
    title: 'Enrollment-Linked Commissions',
    desc: 'Accrue and disburse agent commissions automatically when enrollments bind — tier-aware with full payout audit trails.',
    icon: featureIcons.commissions,
    stageTitle: 'Commission Accrual — Q1 2026',
  },
];

const tickerItems = [
  'New benefits enrollment submitted — Secure HSA 2024',
  'Enrollment approved — Care Plus 2024 · 3 dependents',
  'Member activated in MMS — James Morrison',
  'Enrollment link conversion — 68% completion rate',
  'Billing run completed — 2,847 enrolled members',
  'Commission accrual posted — $48,320.00',
  'Plan catalog updated — Premium Care rates effective Apr 1',
  'NACHA export generated — 1,204 transactions',
];

const activities = [
  { text: 'Benefits enrollment approved', color: '#10b981', time: '1m ago' },
  { text: 'Member added to MMS registry', color: '#06b6d4', time: '3m ago' },
  { text: 'Enrollment link submitted', color: '#f59e0b', time: '6m ago' },
  { text: 'Billing run initiated', color: '#3b82f6', time: '12m ago' },
  { text: 'Commission accrual posted', color: '#8b5cf6', time: '18m ago' },
];

const members = [
  { name: 'James Morrison', initials: 'JM', plan: 'Secure HSA 2024', detail: '$487/mo — Current', status: 'Active', statusClass: 'lp-status-active', gradient: 'linear-gradient(135deg, #06b6d4, #3b82f6)' },
  { name: 'Sarah Rodriguez', initials: 'SR', plan: 'Care Plus 2024', detail: 'Renewal due Apr 15', status: 'Active', statusClass: 'lp-status-active', gradient: 'linear-gradient(135deg, #8b5cf6, #3b82f6)' },
  { name: 'Kevin Park', initials: 'KP', plan: 'Premium Care', detail: 'Pending approval', status: 'Review', statusClass: 'lp-status-pending', gradient: 'linear-gradient(135deg, #10b981, #06b6d4)' },
  { name: 'Amanda Liu', initials: 'AL', plan: 'Secure HSA', detail: 'New enrollment', status: 'New', statusClass: 'lp-status-new', gradient: 'linear-gradient(135deg, #f59e0b, #f43f5e)' },
  { name: 'David Williams', initials: 'DW', plan: 'Care Plus', detail: '$529/mo — Current', status: 'Active', statusClass: 'lp-status-active', gradient: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' },
];

const testimonials = [
  { initials: 'JC', name: 'Jennifer Cole', role: 'VP Operations, Summit Health Share', text: '"MMS is our benefits enrollment and member management backbone. Applications that took a week now enroll in a day — and every member lands in one registry."' },
  { initials: 'MP', name: 'Marcus Patel', role: 'Director of Enrollment, Unity Benefits', text: '"We finally have enrollment software that speaks benefits — plan selection, dependents, e-sign, and MMS member records without switching systems."' },
  { initials: 'LW', name: 'Laura Whitfield', role: 'COO, Heritage Health Sharing', text: '"From enrollment to billing to commissions, MMS handles the full member lifecycle. Our ops team stopped living in spreadsheets."' },
];

const barHeights = [52, 68, 45, 78, 61, 88, 55, 72, 80, 95, 64, 91];
const SHOWCASE_INTERVAL = 5000;

function ShowcasePanel({ moduleId, active }: { moduleId: string; active: boolean }) {
  if (moduleId === 'enrollment') {
    return (
      <div className={`lp-showcase-panel${active ? ' active' : ''}`}>
        <div className="lp-mock-progress-list">
          {[
            { label: 'Application submitted', value: '100%', width: '100%', status: 'Complete' },
            { label: 'Plan & dependent review', value: '100%', width: '100%', status: 'Complete' },
            { label: 'E-signature & binding', value: '86%', width: '86%', status: 'In progress' },
            { label: 'MMS member activation', value: '42%', width: '42%', status: 'Pending' },
          ].map((p) => (
            <div key={p.label} className="lp-mock-progress-item">
              <div className="lp-mock-progress-header">
                <span className="lp-mock-progress-label">{p.label}</span>
                <span className="lp-mock-progress-value">{p.status}</span>
              </div>
              <div className="lp-mock-progress-track">
                <div className="lp-mock-progress-fill" style={{ width: active ? p.width : '0', background: p.width === '100%' ? 'linear-gradient(90deg, #10b981, #06b6d4)' : undefined }} />
              </div>
            </div>
          ))}
        </div>
        <div className="lp-mock-stats" style={{ marginTop: 20 }}>
          <div className="lp-mock-stat"><div className="lp-mock-stat-label">In Pipeline</div><div className="lp-mock-stat-value amber" style={{ color: '#f59e0b' }}>342</div></div>
          <div className="lp-mock-stat"><div className="lp-mock-stat-label">Approved Today</div><div className="lp-mock-stat-value green">28</div></div>
          <div className="lp-mock-stat"><div className="lp-mock-stat-label">Conversion</div><div className="lp-mock-stat-value cyan">68%</div></div>
        </div>
      </div>
    );
  }

  if (moduleId === 'billing') {
    return (
      <div className={`lp-showcase-panel${active ? ' active' : ''}`}>
        <div className="lp-mock-stats">
          <div className="lp-mock-stat"><div className="lp-mock-stat-label">Processed</div><div className="lp-mock-stat-value cyan">2,847</div></div>
          <div className="lp-mock-stat"><div className="lp-mock-stat-label">Collected</div><div className="lp-mock-stat-value green">$1.2M</div></div>
          <div className="lp-mock-stat"><div className="lp-mock-stat-label">Failed</div><div className="lp-mock-stat-value">12</div></div>
        </div>
        <div className="lp-mock-progress-list">
          {[
            { label: 'ACH Debits', value: '98%', width: '98%' },
            { label: 'Credit Cards', value: '94%', width: '94%' },
            { label: 'Retry Queue', value: '67%', width: '67%' },
          ].map((p) => (
            <div key={p.label} className="lp-mock-progress-item">
              <div className="lp-mock-progress-header">
                <span className="lp-mock-progress-label">{p.label}</span>
                <span className="lp-mock-progress-value">{p.value}</span>
              </div>
              <div className="lp-mock-progress-track">
                <div className="lp-mock-progress-fill" style={{ width: active ? p.width : '0' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (moduleId === 'commissions') {
    return (
      <div className={`lp-showcase-panel${active ? ' active' : ''}`}>
        <div className="lp-mock-stats">
          <div className="lp-mock-stat"><div className="lp-mock-stat-label">Accrued</div><div className="lp-mock-stat-value purple">$48,320</div></div>
          <div className="lp-mock-stat"><div className="lp-mock-stat-label">Agents</div><div className="lp-mock-stat-value cyan">247</div></div>
          <div className="lp-mock-stat"><div className="lp-mock-stat-label">Pending</div><div className="lp-mock-stat-value">$8,412</div></div>
        </div>
        <div className="lp-mock-bar-chart">
          {[65, 45, 80, 55, 90, 70, 85, 60].map((h, i) => (
            <div key={i} className={`lp-mock-bar${i % 2 ? ' purple' : ''}`} style={{ height: `${h}%`, animationDelay: `${i * 0.1}s` }} />
          ))}
        </div>
      </div>
    );
  }

  if (moduleId === 'members') {
    return (
      <div className={`lp-showcase-panel${active ? ' active' : ''}`}>
        <table className="lp-mock-table">
          <thead>
            <tr><th>Member</th><th>Plan</th><th>Status</th></tr>
          </thead>
          <tbody>
            {[
              ['James Morrison', 'Secure HSA 2024', 'Active'],
              ['Sarah Rodriguez', 'Care Plus 2024', 'Active'],
              ['Kevin Park', 'Premium Care', 'Review'],
              ['Amanda Liu', 'Secure HSA', 'New'],
            ].map(([name, plan, status]) => (
              <tr key={name}>
                <td style={{ color: '#f1f5f9', fontWeight: 600 }}>{name}</td>
                <td>{plan}</td>
                <td>
                  <span className={`lp-mock-badge ${status === 'Active' ? 'green' : status === 'Review' ? 'amber' : 'blue'}`}>
                    {status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className={`lp-showcase-panel${active ? ' active' : ''}`}>
      <div className="lp-mock-stats">
        <div className="lp-mock-stat"><div className="lp-mock-stat-label">Enrolled</div><div className="lp-mock-stat-value cyan">+342</div></div>
        <div className="lp-mock-stat"><div className="lp-mock-stat-label">Retention</div><div className="lp-mock-stat-value green">94.2%</div></div>
        <div className="lp-mock-stat"><div className="lp-mock-stat-label">Avg Premium</div><div className="lp-mock-stat-value">$487</div></div>
      </div>
      <table className="lp-mock-table" style={{ marginTop: 16 }}>
        <thead>
          <tr><th>Enrollment</th><th>Plan</th><th>MMS Status</th></tr>
        </thead>
        <tbody>
          {[
            ['Secure HSA 2024', 'Individual + 2 deps', 'Active'],
            ['Care Plus 2024', 'Family', 'Active'],
            ['Premium Care', 'Individual', 'Review'],
          ].map(([plan, type, status]) => (
            <tr key={plan}>
              <td style={{ color: '#f1f5f9', fontWeight: 600 }}>{plan}</td>
              <td>{type}</td>
              <td>
                <span className={`lp-mock-badge ${status === 'Active' ? 'green' : 'amber'}`}>{status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminLandingPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const memberPanelRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const countersStarted = useRef(false);
  const [activeShowcase, setActiveShowcase] = useState(0);
  const [showcaseProgress, setShowcaseProgress] = useState(0);

  // Helix canvas
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
          ctx.strokeStyle = `rgba(59, 130, 246, ${0.06 + Math.sin(phase) * 0.03})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(x1, y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(6, 182, 212, ${0.15 + Math.sin(phase) * 0.1})`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x2, y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(139, 92, 246, ${0.15 + Math.cos(phase) * 0.1})`;
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

  // Feature showcase auto-rotation
  useEffect(() => {
    const interval = setInterval(() => {
      setShowcaseProgress((prev) => {
        const step = 100 / (SHOWCASE_INTERVAL / 50);
        const next = prev + step;
        if (next >= 100) {
          setActiveShowcase((i) => (i + 1) % showcaseModules.length);
          return 0;
        }
        return next;
      });
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const animateCounters = useCallback(() => {
    document.querySelectorAll<HTMLElement>('[data-counter-target]').forEach((el) => {
      const target = parseInt(el.dataset.counterTarget || '0', 10);
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

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const delay = parseInt((entry.target as HTMLElement).dataset.delay || '0', 10);
          setTimeout(() => entry.target.classList.add('lp-visible'), delay);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    document.querySelectorAll('.lp-reveal, .lp-feature-card, .lp-metric, .lp-workflow-step, .lp-testimonial-card').forEach((el) => observer.observe(el));

    const statsEl = statsRef.current;
    if (statsEl) {
      const statsObs = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
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

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
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

    document.querySelectorAll('.lp-metric').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Member card rotation
  useEffect(() => {
    const interval = setInterval(() => {
      const panel = memberPanelRef.current;
      if (!panel) return;
      const shuffled = [...members].sort(() => Math.random() - 0.5).slice(0, 5);
      const cards = panel.querySelectorAll<HTMLElement>('.lp-contact-card');
      cards.forEach((card, i) => {
        card.style.opacity = '0';
        card.style.transform = 'translateX(20px)';
        setTimeout(() => {
          const m = shuffled[i];
          if (!m) return;
          const avatar = card.querySelector<HTMLElement>('.lp-contact-avatar');
          const nameEl = card.querySelector('.lp-contact-name');
          const metaEl = card.querySelector('.lp-contact-meta');
          const statusEl = card.querySelector<HTMLElement>('.lp-contact-status');
          if (avatar) { avatar.style.background = m.gradient; avatar.textContent = m.initials; }
          if (nameEl) nameEl.textContent = m.name;
          if (metaEl) metaEl.textContent = `${m.plan} — ${m.detail}`;
          if (statusEl) { statusEl.textContent = m.status; statusEl.className = 'lp-contact-status ' + m.statusClass; }
          card.style.transition = 'all 0.4s ease';
          card.style.opacity = '1';
          card.style.transform = 'translateX(0)';
        }, i * 100 + 200);
      });
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = () => {
      document.getElementById('lp-navbar')?.classList.toggle('lp-nav-scrolled', window.scrollY > 50);
    };
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <div className="lp-root">
      <nav id="lp-navbar" className="lp-nav">
        <Link href="/" className="lp-nav-brand">
          <BrandLogo variant="full" size="md" tone="white" priority />
          <span className="lp-nav-wordmark-sub">MMS</span>
        </Link>
        <div className="lp-nav-links">
          <a href="#features">Features</a>
          <a href="#enrollment">Enrollment</a>
          <a href="#enrollment">Platform</a>
          <a href="#how-it-works">How It Works</a>
          <a href="#testimonials">Testimonials</a>
          <a
            href="https://doublehelixhub.com"
            target="_blank"
            rel="noopener noreferrer"
            className="lp-nav-platform"
          >
            Platform <span aria-hidden="true">↗</span>
          </a>
          <Link href="/login" className="lp-nav-link-login">Log In</Link>
          <Link href="/login" className="lp-nav-cta">Get Started</Link>
        </div>
      </nav>

      <section className="lp-hero">
        <canvas ref={canvasRef} className="lp-helix-canvas" />
        <div className="lp-hero-bg" />
        <div className="lp-hero-grid" />
        <div className="lp-orb lp-orb-1" />
        <div className="lp-orb lp-orb-2" />
        <div className="lp-orb lp-orb-3" />

        <div className="lp-hero-content">
          <div className="lp-hero-pills">
            <div className="lp-hero-badge lp-hero-badge-enrollment">
              <span className="lp-dot" />
              Benefits Enrollment Software
            </div>
            <div className="lp-hero-badge lp-hero-badge-mms">
              MMS — Member Management System
            </div>
          </div>
          <h1>Benefits Enrollment &<br/><span className="lp-gradient">Member Management</span></h1>
          <p className="lp-hero-subline">
            Double Helix MMS is purpose-built benefits enrollment and member management software
            for health sharing organizations — enroll members, manage coverage, run billing, and
            pay agent commissions from one platform.
          </p>
          <p>
            Engineered alongside{' '}
            <a href="https://crm.doublehelixhub.com" target="_blank" rel="noopener noreferrer" className="lp-inline-link">
              Double Helix CRM
            </a>{' '}
            so agencies enroll on the front end and your operations team manages every member on MMS.
          </p>
          <div className="lp-hero-actions">
            <Link href="/login" className="lp-btn-primary"><ArrowIcon /> Sign In to MMS</Link>
            <a href="#enrollment" className="lp-btn-secondary"><PlayIcon /> See Enrollment Flow</a>
          </div>
        </div>
      </section>

      {/* Dashboard preview */}
      <div className="lp-dashboard-preview">
        <div className="lp-dashboard-frame">
          <div className="lp-dashboard-topbar">
            <span className="lp-dot-r" /><span className="lp-dot-y" /><span className="lp-dot-g" />
            <span className="lp-dashboard-url">admin.doublehelixhub.com · Benefits Enrollment & MMS</span>
          </div>
          <div className="lp-dashboard-body">
            <div className="lp-dash-sidebar">
              {['Dashboard', 'Enrollments', 'Members', 'Products', 'Agents', 'Billing', 'Commissions', 'Analytics'].map((item, i) => (
                <div key={item} className={`lp-dash-sidebar-item${i === 1 ? ' active' : ''}`}>
                  <span className="lp-dash-icon">{'■●◆★►□$◈'[i]}</span> {item}
                </div>
              ))}
            </div>
            <div className="lp-dash-main">
              <div className="lp-dash-stats" ref={statsRef}>
                <div className="lp-dash-stat">
                  <div className="lp-dash-stat-label">Enrollments This Month</div>
                  <div className="lp-dash-stat-value" data-counter-target="342">0</div>
                  <div className="lp-dash-stat-change up">+24.1% vs last month</div>
                </div>
                <div className="lp-dash-stat">
                  <div className="lp-dash-stat-label">Active Members (MMS)</div>
                  <div className="lp-dash-stat-value" data-counter-target="28470">0</div>
                  <div className="lp-dash-stat-change up">+8.6% this month</div>
                </div>
                <div className="lp-dash-stat">
                  <div className="lp-dash-stat-label">Monthly Billing</div>
                  <div className="lp-dash-stat-value" data-counter-target="1240000" data-counter-prefix="$">$0</div>
                  <div className="lp-dash-stat-change up">+6.3% this month</div>
                </div>
                <div className="lp-dash-stat">
                  <div className="lp-dash-stat-label">Enrollment Conversion</div>
                  <div className="lp-dash-stat-value" data-counter-target="68" data-counter-suffix="%">0%</div>
                  <div className="lp-dash-stat-change up">+4.2% vs last quarter</div>
                </div>
              </div>
              <div className="lp-dash-chart-row">
                <div className="lp-dash-chart">
                  <div className="lp-dash-chart-title">Enrollment Volume</div>
                  <div className="lp-chart-bars">
                    {barHeights.map((h, i) => (
                      <div key={i} className={`lp-chart-bar${i % 2 === 0 ? '' : ' alt'}`} style={{ height: `${h}%`, animationDelay: `${i * 0.08}s` }} />
                    ))}
                  </div>
                </div>
                <div className="lp-dash-chart">
                  <div className="lp-dash-chart-title">Live Operations</div>
                  <div className="lp-dash-activity">
                    {activities.map((a, i) => (
                      <div key={i} className="lp-activity-item" style={{ animationDelay: `${i * 0.15 + 0.5}s` }}>
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

      <div className="lp-ticker-bar">
        <div className="lp-ticker-track">
          {[...tickerItems, ...tickerItems].map((item, i) => (
            <span key={i} className="lp-ticker-item"><span className="lp-ticker-dot" /> {item}</span>
          ))}
        </div>
      </div>

      {/* Animated feature showcase */}
      <section id="enrollment" className="lp-showcase-section">
        <div className="lp-section-header lp-reveal">
          <div className="lp-section-badge">Benefits Enrollment + MMS</div>
          <h2>Enroll Members.<br/><span className="lp-gradient">Manage Them for Life.</span></h2>
          <p>From benefits application to active MMS member — enrollment, coverage, billing, and commissions in one continuous workflow.</p>
        </div>
        <div className="lp-showcase-wrap lp-reveal" data-delay="100">
          <div className="lp-showcase-nav">
            {showcaseModules.map((mod, i) => (
              <button
                key={mod.id}
                type="button"
                className={`lp-showcase-tab${activeShowcase === i ? ' active' : ''}`}
                onClick={() => { setActiveShowcase(i); setShowcaseProgress(0); }}
              >
                <div className="lp-showcase-tab-icon">{mod.icon}</div>
                <div>
                  <div className="lp-showcase-tab-title">{mod.title}</div>
                  <div className="lp-showcase-tab-desc">{mod.desc}</div>
                  {activeShowcase === i && (
                    <div className="lp-showcase-progress">
                      <div className="lp-showcase-progress-fill" style={{ width: `${showcaseProgress}%` }} />
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>

          <div className="lp-showcase-stage">
            <div className="lp-showcase-stage-header">
              <span className="lp-showcase-stage-title">
                <span className="lp-showcase-live-dot" />
                {showcaseModules[activeShowcase].stageTitle}
              </span>
              <span className="lp-demo-panel-badge">Live</span>
            </div>
            <div className="lp-showcase-stage-body">
              {showcaseModules.map((mod) => (
                <ShowcasePanel key={mod.id} moduleId={mod.id} active={mod.id === showcaseModules[activeShowcase].id} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="lp-section">
        <div className="lp-section-header lp-reveal">
          <div className="lp-section-badge">Benefits Enrollment & MMS</div>
          <h2>Enrollment Software.<br/><span className="lp-gradient">Member Management System.</span></h2>
          <p>Every capability your benefits operations team needs — digital enrollment, the MMS member registry, billing, commissions, and HIPAA compliance — unified in one platform.</p>
        </div>
        <div className="lp-features-grid">
          {features.map((f, i) => (
            <div key={f.title} className="lp-feature-card" data-delay={i * 100}>
              <div className={`lp-feature-icon ${f.color}`}>
                {featureIcons[f.icon as keyof typeof featureIcons]}
              </div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-metrics-section lp-section">
        <div className="lp-metrics-grid">
          {[
            { value: '50000', label: 'Members in MMS' },
            { value: '12000', label: 'Enrollments / Year' },
            { value: '99.9', label: 'Uptime SLA' },
            { value: '12000', label: 'Enrollments / Year' },
          ].map((m, i) => (
            <div key={m.label} className="lp-metric" data-delay={i * 150}>
              <div className="lp-metric-value" data-count={m.value}>0</div>
              <div className="lp-metric-label">{m.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="lp-section">
        <div className="lp-section-header lp-reveal">
          <div className="lp-section-badge">How It Works</div>
          <h2>Three Steps from<br/><span className="lp-gradient">Enrollment to MMS</span></h2>
          <p>Launch benefits enrollment and member management in weeks — not a patchwork of spreadsheets and disconnected tools.</p>
        </div>
        <div className="lp-workflow-steps">
          {[
            { n: '1', title: 'Configure Benefits & Plans', desc: 'Set up health sharing products, carriers, rate tables, enrollment forms, and commission rules. Import existing members into MMS.' },
            { n: '2', title: 'Enroll & Activate Members', desc: 'Run digital enrollment flows with e-signatures and dependent capture. Approved applications automatically land in the MMS member registry.' },
            { n: '3', title: 'Bill, Pay & Scale', desc: 'Automate billing tied to enrolled coverage, accrue agent commissions on enrollment, and scale your population without adding headcount.' },
          ].map((s, i) => (
            <div key={s.n} className="lp-workflow-step" data-delay={i * 200}>
              <div className={`lp-step-number step-${s.n}`}>{s.n}</div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="lp-glow-line" />

      <section id="demo" className="lp-section">
        <div className="lp-demo-container">
          <div className="lp-demo-text lp-reveal">
            <div className="lp-section-badge">MMS Member Registry</div>
            <h2>Every Enrolled Member.<br/><span className="lp-gradient">One MMS Registry.</span></h2>
            <p>When enrollment completes, members flow directly into MMS — coverage, dependents, billing, and enrollment history searchable in one place.</p>
            <div className="lp-demo-features">
              {[
                { icon: featureIcons.enrollment, title: 'Enrollment-to-MMS Handoff', desc: 'Approved enrollments auto-create member records with plan, dependents, and effective dates' },
                { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>, title: 'HIPAA-Compliant Registry', desc: 'Encrypted member and enrollment data with full audit trail on every view and edit' },
                { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/></svg>, title: 'Billing Linked to Coverage', desc: 'See payment status and invoice history inline with each enrolled member plan' },
              ].map((f) => (
                <div key={f.title} className="lp-demo-feature">
                  <div className="lp-demo-feature-icon">{f.icon}</div>
                  <div><h4>{f.title}</h4><p>{f.desc}</p></div>
                </div>
              ))}
            </div>
          </div>

          <div className="lp-demo-visual lp-reveal" data-delay="200">
            <div className="lp-demo-panel-header">
              <span className="lp-demo-panel-title">MMS Member Registry</span>
              <span className="lp-demo-panel-badge">Live</span>
            </div>
            <div ref={memberPanelRef} className="lp-demo-panel-body">
              {members.map((m) => (
                <div key={m.initials} className="lp-contact-card">
                  <div className="lp-contact-avatar" style={{ background: m.gradient }}>{m.initials}</div>
                  <div className="lp-contact-info">
                    <div className="lp-contact-name">{m.name}</div>
                    <div className="lp-contact-meta">{m.plan} — {m.detail}</div>
                  </div>
                  <span className={`lp-contact-status ${m.statusClass}`}>{m.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="testimonials" className="lp-section">
        <div className="lp-section-header lp-reveal">
          <div className="lp-section-badge">Benefits Operators</div>
          <h2>Enrollment + MMS.<br/><span className="lp-gradient">Proven at Scale.</span></h2>
        </div>
        <div className="lp-testimonials-grid">
          {testimonials.map((t, i) => (
            <div key={t.initials} className="lp-testimonial-card" data-delay={i * 150}>
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
          ))}
        </div>
      </section>

      <section className="lp-cta-section">
        <div className="lp-reveal">
          <h2>Ready to Run <span className="lp-gradient">Benefits Enrollment</span><br/>on MMS?</h2>
          <p>Join health sharing organizations that enroll members digitally and manage every lifecycle stage in one Member Management System.</p>
          <div className="lp-hero-actions">
            <Link href="/login" className="lp-btn-primary">Sign In to MMS <ArrowIcon /></Link>
            <a href="mailto:support@doublehelixhub.com" className="lp-btn-secondary">Contact Sales</a>
          </div>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-footer-grid">
          <div>
            <div className="lp-footer-brand">MMS — Benefits Enrollment & Member Management</div>
            <div className="lp-footer-desc">
              Double Helix MMS is benefits enrollment and member management software for health sharing
              organizations — enroll members, manage coverage in the MMS registry, run billing, and pay
              commissions. Part of the{' '}
              <a href="https://doublehelixhub.com" target="_blank" rel="noopener noreferrer" className="lp-inline-link">
                Double Helix Software
              </a>{' '}
              platform, paired with{' '}
              <a href="https://crm.doublehelixhub.com" target="_blank" rel="noopener noreferrer" className="lp-inline-link">
                CRM
              </a>{' '}
              for agency-side enrollment and end-to-end member operations.
            </div>
          </div>
          <div className="lp-footer-col">
            <h4>Platform</h4>
            <a href="https://admin.doublehelixhub.com" target="_blank" rel="noopener noreferrer">MMS Overview</a>
            <a href="https://crm.doublehelixhub.com" target="_blank" rel="noopener noreferrer">CRM</a>
            <a href="#features">Features</a>
            <a href="#enrollment">Platform Demo</a>
          </div>
          <div className="lp-footer-col">
            <h4>Resources</h4>
            <a href="https://doublehelixhub.com/security" target="_blank" rel="noopener noreferrer">Security</a>
            <a href="https://doublehelixhub.com/integrations" target="_blank" rel="noopener noreferrer">Integrations</a>
            <a href="#how-it-works">How it works</a>
            <a href="#testimonials">Testimonials</a>
          </div>
          <div className="lp-footer-col">
            <h4>Company</h4>
            <a href="https://doublehelixhub.com" target="_blank" rel="noopener noreferrer">About</a>
            <a href="mailto:support@doublehelixhub.com">Contact</a>
            <a href="https://doublehelixhub.com/legal/privacy" target="_blank" rel="noopener noreferrer">Privacy</a>
            <a href="https://doublehelixhub.com/legal/terms" target="_blank" rel="noopener noreferrer">Terms</a>
          </div>
        </div>
        <div className="lp-footer-bottom">
          <span>&copy; 2026 Double Helix Software. All rights reserved.</span>
          <span>
            <a href="https://doublehelixhub.com" target="_blank" rel="noopener noreferrer" className="lp-inline-link">
              doublehelixhub.com
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
