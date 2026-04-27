import { cn } from '@/lib/cn';

type SectionHeadingProps = {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: 'left' | 'center';
  tone?: 'cyan' | 'violet';
  className?: string;
};

/**
 * Standardised section heading: eyebrow + display headline + intro copy.
 * Use this for every section on the marketing site to keep rhythm.
 */
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'center',
  tone = 'cyan',
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-5',
        align === 'center' ? 'items-center text-center' : 'items-start text-left',
        className,
      )}
    >
      {eyebrow ? (
        <span className={tone === 'cyan' ? 'eyebrow' : 'eyebrow-violet'}>
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              tone === 'cyan' ? 'bg-helix-cyan-300' : 'bg-helix-violet-300',
            )}
          />
          {eyebrow}
        </span>
      ) : null}
      <h2 className="display-2 max-w-3xl">
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            'max-w-2xl text-base leading-relaxed text-helix-mist sm:text-lg',
            align === 'left' && 'max-w-xl',
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}
