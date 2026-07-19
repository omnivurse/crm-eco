export type AuthVariant = 'crm' | 'admin' | 'default';

interface AuthGradientMeshProps {
  variant?: AuthVariant;
}

/** Animated Ethereal Glass mesh — cyan/emerald brand, variant-tinted */
export function AuthGradientMesh({ variant = 'default' }: AuthGradientMeshProps) {
  const isAdmin = variant === 'admin';
  const isCrm = variant === 'crm';

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[#050505]" />

      {/* Base mesh orbs */}
      <div
        className="login-blob login-blob-drift-1"
        style={{
          width: 520,
          height: 520,
          top: '-12%',
          left: '-8%',
          background: isAdmin
            ? 'radial-gradient(circle, rgba(5,150,105,0.42) 0%, rgba(5,150,105,0.1) 50%, transparent 70%)'
            : 'radial-gradient(circle, rgba(6,182,212,0.42) 0%, rgba(6,182,212,0.1) 50%, transparent 70%)',
        }}
      />
      <div
        className="login-blob login-blob-drift-2"
        style={{
          width: 460,
          height: 460,
          top: '28%',
          right: '-12%',
          background: isCrm
            ? 'radial-gradient(circle, rgba(8,145,178,0.32) 0%, rgba(8,145,178,0.08) 50%, transparent 70%)'
            : 'radial-gradient(circle, rgba(6,182,212,0.28) 0%, rgba(6,182,212,0.06) 50%, transparent 70%)',
        }}
      />
      <div
        className="login-blob login-blob-drift-3"
        style={{
          width: 400,
          height: 400,
          bottom: '-8%',
          left: '18%',
          background: isAdmin
            ? 'radial-gradient(circle, rgba(6,182,212,0.22) 0%, rgba(6,182,212,0.05) 50%, transparent 70%)'
            : 'radial-gradient(circle, rgba(5,150,105,0.28) 0%, rgba(5,150,105,0.06) 50%, transparent 70%)',
        }}
      />
      <div
        className="login-blob login-blob-drift-4"
        style={{
          width: 300,
          height: 300,
          top: '55%',
          right: '22%',
          background:
            'radial-gradient(circle, rgba(34,211,238,0.18) 0%, rgba(34,211,238,0.04) 50%, transparent 70%)',
        }}
      />

      <div className="auth-grain" aria-hidden />

      {/* Soft vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 70% 60% at 40% 45%, transparent 0%, rgba(5,5,5,0.55) 100%)',
        }}
      />
    </div>
  );
}
