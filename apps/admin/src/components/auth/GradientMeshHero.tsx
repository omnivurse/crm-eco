export default function GradientMeshHero() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Base gradient — navy to purple to blue */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0f172a] via-purple-800 to-blue-700" />

      {/* Animated mesh blobs — purple/blue palette */}
      <div
        className="login-blob login-blob-drift-1"
        style={{
          width: 500,
          height: 500,
          top: '-10%',
          left: '-5%',
          background:
            'radial-gradient(circle, rgba(147,51,234,0.35) 0%, rgba(147,51,234,0.1) 50%, transparent 70%)',
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
            'radial-gradient(circle, rgba(59,130,246,0.3) 0%, rgba(59,130,246,0.08) 50%, transparent 70%)',
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
            'radial-gradient(circle, rgba(99,102,241,0.25) 0%, rgba(99,102,241,0.06) 50%, transparent 70%)',
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
            'radial-gradient(circle, rgba(168,85,247,0.3) 0%, rgba(168,85,247,0.08) 50%, transparent 70%)',
        }}
      />
    </div>
  );
}
