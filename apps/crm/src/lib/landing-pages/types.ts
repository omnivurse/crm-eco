// ── Section Types ──────────────────────────────────────────────
export type SectionType =
  | 'hero'
  | 'content'
  | 'features'
  | 'form'
  | 'pricing'
  | 'testimonials'
  | 'cta'
  | 'faq'
  | 'custom_html';

// ── Per-section data ───────────────────────────────────────────
export interface HeroSectionData {
  headline: string;
  subheadline: string;
  backgroundImageUrl: string;
  backgroundColor: string;
  ctaText: string;
  ctaLink: string;
  layout: 'centered' | 'left-aligned' | 'split';
}

export interface ContentSectionData {
  heading: string;
  bodyHtml: string;
  imageUrl: string;
  imagePosition: 'left' | 'right' | 'background' | 'none';
}

export interface FeatureItem {
  id: string;
  icon: string;
  title: string;
  description: string;
}

export interface FeaturesSectionData {
  title: string;
  subtitle: string;
  items: FeatureItem[];
  columns: 2 | 3 | 4;
}

export type FormFieldType = 'text' | 'email' | 'phone' | 'select' | 'textarea' | 'checkbox' | 'date' | 'number';

export interface FormField {
  id: string;
  type: FormFieldType;
  label: string;
  placeholder: string;
  required: boolean;
  options?: string[]; // for select
}

export interface FormSectionData {
  title: string;
  description: string;
  fields: FormField[];
  submitButtonText: string;
  successMessage: string;
}

export interface PricingTier {
  id: string;
  planName: string;
  price: string;
  period: string;
  features: string[];
  ctaText: string;
  highlighted: boolean;
}

export interface PricingSectionData {
  title: string;
  subtitle: string;
  tiers: PricingTier[];
}

export interface Testimonial {
  id: string;
  name: string;
  role: string;
  company: string;
  quote: string;
  avatarUrl: string;
}

export interface TestimonialsSectionData {
  title: string;
  items: Testimonial[];
}

