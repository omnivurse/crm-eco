export default function GradientMeshHero() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Base gradient — deep navy to teal to emerald */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#003560] via-[#047474] to-[#027343]" />

      {/* Animated mesh blobs */}
      <div
        className="login-blob login-blob-drift-1"
        style={{
          width: 500,
          height: 500,
          top: '-10%',
          left: '-5%',
          background:
            'radial-gradient(circle, rgba(6,155,154,0.4) 0%, rgba(6,155,154,0.1) 50%, transparent 70%)',
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
            'radial-gradient(circle, rgba(2,115,67,0.35) 0%, rgba(2,115,67,0.08) 50%, transparent 70%)',
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
            'radial-gradient(circle, rgba(233,182,31,0.2) 0%, rgba(233,182,31,0.05) 50%, transparent 70%)',
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
            'radial-gradient(circle, rgba(4,116,116,0.3) 0%, rgba(4,116,116,0.08) 50%, transparent 70%)',
        }}
      />
    </div>
  );
}
