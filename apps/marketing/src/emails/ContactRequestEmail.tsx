import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Heading,
  Text,
  Section,
  Hr,
  Tailwind,
  pixelBasedPreset,
} from '@react-email/components';

/**
 * ContactRequestEmail
 * --------------------------------------------------------------
 * Internal notification sent to the Double Helix sales inbox when
 * a prospect submits the /contact form on doublehelix.com.
 *
 * Designed to mirror the dark-helix brand — premium, dense,
 * scannable. Optimised for the inbox pane: a strong subject line
 * + at-a-glance prospect summary above the fold.
 */
export interface ContactRequestEmailProps {
  name: string;
  email: string;
  company: string;
  role?: string;
  memberCount?: string;
  message: string;
  intent?: string;
  submittedAt: string;
  source?: string;
}

export default function ContactRequestEmail({
  name,
  email,
  company,
  role,
  memberCount,
  message,
  intent,
  submittedAt,
  source,
}: ContactRequestEmailProps) {
  const intentLabel = intent
    ? intent === 'admin-demo'
      ? 'Admin demo'
      : intent === 'crm-demo'
        ? 'CRM demo'
        : intent === 'demo'
          ? 'Platform demo'
          : intent
    : 'General inquiry';

  return (
    <Html lang="en">
      <Tailwind
        config={{
          presets: [pixelBasedPreset],
          theme: {
            extend: {
              colors: {
                ink: '#05060B',
                inkSoft: '#0C0F1A',
                cyan: '#3DD6FF',
                cyanDeep: '#0DBEEB',
                violet: '#937DFF',
                mist: '#A2AEC2',
                fog: '#6E7A92',
                edge: '#1B2235',
              },
            },
          },
        }}
      >
        <Head />
        <Preview>
          {`New ${intentLabel} request — ${name} at ${company}`}
        </Preview>
        <Body className="bg-ink font-sans m-0 p-0">
          <Container className="max-w-xl mx-auto p-0">
            {/* Brand bar */}
            <Section className="px-8 pt-10 pb-6">
              <table cellPadding="0" cellSpacing="0" border={0} width="100%">
                <tbody>
                  <tr>
                    <td>
                      <Text className="text-cyan font-mono text-[11px] tracking-[2.5px] uppercase m-0">
                        Double Helix · Sales
                      </Text>
                      <Heading className="text-white text-[26px] font-semibold tracking-tight leading-tight m-0 mt-2">
                        New {intentLabel.toLowerCase()} request
                      </Heading>
                    </td>
                  </tr>
                </tbody>
              </table>
            </Section>

            {/* Helix accent line */}
            <Section className="px-8">
              <Hr className="border-none border-t border-solid border-edge m-0" />
            </Section>

            {/* Prospect summary card */}
            <Section className="px-8 pt-6">
              <table
                cellPadding="0"
                cellSpacing="0"
                border={0}
                width="100%"
                className="bg-inkSoft rounded-lg"
              >
                <tbody>
                  <tr>
                    <td className="p-6">
                      <Text className="text-fog text-[11px] uppercase tracking-[2px] m-0">
                        Prospect
                      </Text>
                      <Heading className="text-white text-[20px] font-semibold leading-tight m-0 mt-2">
                        {name}
                      </Heading>
                      <Text className="text-mist text-[14px] m-0 mt-1">
                        {role ? `${role}, ` : ''}
                        {company}
                      </Text>

                      <Hr className="border-none border-t border-solid border-edge m-0 mt-5 mb-5" />

                      <DataRow label="Email" value={email} />
                      <DataRow label="Company" value={company} />
                      {role ? <DataRow label="Role" value={role} /> : null}
                      {memberCount ? (
                        <DataRow label="Member count" value={memberCount} />
                      ) : null}
                      <DataRow label="Intent" value={intentLabel} />
                      <DataRow label="Submitted" value={submittedAt} />
                      {source ? <DataRow label="Source" value={source} /> : null}
                    </td>
                  </tr>
                </tbody>
              </table>
            </Section>

            {/* Message body */}
            <Section className="px-8 pt-6">
              <Text className="text-fog text-[11px] uppercase tracking-[2px] m-0">
                What they wrote
              </Text>
              <table
                cellPadding="0"
                cellSpacing="0"
                border={0}
                width="100%"
                className="bg-inkSoft rounded-lg mt-2"
              >
                <tbody>
                  <tr>
                    <td className="p-6">
                      <Text className="text-white text-[15px] leading-[24px] m-0 whitespace-pre-wrap">
                        {message}
                      </Text>
                    </td>
                  </tr>
                </tbody>
              </table>
            </Section>

            {/* Quick actions */}
            <Section className="px-8 pt-6">
              <table cellPadding="0" cellSpacing="0" border={0} width="100%">
                <tbody>
                  <tr>
                    <td>
                      <a
                        href={`mailto:${email}?subject=Re: Double Helix demo request`}
                        className="bg-cyan text-ink text-[13px] font-semibold no-underline rounded-md inline-block py-3 px-5 box-border"
                      >
                        Reply to {name.split(' ')[0]}
                      </a>
                    </td>
                  </tr>
                </tbody>
              </table>
            </Section>

            {/* Footer */}
            <Section className="px-8 pt-10 pb-10">
              <Hr className="border-none border-t border-solid border-edge m-0 mb-5" />
              <Text className="text-fog text-[11px] tracking-[2px] uppercase m-0 font-mono">
                Auto-routed from doublehelix.com · DH/SALES
              </Text>
              <Text className="text-fog text-[11px] m-0 mt-1">
                Reply directly to this email to respond — the prospect&apos;s
                address is set as the reply-to.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <table
      cellPadding="0"
      cellSpacing="0"
      border={0}
      width="100%"
      className="mb-2"
    >
      <tbody>
        <tr>
          <td width="120" className="align-top">
            <Text className="text-fog text-[12px] uppercase tracking-[1.5px] m-0">
              {label}
            </Text>
          </td>
          <td className="align-top">
            <Text className="text-white text-[14px] m-0">{value}</Text>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

ContactRequestEmail.PreviewProps = {
  name: 'Avery Holm',
  email: 'avery@carrington-health.com',
  company: 'Carrington Health Sharing',
  role: 'COO',
  memberCount: '12,500',
  intent: 'admin-demo',
  submittedAt: 'Apr 26, 2026 · 10:42 PM EDT',
  source: 'doublehelix.com/contact',
  message:
    'We are evaluating Admin to replace a legacy enrollment platform that has us stuck on a 11-day enrollment cycle. Multi-tenancy is non-negotiable — we have three operating entities and need clean data isolation per entity with shared advisor pools. Would love to see a working demo against synthetic copies of our data structure.',
} satisfies ContactRequestEmailProps;

export { ContactRequestEmail };
