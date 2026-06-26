import { AuthSplitLayout, AuthHeroPanel } from '@crm-eco/ui';
import { Shield, Lock, Users, FileCheck } from 'lucide-react';

const trustPoints = [
  {
    icon: Shield,
    title: 'HIPAA Compliant',
    description: 'Your health information is protected to the highest standards.',
  },
  {
    icon: Lock,
    title: '256-bit Encryption',
    description: 'All data in transit and at rest is encrypted end-to-end.',
  },
  {
    icon: Users,
    title: 'Member-First Community',
    description: 'Join thousands of families sharing medical expenses together.',
  },
  {
    icon: FileCheck,
    title: 'Transparent Sharing',
    description: 'Clear guidelines and real-time visibility into your needs.',
  },
];

export default function PortalAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthSplitLayout
      hero={
        <AuthHeroPanel
          headline={
            <>
              <span className="block">Your health sharing</span>
              <span className="block bg-gradient-to-r from-cyan-300 via-blue-300 to-purple-300 bg-clip-text text-transparent">
                community awaits
              </span>
            </>
          }
          subtitle="Access your dashboard, manage your needs, and stay connected with your health sharing family."
          badge="Member Portal"
          showQuotes={false}
        >
          <div className="space-y-4 mb-6">
            {trustPoints.map((point) => (
              <div key={point.title} className="flex items-start gap-3.5 group">
                <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 group-hover:bg-white/15 transition-colors">
                  <point.icon className="w-4 h-4 text-cyan-300" />
                </div>
                <div>
                  <p className="text-white font-medium text-sm">{point.title}</p>
                  <p className="text-white/45 text-xs mt-0.5 leading-relaxed">{point.description}</p>
                </div>
              </div>
            ))}
          </div>
        </AuthHeroPanel>
      }
    >
      {children}
    </AuthSplitLayout>
  );
}
