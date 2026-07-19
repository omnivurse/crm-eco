import { AuthSplitLayout, BrandLogo } from '@crm-eco/ui';
import { Shield, Lock, Users, Checks } from '@phosphor-icons/react/dist/ssr';

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
    icon: Checks,
    title: 'Transparent Sharing',
    description: 'Clear guidelines and real-time visibility into your needs.',
  },
];

function SoftTealAuthHero({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex h-full w-full flex-col justify-center">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#061218] via-[#0a1f28] to-[#0b3d4d]" />
        <div
          className="login-blob login-blob-drift-1"
          style={{
            width: 500,
            height: 500,
            top: '-10%',
            left: '-5%',
            background:
              'radial-gradient(circle, rgba(11,109,133,0.5) 0%, rgba(11,109,133,0.14) 50%, transparent 70%)',
          }}
        />
        <div
          className="login-blob login-blob-drift-2"
          style={{
            width: 450,
            height: 450,
            top: '30%',
            right: '-10%',
            background:
              'radial-gradient(circle, rgba(14,140,154,0.38) 0%, rgba(14,140,154,0.1) 50%, transparent 70%)',
          }}
        />
        <div
          className="login-blob login-blob-drift-3"
          style={{
            width: 380,
            height: 380,
            bottom: '-5%',
            left: '20%',
            background:
              'radial-gradient(circle, rgba(18,160,101,0.22) 0%, rgba(18,160,101,0.06) 50%, transparent 70%)',
          }}
        />
        <div
          className="login-blob login-blob-drift-4"
          style={{
            width: 320,
            height: 320,
            top: '60%',
            right: '25%',
            background:
              'radial-gradient(circle, rgba(242,247,249,0.12) 0%, rgba(11,109,133,0.08) 50%, transparent 70%)',
          }}
        />
      </div>

      <div className="relative z-10 px-12 xl:px-16">
        <h1 className="mb-4 font-heading text-5xl font-bold leading-[1.1] tracking-tight text-white xl:text-6xl">
          <span className="block">Your health sharing</span>
          <span className="block bg-gradient-to-r from-[#7dd3e0] via-[#5ec8d8] to-[#3db89a] bg-clip-text text-transparent">
            community awaits
          </span>
        </h1>
        <p className="mb-10 max-w-md text-lg leading-relaxed text-white/70">
          Access your dashboard, manage your needs, and stay connected with your health sharing family.
        </p>
        {children}
      </div>

      <div className="absolute bottom-12 left-12 z-10 flex flex-col gap-2 xl:left-16">
        <BrandLogo variant="full" size="sm" tone="white" />
        <p className="text-xs font-medium uppercase tracking-wider text-white/40">Member Portal</p>
      </div>
    </div>
  );
}

export default function PortalAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mp-auth">
      <AuthSplitLayout
        hero={
          <SoftTealAuthHero>
            <div className="mb-6 space-y-4">
              {trustPoints.map((point) => (
                <div key={point.title} className="group flex items-start gap-3.5">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white/10 transition-colors group-hover:bg-white/15">
                    <point.icon weight="light" className="h-4 w-4 text-[#7dd3e0]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{point.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-white/45">{point.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </SoftTealAuthHero>
        }
      >
        {children}
      </AuthSplitLayout>
    </div>
  );
}
