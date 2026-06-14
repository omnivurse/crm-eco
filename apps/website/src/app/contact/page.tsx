'use client';

import { useState } from 'react';
import {
  Input,
  Label,
  Textarea,
  Button,
  Card,
  CardContent,
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
  MessageCircle,
  Send,
} from 'lucide-react';

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

  return (
    <>
      {/* Hero Section */}
      <section className="relative overflow-hidden hub-inner-page-hero">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(20,184,166,0.12),transparent)]" />
        <div className="container mx-auto px-4 py-16 md:py-24 relative">
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight mb-4">
              Get in touch
            </h1>
            <p className="text-lg md:text-xl text-slate-600">
              We&apos;d love to hear from you
            </p>
          </div>
        </div>
      </section>

      {/* Two Column Layout */}
      <section className="section-padding bg-white">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 max-w-6xl mx-auto items-start">
            {/* Left: Contact Form */}
            <div>
              <Card className="border shadow-sm">
                <CardContent className="pt-6">
                  {submitted ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 rounded-full hub-icon-chip flex items-center justify-center mx-auto mb-4">
                        <Mail className="w-8 h-8 text-primary" />
                      </div>
                      <h3 className="text-xl font-semibold text-slate-900 mb-2">
                        Thank you for reaching out!
                      </h3>
                      <p className="text-slate-600 mb-6">
                        We&apos;ve received your message and will get back to you
                        within 1–2 business days.
                      </p>
                      <Button
                        variant="outline"
                        onClick={() => setSubmitted(false)}
                      >
                        Send another message
                      </Button>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-5">
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
                        className="w-full hub-btn-gradient text-white gap-2"
                      >
                        Send Message
                        <Send className="w-4 h-4" />
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right: Contact Info */}
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-6">
                  Contact Information
                </h2>
                <div className="space-y-5">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-xl hub-icon-chip flex items-center justify-center flex-shrink-0">
                      <Phone className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">Phone</p>
                      <p className="text-slate-600">(555) 123-4567</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-xl hub-icon-chip flex items-center justify-center flex-shrink-0">
                      <Mail className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">Email</p>
                      <a
                        href="mailto:support@doublehelixhub.com"
                        className="text-primary hover:text-cyan-700 hover:underline"
                      >
                        support@doublehelixhub.com
                      </a>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-xl hub-icon-chip flex items-center justify-center flex-shrink-0">
                      <Clock className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">
                        Office Hours
                      </p>
                      <p className="text-slate-600">
                        Mon–Fri 8am–6pm CST
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-xl hub-icon-chip flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">Address</p>
                      <p className="text-slate-600">
                        123 Health Share Way
                        <br />
                        Dallas, TX 75001
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Support Type Cards */}
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4">
                  How we can help
                </h3>
                <div className="grid gap-4">
                  <Card className="border shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="pt-4 pb-4 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg hub-icon-chip flex items-center justify-center flex-shrink-0">
                        <Phone className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">
                          Phone Support
                        </p>
                        <p className="text-sm text-slate-600">
                          Call us during office hours for immediate assistance
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="pt-4 pb-4 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg hub-icon-chip flex items-center justify-center flex-shrink-0">
                        <Mail className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">
                          Email Support
                        </p>
                        <p className="text-sm text-slate-600">
                          We typically respond within 1–2 business days
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border shadow-sm opacity-75">
                    <CardContent className="pt-4 pb-4 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                        <MessageCircle className="w-5 h-5 text-slate-400" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">
                          Live Chat
                        </p>
                        <p className="text-sm text-slate-500">
                          Coming soon
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
