import Image from 'next/image';
import { ArrowSquareOut } from '@phosphor-icons/react/dist/ssr';
import { Bezel } from '@/components/ui/Bezel';

export interface ServiceProvider {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  external_url: string;
  sso_kind?: string | null;
}

interface ServiceProviderGridProps {
  providers: ServiceProvider[];
  emptyMessage?: string;
  ssoEnabled?: boolean;
}

/**
 * Grid of curated service partners. External URL opens in a new tab; if `ssoEnabled`,
 * we route through `/api/member/services/<id>/sso` to dispatch through the
 * `telehealth-sso` edge function instead of going direct.
 */
export function ServiceProviderGrid({
  providers,
  emptyMessage = 'No partners available yet for your plan.',
  ssoEnabled = false,
}: ServiceProviderGridProps) {
  if (providers.length === 0) {
    return (
      <div className="rounded-[2rem] border border-dashed border-[rgba(11,109,133,0.15)] bg-[rgba(11,109,133,0.03)] p-8 text-center text-sm text-slate-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {providers.map((p) => (
        <Bezel key={p.id}>
          <article className="flex h-full flex-col p-5">
            {p.logo_url ? (
              <div className="mb-3 h-12 w-12 overflow-hidden rounded-xl">
                <Image
                  src={p.logo_url}
                  alt={p.name}
                  width={48}
                  height={48}
                  className="h-full w-full object-contain"
                  unoptimized
                />
              </div>
            ) : (
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[rgba(11,109,133,0.08)] text-lg font-semibold text-[var(--mp-teal)]">
                {p.name[0]}
              </div>
            )}
            <h3 className="font-semibold text-[var(--mp-ink)]">{p.name}</h3>
            {p.description && (
              <p className="mt-1 line-clamp-3 text-sm text-slate-600">{p.description}</p>
            )}
            <div className="mt-4">
              {ssoEnabled && p.sso_kind && p.sso_kind !== 'none' ? (
                <form action={`/api/member/services/${p.id}/sso`} method="post">
                  <button
                    type="submit"
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-[var(--mp-ink)] px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
                  >
                    Launch
                    <ArrowSquareOut weight="light" className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </form>
              ) : (
                <a
                  href={p.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-[rgba(11,109,133,0.12)] px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-[rgba(11,109,133,0.04)]"
                >
                  Visit
                  <ArrowSquareOut weight="light" className="h-3.5 w-3.5" aria-hidden />
                </a>
              )}
            </div>
          </article>
        </Bezel>
      ))}
    </div>
  );
}
