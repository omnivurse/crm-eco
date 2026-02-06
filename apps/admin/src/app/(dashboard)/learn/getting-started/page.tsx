import { ArticleLayout, StepList, QuickTip, SectionCard } from '@/components/learn/LearnComponents';

export default function GettingStartedPage() {
  return (
    <ArticleLayout
      title="Getting Started with the Admin Portal"
      description="Everything you need to know to start managing your organization effectively."
      readTime="5 min read"
    >
      <SectionCard title="Welcome to the Admin Portal">
        <p>
          The Admin Portal is your central hub for managing every aspect of your health sharing organization.
          From member enrollment to billing, commissions to communications — everything is at your fingertips.
        </p>
        <p>
          This guide will walk you through the essentials so you can hit the ground running.
        </p>
      </SectionCard>

      <div id="dashboard">
        <SectionCard title="Understanding the Dashboard">
          <p>
            Your dashboard provides a real-time overview of your organization&#39;s key metrics:
          </p>
          <StepList steps={[
            {
              title: 'Key Metrics Cards',
              description: 'View total members, active agents, pending enrollments, and monthly revenue at a glance. Each card shows trend data compared to the previous month.',
            },
            {
              title: 'Future Enrollments',
              description: 'See upcoming enrollment activations including start dates and member counts for planning ahead.',
            },
            {
              title: 'Member Activity Analysis',
              description: 'Track new enrollments, inactive members, net growth, and retention rates month-over-month.',
            },
            {
              title: 'Recent Activity Feed',
              description: 'Monitor the latest changes across the system — new members, enrollment updates, and administrative actions.',
            },
          ]} />
        </SectionCard>
      </div>

      <QuickTip title="Pro Tip: Refresh Data">
        Click the &quot;Refresh Data&quot; button in the dashboard header to pull the latest numbers.
        The dashboard also shows the last updated timestamp so you know how fresh the data is.
      </QuickTip>

      <div id="navigation">
        <SectionCard title="Navigating the Portal">
          <p>The Admin Portal is organized into logical sections accessible from the left sidebar:</p>
          <StepList steps={[
            {
              title: 'Main Navigation',
              description: 'Dashboard, Members, Agents, Products, Enrollments, and Vendors are always visible at the top of the sidebar.',
            },
            {
              title: 'Collapsible Sections',
              description: 'Operations, Billing, Commissions, Communications, and Settings can be expanded or collapsed. Click the section header to toggle.',
            },
            {
              title: 'Breadcrumbs',
              description: 'The breadcrumb trail at the top of every page shows your current location and lets you navigate back quickly.',
            },
            {
              title: 'Command Center',
              description: 'Press Ctrl+K to open the Command Center terminal for quick navigation and search across the entire system.',
            },
          ]} />
        </SectionCard>
      </div>

      <div id="profile">
        <SectionCard title="Your User Profile">
          <p>
            Your profile information and role are displayed in the top navigation bar.
            The system uses role-based access control with three primary roles:
          </p>
          <ul className="list-disc pl-5 space-y-2 mt-2">
            <li><strong>Owner</strong> — Full system access including settings and security configuration.</li>
            <li><strong>Admin</strong> — Access to all operational features including members, enrollments, billing, and reports.</li>
            <li><strong>Staff</strong> — Access to day-to-day operations like member management and enrollment processing.</li>
          </ul>
        </SectionCard>
      </div>

      <QuickTip title="Keyboard Shortcuts" type="info">
        The Admin Portal supports keyboard shortcuts for power users. Press <strong>Ctrl+K</strong> to open the Command Center,
        where you can search for any record, navigate to any page, or check system status — all without touching the mouse.
      </QuickTip>

      <div id="settings">
        <SectionCard title="System Settings">
          <p>
            Access settings from the sidebar under the &quot;Settings&quot; section. Here you can configure:
          </p>
          <ul className="list-disc pl-5 space-y-2 mt-2">
            <li><strong>General Settings</strong> — Organization preferences and system defaults.</li>
            <li><strong>Security</strong> — User roles, access controls, and session management.</li>
            <li><strong>Automations</strong> — Automated workflows for eligibility, billing, and notifications.</li>
            <li><strong>Audit Logs</strong> — Complete history of who changed what and when.</li>
          </ul>
        </SectionCard>
      </div>
    </ArticleLayout>
  );
}
