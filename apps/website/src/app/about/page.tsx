'use client';

import Link from 'next/link';
import { Button } from '@crm-eco/ui';
import { Card, CardContent } from '@crm-eco/ui';
import {
  Users,
  Eye,
  Heart,
  Leaf,
  ArrowRight,
  Sparkles,
  Target,
  TrendingUp,
  Globe,
  Rocket,
  UserCircle,
} from 'lucide-react';
import { motion } from 'framer-motion';

const coreValues = [
  {
    title: 'Community',
    description:
      'We believe healthcare works best when neighbors support neighbors. Our members form a caring network that shares both costs and compassion.',
    icon: Users,
  },
  {
    title: 'Transparency',
    description:
      'No hidden fees, no surprise bills. We show exactly where your contributions go and how needs are shared. Clear, honest, and straightforward.',
    icon: Eye,
  },
  {
    title: 'Generosity',
    description:
      'Paying it forward means giving today so others can receive tomorrow. Our members give willingly, knowing the community will be there when they need it.',
    icon: Heart,
  },
  {
    title: 'Wellness',
    description:
      'We promote preventive care and healthy living. A healthier community means fewer needs to share and more resources for everyone.',
    icon: Leaf,
  },
];

const timeline = [
  {
    year: '2018',
    title: 'Founded with a Vision',
    description:
      'Double Helix Hub was born from a simple idea: what if healthcare could be affordable, transparent, and community-driven?',
    icon: Target,
  },
  {
    year: '2020',
    title: 'Growing Community',
    description:
      'Thousands of families joined our sharing community. We processed our first million in shared medical needs.',
    icon: TrendingUp,
  },
  {
    year: '2023',
    title: 'Expanding Reach',
    description:
      'We launched new plans, improved our platform, and extended support to more families across the country.',
    icon: Globe,
  },
  {
    year: 'Today',
    title: 'Future Goals',
    description:
      'We continue to innovate, grow our community, and make health sharing more accessible to families everywhere.',
    icon: Rocket,
  },
];

const teamMembers = [
  { name: 'Sarah Chen', role: 'Chief Executive Officer', bio: 'Leading our mission to make healthcare accessible through community.' },
  { name: 'Michael Torres', role: 'Chief Operations Officer', bio: 'Ensuring smooth operations and member experience.' },
  { name: 'Emily Watson', role: 'Head of Member Services', bio: 'Building relationships and supporting our community.' },
  { name: 'James Park', role: 'Director of Technology', bio: 'Developing platforms that make sharing simple.' },
  { name: 'Rachel Green', role: 'Director of Compliance', bio: 'Keeping our programs transparent and compliant.' },
  { name: 'David Kim', role: 'Community Outreach Lead', bio: 'Connecting with families and spreading the word.' },
];

export default function AboutPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-teal-50/30 to-emerald-50/20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(20,184,166,0.12),transparent)]" />
        <div className="container mx-auto px-4 py-20 md:py-32 relative">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-full px-4 py-1.5 mb-6">
              <Sparkles className="w-4 h-4 text-teal-600" />
              <span className="text-sm font-medium text-teal-700">
                Our Mission
              </span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-slate-900 tracking-tight mb-6">
              Empowering communities through{' '}
              <span className="bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-transparent">
                shared healthcare
              </span>
            </h1>
            <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
              We believe healthcare should be affordable, transparent, and built on
              the power of community. Double Helix Hub brings neighbors together
              to share medical expenses — and hope.
            </p>
          </div>
        </div>
      </section>

      {/* Core Values Grid */}
      <section className="section-padding bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Our Core Values
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              The principles that guide everything we do at Double Helix Hub.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {coreValues.map((value, index) => (
              <motion.div
                key={value.title}
                initial="initial"
                whileInView="animate"
                viewport={{ once: true, margin: '-50px' }}
                variants={{
                  initial: { opacity: 0, y: 20 },
                  animate: { opacity: 1, y: 0 },
                }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                <Card className="h-full border shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center mb-4">
                      <value.icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold text-slate-900 mb-2">
                      {value.title}
                    </h3>
                    <p className="text-slate-600 leading-relaxed">
                      {value.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Story / Timeline Section */}
      <section className="section-padding bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Our Story
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              From a vision to a thriving community — here&apos;s how we got here.
            </p>
          </div>

          <div className="max-w-4xl mx-auto space-y-8">
            {timeline.map((item, index) => (
              <motion.div
                key={item.year}
                initial="initial"
                whileInView="animate"
                viewport={{ once: true, margin: '-50px' }}
                variants={{
                  initial: { opacity: 0, x: index % 2 === 0 ? -20 : 20 },
                  animate: { opacity: 1, x: 0 },
                }}
                transition={{ duration: 0.5 }}
                className="flex gap-6 items-start"
              >
                <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center">
                  <item.icon className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1">
                  <span className="inline-block text-sm font-semibold text-teal-600 mb-1">
                    {item.year}
                  </span>
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">
                    {item.title}
                  </h3>
                  <p className="text-slate-600 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="section-padding bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Meet Our Team
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              The people behind Double Helix Hub — dedicated to serving our community.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {teamMembers.map((member, index) => (
              <motion.div
                key={member.name}
                initial="initial"
                whileInView="animate"
                viewport={{ once: true, margin: '-50px' }}
                variants={{
                  initial: { opacity: 0, y: 20 },
                  animate: { opacity: 1, y: 0 },
                }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
              >
                <Card className="h-full border shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                      <UserCircle className="w-10 h-10 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      {member.name}
                    </h3>
                    <p className="text-sm font-medium text-teal-600 mb-2">
                      {member.role}
                    </p>
                    <p className="text-slate-600 text-sm leading-relaxed">
                      {member.bio}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative overflow-hidden bg-gradient-to-r from-teal-600 to-emerald-600 py-20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.1),transparent_70%)]" />
        <div className="container mx-auto px-4 relative text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Join Our Community
          </h2>
          <p className="text-lg text-teal-100 mb-8 max-w-2xl mx-auto">
            Become part of a community that cares. Start your enrollment today and
            experience healthcare the way it should be.
          </p>
          <Link href="/enroll">
            <Button
              size="lg"
              className="bg-white text-teal-700 hover:bg-teal-50 shadow-lg gap-2"
            >
              Get Started
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>
    </>
  );
}
