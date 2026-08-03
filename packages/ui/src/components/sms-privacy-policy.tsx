import {
  SMS_PRIVACY_POLICY_HUBS_URL,
  SMS_PRIVACY_POLICY_UPDATED,
  buildSmsPrivacySections,
  type SmsPrivacyPolicyBrand,
} from '../lib/sms-privacy-policy';

export interface SmsPrivacyPolicyProps {
  brand: SmsPrivacyPolicyBrand;
  /** Extra class on the outer article wrapper. */
  className?: string;
  /** Show link to the HubSpot-published official document. Default true. */
  showOfficialLink?: boolean;
}

/** Shared long-form SMS privacy policy body for footers across apps. */
export function SmsPrivacyPolicy({
  brand,
  className,
  showOfficialLink = true,
}: SmsPrivacyPolicyProps) {
  const sections = buildSmsPrivacySections(brand);

  return (
    <article className={className}>
      <p className="text-sm opacity-70">Last updated: {SMS_PRIVACY_POLICY_UPDATED}</p>

      {showOfficialLink ? (
        <p className="mt-4 text-sm leading-relaxed">
          Official published copy:{' '}
          <a
            href={SMS_PRIVACY_POLICY_HUBS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            View on HubSpot
          </a>
          .
        </p>
      ) : null}

      <div className="mt-8 space-y-8">
        {sections.map((section) => (
          <section key={section.id} id={section.id}>
            <h2 className="text-lg font-semibold tracking-tight">{section.title}</h2>
            {section.paragraphs.map((p, i) => (
              <p key={`${section.id}-p-${i}`} className="mt-3 text-[0.975rem] leading-relaxed opacity-90">
                {p}
              </p>
            ))}
            {section.bullets?.length ? (
              <ul className="mt-3 list-disc space-y-2 pl-5 text-[0.975rem] leading-relaxed opacity-90">
                {section.bullets.map((item, i) => (
                  <li key={`${section.id}-b-${i}`}>{item}</li>
                ))}
              </ul>
            ) : null}
            {section.afterBullets?.map((p, i) => (
              <p key={`${section.id}-a-${i}`} className="mt-3 text-[0.975rem] leading-relaxed opacity-90">
                {p}
              </p>
            ))}
          </section>
        ))}
      </div>
    </article>
  );
}
