import { ArticleLayout, StepList, QuickTip, SectionCard } from '@/components/learn/LearnComponents';

export default function AgentsLearnPage() {
  return (
    <ArticleLayout
      title="Agent & Advisor Management"
      description="Learn how to manage agents, set commission tiers, and create enrollment links."
      readTime="5 min read"
    >
      <SectionCard title="Overview">
        <p>
          Agents (also called Advisors) are the sales force that brings new members into your health sharing organization.
          The Agents module lets you manage their profiles, track licensing, configure commission rates, and create branded enrollment links.
        </p>
      </SectionCard>

      <div id="create">
        <SectionCard title="Adding a New Agent">
          <StepList steps={[
            {
              title: 'Navigate to Agents',
              description: 'Click "Agents" in the sidebar or type "agent" in the Command Center.',
            },
            {
              title: 'Click "Add Agent"',
              description: 'Click the "Add Agent" button to open the new agent form.',
            },
            {
              title: 'Enter Agent Details',
              description: 'Fill in the agent\'s full name, email, phone, license number, and NPN (National Producer Number).',
            },
            {
              title: 'Assign Commission Tier',
              description: 'Select the appropriate commission tier that determines the agent\'s commission rate on enrollments.',
            },
            {
              title: 'Set Status and Save',
              description: 'Set the agent status to Active and save. The agent can now be assigned to enrollments.',
            },
          ]} />
        </SectionCard>
      </div>

      <div id="commissions">
        <SectionCard title="Commission Tiers">
          <p>
            Commission tiers define the percentage or fixed amount that agents earn per enrollment.
            The commission engine supports multi-tier structures:
          </p>
          <ul className="list-disc pl-5 space-y-2 mt-2">
            <li><strong>Tier Configuration</strong> — Set commission rates per tier with minimum enrollment thresholds.</li>
            <li><strong>Override Commissions</strong> — Support for manager overrides on team enrollments.</li>
            <li><strong>Effective Dating</strong> — Commission rates can have start/end dates for rate changes.</li>
            <li><strong>Transaction Tracking</strong> — Every commission calculation is recorded with full audit trail.</li>
          </ul>
        </SectionCard>
      </div>

      <QuickTip title="Commission Calculations">
        Commissions are automatically calculated when an enrollment moves to <strong>active</strong> status.
        The system looks up the agent&#39;s tier rate and creates a commission transaction record.
        Navigate to <strong>Commissions → Transactions</strong> to review all calculations.
      </QuickTip>

      <div id="links">
        <SectionCard title="Agent Enrollment Links">
          <p>
            Each agent can have a branded enrollment landing page with a unique URL and QR code.
          </p>
          <StepList steps={[
            {
              title: 'Navigate to Enrollment Links',
              description: 'Go to "Enrollment Links" in the sidebar or type "goto links" in the Command Center.',
            },
            {
              title: 'Create a Landing Page',
              description: 'Click "Create Link" and select the agent. Configure the page title, description, and branding.',
            },
            {
              title: 'Generate QR Code',
              description: 'The system automatically generates a QR code for the enrollment link that agents can share.',
            },
            {
              title: 'Track Analytics',
              description: 'Monitor click counts, enrollment conversions, and page views for each agent link.',
            },
          ]} />
        </SectionCard>
      </div>

      <QuickTip title="Quick Agent Search" type="info">
        Use the Command Center to quickly find agents: type <code>agent Smith</code> to search by name,
        or <code>search agent</code> to see all agents in a table view.
      </QuickTip>
    </ArticleLayout>
  );
}
