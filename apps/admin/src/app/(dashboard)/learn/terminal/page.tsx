import { ArticleLayout, StepList, QuickTip, SectionCard } from '@/components/learn/LearnComponents';

export default function TerminalLearnPage() {
  return (
    <ArticleLayout
      title="Command Center"
      description="Master the terminal-style Command Center for lightning-fast navigation and search."
      readTime="4 min read"
    >
      <SectionCard title="Overview">
        <p>
          The Command Center is a keyboard-driven terminal interface that lets power users search for any record,
          navigate to any page, and check system status — all without leaving the keyboard.
        </p>
        <p>
          Press <strong>Ctrl+K</strong> (or Cmd+K on Mac) to toggle the Command Center at any time.
        </p>
      </SectionCard>

      <div id="search">
        <SectionCard title="Search Commands">
          <p>
            The Command Center queries your Supabase database in real-time. Here are the search commands:
          </p>
          <ul className="list-disc pl-5 space-y-2 mt-2">
            <li><code>search [query]</code> — Global search across all entities (members, agents, vendors, products, enrollments)</li>
            <li><code>search member [name/email]</code> — Search members specifically</li>
            <li><code>search agent [name]</code> — Search agents/advisors</li>
            <li><code>search vendor [name]</code> — Search vendors</li>
            <li><code>search product [name]</code> — Search products/plans</li>
            <li><code>search enrollment [code/status]</code> — Search enrollments</li>
            <li><code>search invoice [number]</code> — Search invoices</li>
            <li><code>search commission [status]</code> — Search commission transactions</li>
            <li><code>search email [subject]</code> — Search sent emails</li>
          </ul>
        </SectionCard>
      </div>

      <SectionCard title="Entity Shortcuts">
        <p>
          You can also use entity names directly as shortcut commands:
        </p>
        <ul className="list-disc pl-5 space-y-2 mt-2">
          <li><code>member John</code> — Search for members named John (shortcut for <code>search member John</code>)</li>
          <li><code>agent</code> — Navigate to the agents page (no argument = navigate)</li>
          <li><code>agent Smith</code> — Search for agents named Smith</li>
          <li><code>enrollment active</code> — Search for active enrollments</li>
          <li><code>invoice</code> — Navigate to invoices page</li>
        </ul>
      </SectionCard>

      <div id="navigation">
        <SectionCard title="Navigation Commands">
          <p>Quick navigation to any page in the portal:</p>
          <ul className="list-disc pl-5 space-y-2 mt-2">
            <li><code>goto dashboard</code> — Go to the dashboard</li>
            <li><code>goto members</code> — Go to members page</li>
            <li><code>goto settings</code> — Go to settings</li>
            <li><code>dashboard</code> — Direct shortcut to dashboard</li>
            <li><code>billing</code> — Go to billing page</li>
            <li><code>reports</code> — Go to reports page</li>
          </ul>
        </SectionCard>
      </div>

      <SectionCard title="Action Commands">
        <StepList steps={[
          {
            title: 'Open a Record',
            description: 'Use "open member [id]" or "open enrollment [id]" to navigate directly to a specific record.',
          },
          {
            title: 'Create New Records',
            description: 'Use "new member", "new enrollment", "new agent", etc. to navigate to the creation form.',
          },
          {
            title: 'Check System Status',
            description: 'Type "status" to see database connectivity, authentication status, and system health.',
          },
          {
            title: 'View Record Counts',
            description: 'Type "count" to see total counts of members, agents, vendors, products, enrollments, and more.',
          },
        ]} />
      </SectionCard>

      <div id="shortcuts">
        <SectionCard title="Keyboard Shortcuts">
          <ul className="list-disc pl-5 space-y-2 mt-2">
            <li><strong>Ctrl+K</strong> — Toggle the Command Center open/closed</li>
            <li><strong>Escape</strong> — Close the Command Center</li>
            <li><strong>Up/Down arrows</strong> — Navigate command history</li>
            <li><strong>Tab</strong> — Autocomplete the current command or suggestion</li>
            <li><strong>Enter</strong> — Execute the current command</li>
          </ul>
        </SectionCard>
      </div>

      <QuickTip title="Smart Autocomplete">
        The Command Center features multi-level autocomplete. When you type <code>search m</code>,
        it suggests <code>search member</code>. When you type <code>new e</code>,
        it suggests <code>new enrollment</code>. This works for search, new, open, and goto commands.
      </QuickTip>

      <SectionCard title="Utility Commands">
        <ul className="list-disc pl-5 space-y-2 mt-2">
          <li><code>whoami</code> — Show your current user info, role, and organization</li>
          <li><code>recent</code> — Show recent activity log entries</li>
          <li><code>help</code> — Show all available commands with descriptions</li>
          <li><code>clear</code> — Clear the terminal output</li>
          <li><code>theme</code> — Toggle dark/light mode</li>
        </ul>
      </SectionCard>
    </ArticleLayout>
  );
}
