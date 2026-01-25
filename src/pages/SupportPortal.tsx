import { Link } from 'react-router-dom';
import {
  Ticket, BookOpen, Mail, Users, Briefcase, Headphones, Shield, Phone,
  Check, Zap, MessageSquare, BarChart, Sparkles, ArrowRight, ChevronRight
} from 'lucide-react';
import { Logo } from '../components/ui/Logo';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export default function SupportPortal() {
  const [counts, setCounts] = useState({
    tickets: 0,
    satisfaction: 0,
    responseTime: 0
  });

  useEffect(() => {
    const animateCount = (target: number, setter: (val: number) => void, duration: number) => {
      const steps = 60;
      const increment = target / steps;
      let current = 0;

      const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
          setter(target);
          clearInterval(timer);
        } else {
          setter(Math.floor(current));
        }
      }, duration / steps);

      return timer;
    };

    const timer1 = animateCount(15000, (val) => setCounts(prev => ({ ...prev, tickets: val })), 2000);
    const timer2 = animateCount(98, (val) => setCounts(prev => ({ ...prev, satisfaction: val })), 2000);
    const timer3 = animateCount(2, (val) => setCounts(prev => ({ ...prev, responseTime: val })), 1500);

    return () => {
      clearInterval(timer1);
      clearInterval(timer2);
      clearInterval(timer3);
    };
  }, []);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-slate-950">
      {/* Hero Section */}
      <section className="enterprise-hero-modern">
        <div className="enterprise-hero-grid">
          <motion.div
            className="enterprise-hero-left"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="mb-6">
              <Logo size="large" animated className="mb-4" />
            </div>

            <div className="enterprise-hero-eyebrow">
              <Sparkles size={16} />
              ENTERPRISE IT SERVICE MANAGEMENT
            </div>

            <h1 className="enterprise-hero-title">
              Transform Your IT Operations
            </h1>

            <p className="enterprise-hero-subtitle">
              Streamline support, automate workflows, and deliver exceptional service with our comprehensive ITSM platform built for modern healthcare organizations.
            </p>

            <div className="enterprise-hero-features">
              <div className="enterprise-hero-feature">
                <Check size={20} />
                <span>AI-Powered Ticketing</span>
              </div>
              <div className="enterprise-hero-feature">
                <Check size={20} />
                <span>Multi-Channel Support</span>
              </div>
              <div className="enterprise-hero-feature">
                <Check size={20} />
                <span>Real-Time Analytics</span>
              </div>
              <div className="enterprise-hero-feature">
                <Check size={20} />
                <span>24/7 Availability</span>
              </div>
            </div>

            <div className="enterprise-hero-ctas">
              <Link to="/signup" className="btn-hero-primary">
                Get Started Free
                <ArrowRight size={20} />
              </Link>
              <Link to="/kb" className="btn-hero-secondary">
                <BookOpen size={20} />
                Browse Knowledge Base
              </Link>
            </div>

            <div className="enterprise-hero-trust">
              Trusted by 500+ healthcare organizations nationwide
            </div>
          </motion.div>

          <motion.div
            className="enterprise-hero-right"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <div className="glass-card p-8 animate-float">
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-white/10 rounded-lg">
                  <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center">
                    <Check className="text-white" size={24} />
                  </div>
                  <div>
                    <div className="text-white font-semibold">Ticket Resolved</div>
                    <div className="text-white/70 text-sm">TKT-87563 closed in 45 min</div>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 bg-white/10 rounded-lg">
                  <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center">
                    <Zap className="text-white" size={24} />
                  </div>
                  <div>
                    <div className="text-white font-semibold">Workflow Automated</div>
                    <div className="text-white/70 text-sm">Auto-assigned to Sarah M.</div>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 bg-white/10 rounded-lg">
                  <div className="w-12 h-12 rounded-full bg-purple-500 flex items-center justify-center">
                    <BarChart className="text-white" size={24} />
                  </div>
                  <div>
                    <div className="text-white font-semibold">SLA Met</div>
                    <div className="text-white/70 text-sm">98% compliance this month</div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats Banner */}
      <section className="stats-banner">
        <div className="stats-grid">
          <motion.div
            className="stat-item"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            <div className="stat-value">{counts.tickets.toLocaleString()}+</div>
            <div className="stat-label">Tickets Resolved</div>
          </motion.div>
          <motion.div
            className="stat-item"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <div className="stat-value">{counts.satisfaction}%</div>
            <div className="stat-label">Satisfaction Rate</div>
          </motion.div>
          <motion.div
            className="stat-item"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
          >
            <div className="stat-value">&lt;{counts.responseTime}h</div>
            <div className="stat-label">Response Time</div>
          </motion.div>
          <motion.div
            className="stat-item"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
          >
            <div className="stat-value">24/7</div>
            <div className="stat-label">Support Available</div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="feature-showcase">
        <div className="section-header">
          <div className="section-eyebrow">POWERFUL FEATURES</div>
          <h2 className="section-title">Everything You Need to Excel</h2>
          <p className="section-description">
            Built for modern IT teams who demand efficiency, visibility, and control
          </p>
        </div>

        <div className="feature-grid">
          <motion.div
            className="feature-card"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            <div className="feature-icon">
              <Sparkles size={32} />
            </div>
            <h3 className="feature-title">Intelligent Ticketing</h3>
            <p className="feature-description">
              AI-powered routing and prioritization ensures tickets reach the right team members instantly.
            </p>
            <Link to="/tickets" className="feature-link">
              Learn more <ChevronRight size={16} />
            </Link>
          </motion.div>

          <motion.div
            className="feature-card"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <div className="feature-icon">
              <MessageSquare size={32} />
            </div>
            <h3 className="feature-title">Multi-Channel Support</h3>
            <p className="feature-description">
              Email, phone, chat, and portal support unified in one seamless platform.
            </p>
            <Link to="/kb" className="feature-link">
              Learn more <ChevronRight size={16} />
            </Link>
          </motion.div>

          <motion.div
            className="feature-card"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
          >
            <div className="feature-icon">
              <BookOpen size={32} />
            </div>
            <h3 className="feature-title">Knowledge Base</h3>
            <p className="feature-description">
              Empower users with self-service documentation and searchable articles.
            </p>
            <Link to="/kb" className="feature-link">
              Learn more <ChevronRight size={16} />
            </Link>
          </motion.div>

          <motion.div
            className="feature-card"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
          >
            <div className="feature-icon">
              <BarChart size={32} />
            </div>
            <h3 className="feature-title">Real-Time Analytics</h3>
            <p className="feature-description">
              Actionable insights and reports to optimize your support operations.
            </p>
            <Link to="/analytics" className="feature-link">
              Learn more <ChevronRight size={16} />
            </Link>
          </motion.div>

          <motion.div
            className="feature-card"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 }}
          >
            <div className="feature-icon">
              <Users size={32} />
            </div>
            <h3 className="feature-title">Team Collaboration</h3>
            <p className="feature-description">
              Internal notes, assignments, and team chat keep everyone synchronized.
            </p>
            <Link to="/collaboration" className="feature-link">
              Learn more <ChevronRight size={16} />
            </Link>
          </motion.div>

          <motion.div
            className="feature-card"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.6 }}
          >
            <div className="feature-icon">
              <Zap size={32} />
            </div>
            <h3 className="feature-title">Automated Workflows</h3>
            <p className="feature-description">
              Custom automation rules and SLA management save time and reduce errors.
            </p>
            <Link to="/admin/workflows" className="feature-link">
              Learn more <ChevronRight size={16} />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Portal Access Section */}
      <section className="portal-access-section">
        <div className="section-header">
          <div className="section-eyebrow">ACCESS YOUR PORTAL</div>
          <h2 className="section-title">Choose Your Entry Point</h2>
          <p className="section-description">
            Select the portal that matches your role for a tailored experience
          </p>
        </div>

        <div className="portal-grid">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            <Link to="/support/member" className="portal-card-enhanced">
              <div className="portal-icon-large" style={{ background: 'linear-gradient(135deg, #0A4E8E 0%, #147BC6 100%)' }}>
                <Users className="text-white" size={36} />
              </div>
              <div className="portal-content">
                <h3 className="portal-title">Member Portal</h3>
                <p className="portal-description">
                  Submit and track support tickets as a member
                </p>
              </div>
              <ChevronRight className="portal-arrow" size={24} />
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <Link to="/support/concierge" className="portal-card-enhanced">
              <div className="portal-icon-large" style={{ background: 'linear-gradient(135deg, #0891B2 0%, #06B6D4 100%)' }}>
                <Headphones className="text-white" size={36} />
              </div>
              <div className="portal-content">
                <h3 className="portal-title">Concierge Portal</h3>
                <p className="portal-description">
                  Submit tickets on behalf of members
                </p>
              </div>
              <ChevronRight className="portal-arrow" size={24} />
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
          >
            <Link to="/login/advisor" className="portal-card-enhanced">
              <div className="portal-icon-large" style={{ background: 'linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)' }}>
                <Briefcase className="text-white" size={36} />
              </div>
              <div className="portal-content">
                <h3 className="portal-title">Advisor Dashboard</h3>
                <p className="portal-description">
                  Access your advisor tools and resources
                </p>
              </div>
              <ChevronRight className="portal-arrow" size={24} />
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
          >
            <Link to="/login/staff" className="portal-card-enhanced">
              <div className="portal-icon-large" style={{ background: 'linear-gradient(135deg, #475569 0%, #64748B 100%)' }}>
                <Shield className="text-white" size={36} />
              </div>
              <div className="portal-content">
                <h3 className="portal-title">Staff & Admin</h3>
                <p className="portal-description">
                  Internal team dashboard and admin tools
                </p>
              </div>
              <ChevronRight className="portal-arrow" size={24} />
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 }}
          >
            <Link to="/kb" className="portal-card-enhanced">
              <div className="portal-icon-large" style={{ background: 'linear-gradient(135deg, #16A34A 0%, #22C55E 100%)' }}>
                <BookOpen className="text-white" size={36} />
              </div>
              <div className="portal-content">
                <h3 className="portal-title">Knowledge Base</h3>
                <p className="portal-description">
                  Find answers to common questions
                </p>
              </div>
              <ChevronRight className="portal-arrow" size={24} />
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.6 }}
          >
            <a href="tel:+15612036529,1012" className="portal-card-enhanced">
              <div className="portal-icon-large" style={{ background: 'linear-gradient(135deg, #3B82F6 0%, #60A5FA 100%)' }}>
                <Phone className="text-white" size={36} />
              </div>
              <div className="portal-content">
                <h3 className="portal-title">Call IT Support</h3>
                <p className="portal-description">
                  +1 (561) 203-6529 ext 1012
                </p>
              </div>
              <ChevronRight className="portal-arrow" size={24} />
            </a>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="cta-content">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="cta-title">Ready to Transform Your IT Support?</h2>
            <p className="cta-description">
              Join hundreds of healthcare organizations delivering exceptional service with MPB Health IT
            </p>
            <div className="cta-buttons">
              <Link to="/signup" className="btn-hero-primary">
                Create Your Account
                <ArrowRight size={20} />
              </Link>
              <Link to="/login" className="btn-hero-secondary">
                Sign In
              </Link>
            </div>
            <p className="cta-disclaimer">
              No credit card required • Free 30-day trial • Cancel anytime
            </p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-neutral-900 text-white py-12 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <Logo size="medium" className="inline-block mb-4" />
          <p className="text-neutral-400 mb-4">
            Enterprise IT Service Management for Healthcare Organizations
          </p>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-neutral-400">
            <a href="mailto:support@mympb.com" className="hover:text-white transition-colors">
              <Mail className="inline mr-2" size={16} />
              support@mympb.com
            </a>
            <a href="tel:+15612036529,1012" className="hover:text-white transition-colors">
              <Phone className="inline mr-2" size={16} />
              (561) 203-6529 ext 1012
            </a>
          </div>
          <p className="text-neutral-500 text-sm mt-8">
            &copy; {new Date().getFullYear()} MPB Health. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
