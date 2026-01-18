'use client';

import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import {
  ArrowLeft,
  ArrowRight,
  User,
  Clock,
  CheckCircle,
  Camera,
  Mail,
  Phone,
  Lock,
  Bell,
  Globe,
} from 'lucide-react';
import { AnimatedDemo, StepList, QuickTip } from '@/components/learn/AnimatedDemo';

const DEMO_STEPS = [
  {
    title: 'Click Your Avatar',
    description: 'Click your profile picture or initials in the top-right corner.',
    cursor: { x: 92, y: 5 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Select Settings',
    description: 'Choose "Settings" from the dropdown menu.',
    cursor: { x: 88, y: 18 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Edit Profile Info',
    description: 'Update your name, email, and contact information.',
    highlight: { x: 20, y: 25, width: 60, height: 30 },
    cursor: { x: 50, y: 40 },
    action: 'click' as const,
    duration: 3000,
  },
  {
    title: 'Upload Photo',
    description: 'Click the camera icon to upload a profile picture.',
    highlight: { x: 25, y: 30, width: 15, height: 12 },
    cursor: { x: 32, y: 36 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Save Changes',
    description: 'Click "Save" to update your profile.',
    highlight: { x: 65, y: 65, width: 15, height: 6 },
    cursor: { x: 72, y: 68 },
    action: 'click' as const,
    duration: 2500,
  },
];

const PROFILE_SECTIONS = [
  { icon: <User className="w-5 h-5" />, title: 'Personal Info', description: 'Name, title, and department' },
  { icon: <Mail className="w-5 h-5" />, title: 'Email Settings', description: 'Email address and signature' },
  { icon: <Phone className="w-5 h-5" />, title: 'Contact Details', description: 'Phone numbers and timezone' },
  { icon: <Lock className="w-5 h-5" />, title: 'Security', description: 'Password and two-factor auth' },
  { icon: <Bell className="w-5 h-5" />, title: 'Notifications', description: 'Email and in-app alerts' },
  { icon: <Globe className="w-5 h-5" />, title: 'Preferences', description: 'Language and display settings' },
];

export default function ProfilePage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/crm/learn" className="text-slate-500 hover:text-teal-600 transition-colors">
          Learning Center
        </Link>
        <span className="text-slate-400">/</span>
        <Link href="/crm/learn/getting-started" className="text-slate-500 hover:text-teal-600 transition-colors">
          Getting Started
        </Link>
        <span className="text-slate-400">/</span>
        <span className="text-slate-900 dark:text-white font-medium">Setting Up Your Profile</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-6">
        <div className="flex-shrink-0 p-4 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-500">
          <User className="w-10 h-10 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Setting Up Your Profile
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Personalize your account with your information and preferences.
          </p>
          <div className="flex items-center gap-4 mt-4 text-sm text-slate-500">
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              2 min read
            </span>
          </div>
        </div>
      </div>

      {/* Video Demo */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Interactive Demo
        </h2>
        <AnimatedDemo
          title="Setting Up Your Profile"
          steps={DEMO_STEPS}
        />
      </section>

      {/* Why Set Up Profile */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Why Complete Your Profile?
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          A complete profile helps your team identify you and ensures you receive the right
          notifications. It also personalizes your email communications with contacts.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { icon: <Camera className="w-5 h-5" />, title: 'Photo Recognition', description: 'Team members can identify you easily' },
            { icon: <Mail className="w-5 h-5" />, title: 'Email Signature', description: 'Your info appears in outgoing emails' },
            { icon: <Bell className="w-5 h-5" />, title: 'Notifications', description: 'Get alerts how and when you want' },
            { icon: <Globe className="w-5 h-5" />, title: 'Timezone', description: 'See dates/times in your local timezone' },
          ].map((feature) => (
            <div
              key={feature.title}
              className="flex items-start gap-3 p-4 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700"
            >
              <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400">
                {feature.icon}
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">{feature.title}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Profile Sections */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Profile Sections
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {PROFILE_SECTIONS.map((section) => (
            <div
              key={section.title}
              className="flex items-center gap-3 p-4 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700"
            >
              <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                {section.icon}
              </div>
              <div>
                <h3 className="font-medium text-slate-900 dark:text-white">{section.title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{section.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Step by Step */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Step-by-Step Guide
        </h2>
        <StepList
          steps={[
            {
              title: 'Access Your Profile',
              description: 'Click your avatar in the top-right, then select "Settings".',
            },
            {
              title: 'Upload a Photo',
              description: 'Click the camera icon and upload a professional headshot (JPG or PNG, max 5MB).',
            },
            {
              title: 'Update Personal Info',
              description: 'Enter your full name, job title, and department.',
            },
            {
              title: 'Add Contact Details',
              description: 'Add your phone number and set your timezone.',
            },
            {
              title: 'Configure Notifications',
              description: 'Choose which notifications you want to receive via email or in-app.',
            },
            {
              title: 'Set Your Email Signature',
              description: 'Create an email signature that appears on all outgoing emails.',
            },
          ]}
        />
      </section>

      {/* Tips */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Profile Tips
        </h2>
        <div className="space-y-4">
          <QuickTip title="Use a Clear Photo" type="tip">
            Choose a professional, well-lit headshot. This helps teammates and
            contacts recognize you in communications.
          </QuickTip>
          <QuickTip title="Set Your Timezone" type="info">
            Setting the correct timezone ensures that scheduled emails, tasks,
            and calendar events display accurately.
          </QuickTip>
          <QuickTip title="Enable Two-Factor Authentication" type="warning">
            For better security, enable 2FA in the Security section. This adds
            an extra layer of protection to your account.
          </QuickTip>
        </div>
      </section>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-8">
        <Link href="/crm/learn/getting-started/dashboard">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Previous: Dashboard
          </Button>
        </Link>
        <Link href="/crm/learn/getting-started/navigation">
          <Button className="gap-2">
            Next: Navigating the CRM
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
