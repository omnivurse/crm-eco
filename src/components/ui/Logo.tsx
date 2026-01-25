import { motion } from 'framer-motion';

interface LogoProps {
  size?: 'small' | 'medium' | 'large' | 'xlarge';
  animated?: boolean;
  className?: string;
  onClick?: () => void;
}

const sizeMap = {
  small: 'h-8',
  medium: 'h-12',
  large: 'h-16',
  xlarge: 'h-20',
};

export function Logo({ size = 'medium', animated = false, className = '', onClick }: LogoProps) {
  const sizeClass = sizeMap[size];

  const logoElement = (
    <img
      src="/assets/MPB-Health-No-background.png"
      alt="MPB Health"
      className={`${sizeClass} w-auto object-contain ${onClick ? 'cursor-pointer' : ''} ${className}`}
    />
  );

  if (animated) {
    return (
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        onClick={onClick}
        className="inline-block"
      >
        {logoElement}
      </motion.div>
    );
  }

  return (
    <div onClick={onClick} className="inline-block">
      {logoElement}
    </div>
  );
}