export interface CtaSectionData {
  headline: string;
  description: string;
  primaryButtonText: string;
  primaryButtonLink: string;
  secondaryButtonText: string;
  secondaryButtonLink: string;
  backgroundColor: string;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface FaqSectionData {
  title: string;
  items: FaqItem[];
}

export interface CustomHtmlSectionData {
  html: string;
}

// ── Section data union ─────────────────────────────────────────
export type SectionDataMap = {
  hero: HeroSectionData;
  content: ContentSectionData;
  features: FeaturesSectionData;
  form: FormSectionData;
  pricing: PricingSectionData;
  testimonials: TestimonialsSectionData;
  cta: CtaSectionData;
  faq: FaqSectionData;
  custom_html: CustomHtmlSectionData;
};

// ── Landing Page Section ───────────────────────────────────────
export interface LandingPageSection<T extends SectionType = SectionType> {
  id: string;
  type: T;
  title: string;
  data: SectionDataMap[T];
  visible: boolean;
}

// ── Section palette metadata ───────────────────────────────────
export interface SectionTemplate {
  type: SectionType;
  label: string;
  icon: string;
  description: string;
}

export const SECTION_TEMPLATES: SectionTemplate[] = [
  { type: 'hero', label: 'Hero Banner', icon: 'layout', description: 'Full-width hero with headline and CTA' },
  { type: 'content', label: 'Content Block', icon: 'file-text', description: 'Rich text with optional image' },
  { type: 'features', label: 'Features Grid', icon: 'grid', description: 'Feature cards in a grid layout' },
  { type: 'form', label: 'Form / Quote', icon: 'clipboard', description: 'Contact or request-a-quote form' },
  { type: 'pricing', label: 'Pricing Table', icon: 'dollar-sign', description: 'Pricing tiers comparison' },
  { type: 'testimonials', label: 'Testimonials', icon: 'message-circle', description: 'Customer testimonials' },
  { type: 'cta', label: 'Call to Action', icon: 'zap', description: 'Call-to-action banner' },
  { type: 'faq', label: 'FAQ', icon: 'help-circle', description: 'Frequently asked questions' },
  { type: 'custom_html', label: 'Custom HTML', icon: 'code', description: 'Raw HTML block' },
];

// ── Default section data factories ─────────────────────────────
export function createDefaultSectionData(type: SectionType): SectionDataMap[typeof type] {
  switch (type) {
    case 'hero':
      return {
        headline: 'Welcome to Our Service',
        subheadline: 'We provide the best healthcare sharing solutions for you and your family.',
        backgroundImageUrl: '',
        backgroundColor: '#0d9488',
        ctaText: 'Get Started',
        ctaLink: '#form',
        layout: 'centered',
      } as HeroSectionData;
    case 'content':
      return {
        heading: 'About Us',
        bodyHtml: '<p>Tell your story here...</p>',
        imageUrl: '',
        imagePosition: 'none',
      } as ContentSectionData;
    case 'features':
      return {
        title: 'Why Choose Us',
        subtitle: '',
        items: [
          { id: crypto.randomUUID(), icon: 'heart', title: 'Health Coverage', description: 'Comprehensive health sharing for your family' },
          { id: crypto.randomUUID(), icon: 'shield', title: 'Trusted', description: 'Backed by a community of members' },
          { id: crypto.randomUUID(), icon: 'dollar-sign', title: 'Affordable', description: 'Plans starting at competitive rates' },
        ],
        columns: 3,
      } as FeaturesSectionData;
    case 'form':
      return {
        title: 'Request a Quote',
        description: 'Fill out the form below and we\'ll get back to you within 24 hours.',
        fields: [
          { id: crypto.randomUUID(), type: 'text', label: 'First Name', placeholder: 'John', required: true },
          { id: crypto.randomUUID(), type: 'text', label: 'Last Name', placeholder: 'Doe', required: true },
          { id: crypto.randomUUID(), type: 'email', label: 'Email', placeholder: 'john@example.com', required: true },
          { id: crypto.randomUUID(), type: 'phone', label: 'Phone', placeholder: '(555) 123-4567', required: true },
        ],
        submitButtonText: 'Submit Request',
        successMessage: 'Thank you! We\'ll be in touch shortly.',
      } as FormSectionData;
    case 'pricing':
      return {
        title: 'Our Plans',
        subtitle: 'Choose the plan that fits your needs',
        tiers: [
          { id: crypto.randomUUID(), planName: 'Basic', price: '$199', period: '/month', features: ['Individual coverage', 'Telehealth included', '24/7 support'], ctaText: 'Get Started', highlighted: false },
          { id: crypto.randomUUID(), planName: 'Family', price: '$399', period: '/month', features: ['Family coverage', 'Dental & Vision', 'Telehealth included', 'Priority support'], ctaText: 'Get Started', highlighted: true },
          { id: crypto.randomUUID(), planName: 'Premium', price: '$599', period: '/month', features: ['Comprehensive coverage', 'All benefits included', 'Dedicated advisor', 'Custom plans'], ctaText: 'Contact Us', highlighted: false },
        ],
      } as PricingSectionData;
    case 'testimonials':
      return {
        title: 'What Our Members Say',
        items: [
          { id: crypto.randomUUID(), name: 'Jane Smith', role: 'Member', company: '', quote: 'This service changed my life!', avatarUrl: '' },
        ],
      } as TestimonialsSectionData;
    case 'cta':
      return {
        headline: 'Ready to Get Started?',
        description: 'Join thousands of families who trust us with their healthcare needs.',
        primaryButtonText: 'Get a Quote',
        primaryButtonLink: '#form',
        secondaryButtonText: 'Learn More',
        secondaryButtonLink: '#features',
        backgroundColor: '#0d9488',
      } as CtaSectionData;
    case 'faq':
      return {
        title: 'Frequently Asked Questions',
        items: [
          { id: crypto.randomUUID(), question: 'How does health sharing work?', answer: 'Health sharing is a community-based approach where members share each other\'s medical costs.' },
          { id: crypto.randomUUID(), question: 'What is covered?', answer: 'Most medical expenses are eligible for sharing, including doctor visits, prescriptions, and hospital stays.' },
        ],
      } as FaqSectionData;
    case 'custom_html':
      return { html: '<div style="padding: 2rem; text-align: center;">Custom content here</div>' } as CustomHtmlSectionData;
  }
}

// ── Form templates ─────────────────────────────────────────────
export interface FormTemplate {
  name: string;
  fields: FormField[];
}

export const FORM_TEMPLATES: FormTemplate[] = [
  {
    name: 'Request a Quote',
    fields: [
      { id: '', type: 'text', label: 'First Name', placeholder: 'John', required: true },
      { id: '', type: 'text', label: 'Last Name', placeholder: 'Doe', required: true },
      { id: '', type: 'email', label: 'Email', placeholder: 'john@example.com', required: true },
      { id: '', type: 'phone', label: 'Phone', placeholder: '(555) 123-4567', required: true },
      { id: '', type: 'select', label: 'Coverage Type', placeholder: 'Select...', required: true, options: ['Individual', 'Family', 'Group'] },
      { id: '', type: 'textarea', label: 'Additional Notes', placeholder: 'Tell us about your needs...', required: false },
    ],
  },
  {
    name: 'Contact Us',
    fields: [
      { id: '', type: 'text', label: 'Full Name', placeholder: 'Jane Doe', required: true },
      { id: '', type: 'email', label: 'Email', placeholder: 'jane@example.com', required: true },
      { id: '', type: 'phone', label: 'Phone', placeholder: '(555) 123-4567', required: false },
      { id: '', type: 'textarea', label: 'Message', placeholder: 'How can we help?', required: true },
    ],
  },
  {
    name: 'Get Started',
    fields: [
      { id: '', type: 'text', label: 'First Name', placeholder: 'John', required: true },
      { id: '', type: 'text', label: 'Last Name', placeholder: 'Doe', required: true },
      { id: '', type: 'email', label: 'Email', placeholder: 'john@example.com', required: true },
      { id: '', type: 'phone', label: 'Phone', placeholder: '(555) 123-4567', required: true },
      { id: '', type: 'date', label: 'Preferred Start Date', placeholder: '', required: false },
    ],
  },
];
