/** Animated gradient mesh background for auth hero panels */
export function AuthGradientMesh() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#030712] via-[#0a1628] to-[#0f172a]" />

      <div
        className="login-blob login-blob-drift-1"
        style={{
          width: 500,
          height: 500,
          top: '-10%',
          left: '-5%',
          background:
            'radial-gradient(circle, rgba(6,182,212,0.45) 0%, rgba(6,182,212,0.12) 50%, transparent 70%)',
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
            'radial-gradient(circle, rgba(59,130,246,0.35) 0%, rgba(59,130,246,0.08) 50%, transparent 70%)',
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
            'radial-gradient(circle, rgba(139,92,246,0.25) 0%, rgba(139,92,246,0.06) 50%, transparent 70%)',
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
            'radial-gradient(circle, rgba(61,214,255,0.3) 0%, rgba(61,214,255,0.08) 50%, transparent 70%)',
        }}
      />
    </div>
  );
}
