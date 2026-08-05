'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Input,
  Label,
  Textarea,
  Button,
} from '@crm-eco/ui';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui';
import {
  Mail,
  Phone,
  MapPin,
  Clock,
  LifeBuoy,
  Send,
  CheckCircle2,
  Users,
  ArrowRight,
  MessageCircle,
} from 'lucide-react';
import { Reveal } from '@/components/sections/Reveal';
import {
  Container,
  Eyebrow,
  SectionHeading,
  IconChip,
  CTABand,
} from '@/components/sections/blocks';
import { PHONE, EMAIL, ADDRESS, PORTAL_URL } from '@/lib/site';

const SUBJECT_OPTIONS = [
  'General Inquiry',
  'Membership Question',
  'Billing Question',
  'Partnership',
  'Other',
] as const;

type SubjectType = (typeof SUBJECT_OPTIONS)[number];

interface FormState {
  name: string;
  email: string;
  subject: SubjectType | '';
  message: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function ContactPage() {
  const [form, setForm] = useState<FormState>({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (
    field: keyof FormState,
    value: string
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    if (!form.name.trim()) {
      newErrors.name = 'Name is required';
    }
    if (!form.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(form.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    if (!form.subject) {
      newErrors.subject = 'Please select a subject';
    }
    if (!form.message.trim()) {
      newErrors.message = 'Message is required';
    } else if (form.message.trim().length < 10) {
      newErrors.message = 'Message must be at least 10 characters';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    // In production, you would send to an API or server action
    setSubmitted(true);
    setForm({ name: '', email: '', subject: '', message: '' });
    setErrors({});
  };

  const CONTACT_DETAILS = [
    {
      icon: Phone,
      label: 'Call our member care team',
      value: PHONE.display,
      href: `tel:${PHONE.tel}`,
      note: 'Real people, ready to help with enrollment and sharing questions.',
    },
    {
      icon: MapPin,
      label: 'Mailing address',
      value: ADDRESS.display,
      href: ADDRESS.mapsUrl,
      note: 'Correspondence and member mail for Pay It Forward Health.',
      external: true,
    },
    {
      icon: Mail,
      label: 'General questions',
      value: EMAIL.general,
      href: `mailto:${EMAIL.general}`,
      note: 'New to sharing? Start here and we will point you the right way.',
    },
    {
      icon: LifeBuoy,
      label: 'Member support',
      value: EMAIL.support,
      href: `mailto:${EMAIL.support}`,
      note: 'Already a member? Reach our support team for help with your account.',
    },
  ];

  return (
    <>
      {/* ---------------------------------------------------------------- Hero */}
      <section className="relative overflow-hidden hub-inner-page-hero">
        <Container className="py-20 md:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <Eyebrow className="mb-4">We&apos;re here for you</Eyebrow>
            <h1 className="font-heading text-[clamp(2.25rem,5vw,3.5rem)] font-semibold leading-[1.1] text-pif-navy-800 text-balance">
              Let&apos;s talk about{' '}
              <span className="gradient-text">caring for your health</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
              Whether you&apos;re exploring health-care sharing for the first time
              or you&apos;re already part of the community, our team is glad to
              help. Send us a note or reach out directly — every question is
              welcome.
            </p>
            <div className="mt-8 inline-flex items-center gap-2 rounded-full bg-pif-green-50 px-4 py-2 text-sm font-semibold text-pif-green-700 ring-1 ring-pif-green-100">
              <Users className="h-4 w-4" />
              Welcoming to all — no requirements, no judgment
            </div>
          </div>
        </Container>
      </section>

      {/* ---------------------------------------------- Form + contact details */}
      <section className="bg-white py-20 md:py-28">
        <Container>
          <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-16">
            {/* Left: Contact Form */}
            <Reveal>
              <div className="rounded-3xl border border-pif-navy-100 bg-white p-8 shadow-xl shadow-pif-navy/10 ring-1 ring-pif-navy/5 sm:p-10">
                {submitted ? (
                  <div className="py-12 text-center">
                    <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full pif-grad-care text-white shadow-md shadow-pif-teal/25">
                      <CheckCircle2 className="h-8 w-8" />
                    </span>
                    <h2 className="font-heading text-2xl font-semibold text-pif-navy-800">
                      Thank you for reaching out!
                    </h2>
                    <p className="mx-auto mt-3 max-w-sm leading-relaxed text-slate-600">
                      We&apos;ve received your message and a real member of our
                      team will get back to you within 1&ndash;2 business days.
                    </p>
                    <Button
                      variant="outline"
                      className="mt-7 border-pif-navy/15 font-semibold text-pif-navy-800 hover:bg-pif-mist"
                      onClick={() => setSubmitted(false)}
                    >
                      Send another message
                    </Button>
                  </div>
                ) : (
                  <>
                    <Eyebrow className="mb-3">Send a message</Eyebrow>
                    <h2 className="font-heading text-2xl font-semibold text-pif-navy-800">
                      Tell us how we can help
                    </h2>
                    <p className="mt-3 leading-relaxed text-slate-600">
                      Fill out the form below and we&apos;ll be in touch soon.
                      There&apos;s no pressure and no sales script — just answers.
                    </p>
                    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                      <div className="space-y-2">
                        <Label htmlFor="name">Name</Label>
                        <Input
                          id="name"
                          placeholder="Your name"
                          value={form.name}
                          onChange={(e) =>
                            handleChange('name', e.target.value)
                          }
                          className={errors.name ? 'border-red-500' : ''}
                        />
                        {errors.name && (
                          <p className="text-sm text-red-600">{errors.name}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="you@example.com"
                          value={form.email}
                          onChange={(e) =>
                            handleChange('email', e.target.value)
                          }
                          className={errors.email ? 'border-red-500' : ''}
                        />
                        {errors.email && (
                          <p className="text-sm text-red-600">{errors.email}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="subject">Subject</Label>
                        <Select
                          value={form.subject}
                          onValueChange={(v) =>
                            handleChange('subject', v as SubjectType)
                          }
                        >
                          <SelectTrigger
                            id="subject"
                            className={errors.subject ? 'border-red-500' : ''}
                          >
                            <SelectValue placeholder="Select a subject" />
                          </SelectTrigger>
                          <SelectContent>
                            {SUBJECT_OPTIONS.map((opt) => (
                              <SelectItem key={opt} value={opt}>
                                {opt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {errors.subject && (
                          <p className="text-sm text-red-600">
                            {errors.subject}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="message">Message</Label>
                        <Textarea
                          id="message"
                          placeholder="How can we help you?"
                          rows={5}
                          value={form.message}
                          onChange={(e) =>
                            handleChange('message', e.target.value)
                          }
                          className={
                            errors.message ? 'border-red-500' : ''
                          }
                        />
                        {errors.message && (
                          <p className="text-sm text-red-600">
                            {errors.message}
                          </p>
                        )}
                      </div>
                      <Button
                        type="submit"
                        className="w-full gap-2 hub-btn-gradient text-white"
                      >
                        Send Message
                        <Send className="h-4 w-4" />
                      </Button>
                      <p className="text-center text-sm text-slate-500">
                        We typically reply within 1&ndash;2 business days.
                      </p>
                    </form>
                  </>
                )}
              </div>
            </Reveal>

            {/* Right: Contact details */}
            <Reveal delay={0.1}>
              <div className="lg:pl-4">
                <SectionHeading
                  align="left"
                  eyebrow="Reach us directly"
                  title="Other ways to connect"
                  subtitle="Prefer a phone call or email? Use whichever way feels easiest — we'll meet you there."
                />

                <div className="mt-9 space-y-6">
                  {CONTACT_DETAILS.map((d) => (
                    <a
                      key={d.label}
                      href={d.href}
                      {...('external' in d && d.external
                        ? { target: '_blank', rel: 'noopener noreferrer' }
                        : {})}
                      className="group flex gap-4 rounded-2xl border border-pif-navy-100 bg-white p-5 shadow-sm ring-1 ring-pif-navy/5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-pif-navy/10"
                    >
                      <IconChip icon={d.icon} variant="soft" className="flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-slate-500">
                          {d.label}
                        </p>
                        <p className="mt-0.5 font-heading text-lg font-semibold text-pif-navy-800 transition-colors group-hover:text-pif-teal-700">
                          {d.value}
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-slate-600">
                          {d.note}
                        </p>
                      </div>
                    </a>
                  ))}
                </div>

                {/* Office hours */}
                <div className="mt-6 flex items-start gap-4 rounded-2xl bg-pif-mist p-5 ring-1 ring-pif-navy/5">
                  <IconChip icon={Clock} variant="soft" className="flex-shrink-0" />
                  <div>
                    <p className="font-heading text-lg font-semibold text-pif-navy-800">
                      When we&apos;re available
                    </p>
                    <p className="mt-0.5 text-slate-600">
                      Monday&ndash;Friday, 8am&ndash;6pm CT
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                      Outside these hours? Leave a message and we&apos;ll follow
                      up the next business day.
                    </p>
                  </div>
                </div>

                {/* Member portal callout */}
                <div className="mt-6 overflow-hidden rounded-2xl hub-section-dark p-7 shadow-lg shadow-pif-navy/20">
                  <div className="flex items-start gap-4">
                    <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-white/10 text-pif-gold-300 ring-1 ring-white/15">
                      <MessageCircle className="h-6 w-6" />
                    </span>
                    <div>
                      <p className="font-heading text-lg font-semibold text-white">
                        Already a member?
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-white/80">
                        Manage your membership, view sharing requests, and update
                        your household anytime in the member portal.
                      </p>
                      <Link
                        href={PORTAL_URL}
                        className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-pif-gold-300 transition-colors hover:text-pif-gold-200"
                      >
                        Go to the member portal
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </Container>
      </section>

      {/* ---------------------------------------------------------------- CTA */}
      <CTABand
        title="Have a question we didn't cover?"
        subtitle="Explore how community health-care sharing works, or take the first step and join thousands of families who've chosen a more caring way."
        primary={{ label: 'Become a Member', href: '/enroll' }}
        secondary={{ label: 'How It Works', href: '/how-it-works' }}
      />
    </>
  );
}
