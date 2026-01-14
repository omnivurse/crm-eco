'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Heart,
  Users,
  Shield,
  CheckCircle,
  ArrowRight,
  Loader2,
  Phone,
  Mail,
  MapPin,
  Star,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { Card, CardContent } from '@crm-eco/ui/components/card';

interface LandingPage {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  headline: string | null;
  subheadline: string | null;
  hero_image_url: string | null;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  background_style: string;
  required_fields: string[];
  default_plan_id: string | null;
  default_advisor_id: string | null;
}

interface Plan {
  id: string;
  name: string;
  code: string;
  monthly_share: number;
  description: string | null;
}

interface PublicEnrollmentPageProps {
  landingPage: LandingPage;
  plans: Plan[];
}

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

export function PublicEnrollmentPage({ landingPage, plans }: PublicEnrollmentPageProps) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    state: '',
    planId: landingPage.default_plan_id || '',
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/enroll/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          landingPageId: landingPage.id,
          ...formData,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit enrollment');
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-blue-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Thank You for Enrolling!
            </h2>
            <p className="text-gray-600 mb-6">
              We've received your enrollment request. A member of our team will contact you
              within 24-48 hours to complete your application.
            </p>
            <p className="text-sm text-gray-500">
              Check your email for confirmation details.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50">
      {/* Hero Section */}
      <div
        className="relative py-20 px-4"
        style={{
          background: `linear-gradient(135deg, ${landingPage.secondary_color} 0%, ${landingPage.primary_color} 100%)`,
        }}
      >
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>

        <div className="max-w-4xl mx-auto text-center relative z-10">
          {landingPage.logo_url && (
            <div className="mb-6">
              <Image
                src={landingPage.logo_url}
                alt="Logo"
                width={120}
                height={60}
                className="mx-auto"
              />
            </div>
          )}

          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            {landingPage.headline || 'Join Our Healthcare Community'}
          </h1>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            {landingPage.subheadline || 'Affordable healthcare sharing for you and your family'}
          </p>

          {/* Trust Badges */}
          <div className="flex items-center justify-center gap-8 text-white/80">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              <span className="text-sm">Secure & Private</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              <span className="text-sm">10,000+ Members</span>
            </div>
            <div className="flex items-center gap-2">
              <Heart className="w-5 h-5" />
              <span className="text-sm">Caring Community</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="grid md:grid-cols-2 gap-12">
          {/* Left Column - Benefits */}
          <div className="space-y-8">
            <h2 className="text-2xl font-bold text-gray-900">
              Why Choose Us?
            </h2>

            <div className="space-y-6">
              {[
                {
                  icon: Heart,
                  title: 'Affordable Monthly Shares',
                  description: 'Lower costs than traditional insurance with no deductibles or copays on most services.',
                },
                {
                  icon: Users,
                  title: 'Community Support',
                  description: 'Join a community of like-minded individuals who share in each other\'s medical expenses.',
                },
                {
                  icon: Shield,
                  title: 'Comprehensive Coverage',
                  description: 'Coverage for doctor visits, prescriptions, surgery, emergency care, and more.',
                },
                {
                  icon: Star,
                  title: 'No Network Restrictions',
                  description: 'Freedom to choose any doctor or hospital. No referrals needed for specialists.',
                },
              ].map((benefit, idx) => (
                <div key={idx} className="flex gap-4">
                  <div
                    className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${landingPage.primary_color}20` }}
                  >
                    <benefit.icon
                      className="w-6 h-6"
                      style={{ color: landingPage.primary_color }}
                    />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{benefit.title}</h3>
                    <p className="text-gray-600 text-sm">{benefit.description}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Plans Preview */}
            {plans.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-4">Available Plans</h3>
                <div className="space-y-3">
                  {plans.slice(0, 3).map((plan) => (
                    <div
                      key={plan.id}
                      className="p-4 rounded-lg border border-gray-200 bg-white hover:border-teal-300 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{plan.name}</p>
                          {plan.description && (
                            <p className="text-sm text-gray-500">{plan.description}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold" style={{ color: landingPage.primary_color }}>
                            {formatCurrency(plan.monthly_share)}
                          </p>
                          <p className="text-xs text-gray-500">/month</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Enrollment Form */}
          <div>
            <Card className="shadow-xl border-0">
              <CardContent className="p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Start Your Enrollment
                </h2>
                <p className="text-gray-600 mb-6">
                  Fill out the form below and we'll get you started.
                </p>

                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName">First Name *</Label>
                      <Input
                        id="firstName"
                        required
                        value={formData.firstName}
                        onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                        placeholder="John"
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName">Last Name *</Label>
                      <Input
                        id="lastName"
                        required
                        value={formData.lastName}
                        onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                        placeholder="Doe"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="john@example.com"
                    />
                  </div>

                  <div>
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="(555) 123-4567"
                    />
                  </div>

                  <div>
                    <Label htmlFor="state">State *</Label>
                    <Select
                      value={formData.state}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, state: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select your state" />
                      </SelectTrigger>
                      <SelectContent>
                        {US_STATES.map((state) => (
                          <SelectItem key={state} value={state}>{state}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {plans.length > 0 && (
                    <div>
                      <Label htmlFor="plan">Select a Plan</Label>
                      <Select
                        value={formData.planId}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, planId: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a plan" />
                        </SelectTrigger>
                        <SelectContent>
                          {plans.map((plan) => (
                            <SelectItem key={plan.id} value={plan.id}>
                              {plan.name} - {formatCurrency(plan.monthly_share)}/mo
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full py-6 text-lg"
                    style={{ backgroundColor: landingPage.primary_color }}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        Start Enrollment
                        <ArrowRight className="w-5 h-5 ml-2" />
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-gray-500 text-center mt-4">
                    By submitting, you agree to our Terms of Service and Privacy Policy.
                  </p>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-gray-400 text-sm">
            © {new Date().getFullYear()} Pay It Forward HealthShare. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
