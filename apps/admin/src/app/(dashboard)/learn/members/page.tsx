import { ArticleLayout, StepList, QuickTip, SectionCard } from '@/components/learn/LearnComponents';

export default function MembersLearnPage() {
  return (
    <ArticleLayout
      title="Member Management"
      description="Learn how to create, edit, manage, search, filter, and bulk-assign member profiles."
      readTime="6 min read"
    >
      <SectionCard title="Overview">
        <p>
          The Members module is the heart of the Admin Portal. Here you manage all member profiles,
          track their enrollment status, manage dependents, filter by Advisor, and maintain contact information.
        </p>
        <p>
          Navigate to <strong>Members</strong> from the sidebar or type <code>member</code> in the Command Center.
        </p>
      </SectionCard>

      <SectionCard title="Creating a New Member">
        <StepList steps={[
          {
            title: 'Navigate to Members',
            description: 'Click "Members" in the sidebar or type "goto members" in the Command Center.',
          },
          {
            title: 'Click "Add Member"',
            description: 'Click the "Add Member" button in the top right corner of the Members page.',
          },
          {
            title: 'Fill in Member Details',
            description: 'Enter the member\'s full name, email, phone number, date of birth, and address information.',
          },
          {
            title: 'Choose Market Type',
            description: 'Select the Market Type: HealthShare or Traditional Insurance. This determines whether the member is assigned to an Advisor or an Agent.',
          },
          {
            title: 'Assign an Advisor or Agent',
            description: 'Use the searchable dropdown to find and assign an Advisor (for HealthShare) or Agent (for Traditional Insurance). You can type a name to search the list.',
          },
          {
            title: 'Set Member Status',
            description: 'Choose the appropriate status: Active, Inactive, Pending, or Terminated.',
          },
          {
            title: 'Save the Member',
            description: 'Click "Create Member" to save. You can then proceed to add dependents and enrollment records.',
          },
        ]} />
      </SectionCard>

      <QuickTip title="Market Type Controls the Owner Label">
        When <strong>Market Type</strong> is set to HealthShare, the owner field is labeled <strong>Advisor</strong>.
        When set to Traditional Insurance, it becomes <strong>Agent</strong>.
        This keeps the CRM consistent with how your team talks about ownership.
      </QuickTip>

      <div id="search">
        <SectionCard title="Searching Members">
          <p>
            The search bar on the Members page supports several search patterns:
          </p>
          <ul className="list-disc pl-5 space-y-2 mt-2">
            <li><strong>First name:</strong> Type <code>Anna</code> to find all members named Anna</li>
            <li><strong>Last name:</strong> Type <code>Martin</code> to find all Martins</li>
            <li><strong>Full name:</strong> Type <code>Anna Martin</code> to search first + last name together</li>
            <li><strong>Spouse name:</strong> Type a spouse&apos;s name to find the primary member</li>
            <li><strong>Child name:</strong> Type a child or dependent&apos;s name to find their parent&apos;s record</li>
            <li><strong>Email:</strong> Type an email address to search by email</li>
          </ul>
          <p className="mt-3 text-sm text-slate-500">
            The search checks the member, their spouse, and all dependents in one query.
            Press Enter to submit your search.
          </p>
        </SectionCard>
      </div>

      <div id="filters">
        <SectionCard title="Filtering Members">
          <p>
            Use the filter bar above the member list to narrow results:
          </p>
          <ul className="list-disc pl-5 space-y-2 mt-2">
            <li><strong>Market Type pills:</strong> Click <strong>All</strong>, <strong>HealthShare</strong>, or <strong>Insurance</strong> to filter by plan type</li>
            <li><strong>Advisor filter:</strong> Use the searchable Advisor dropdown to filter by a specific Advisor. Type a name to search.</li>
            <li><strong>Status filter:</strong> Filter by Active, Pending, Inactive, or Terminated</li>
          </ul>
          <p className="mt-3">
            Active filters appear as <strong>chips</strong> below the filter bar. Each chip shows what is being filtered
            and has an <strong>X</strong> button to remove it. Click <strong>Clear all</strong> to reset all filters at once.
          </p>
        </SectionCard>
      </div>

      <QuickTip title="Saved Views">
        Click the <strong>Saved Views</strong> button (bookmark icon) in the filter bar to save your current
        filter combination as a named view. You can save views like &quot;My HealthShare Clients&quot; or
        &quot;Needs Review&quot; and load them later with one click. You can also set a default view.
      </QuickTip>

      <div id="bulk-assign">
        <SectionCard title="Bulk Assign Advisor">
          <p>
            You can assign or change the Advisor for multiple members at once:
          </p>
          <StepList steps={[
            {
              title: 'Select Members',
              description: 'Use the checkboxes on the left side of the member list to select one or more members. Use the header checkbox to select all visible members.',
            },
            {
              title: 'Click "Assign Advisor"',
              description: 'A blue bar appears at the bottom of the screen showing how many members are selected. Click the "Assign Advisor" button.',
            },
            {
              title: 'Choose an Advisor',
              description: 'In the dialog, use the searchable dropdown to pick an Advisor. You can also choose "Unassigned" to clear the Advisor assignment.',
            },
            {
              title: 'Apply',
              description: 'Click "Apply" to update all selected members at once. A confirmation toast will show how many records were updated.',
            },
          ]} />
        </SectionCard>
      </div>

      <div id="dependents">
        <SectionCard title="Managing Dependents">
          <p>
            Dependents are family members covered under a member&apos;s enrollment, such as spouses and children.
          </p>
          <StepList steps={[
            {
              title: 'Open the Member Profile',
              description: 'Navigate to the member\'s detail page by clicking their name in the members list.',
            },
            {
              title: 'Go to the Dependents Tab',
              description: 'Click the "Dependents" tab to see existing dependents or add new ones.',
            },
            {
              title: 'Add a Dependent',
              description: 'Click "Add Dependent" and enter their name, date of birth, relationship (Spouse, Child, or Dependent), phone number, and email.',
            },
          ]} />
          <p className="mt-3">
            Each dependent has a <strong>relationship</strong> type and a <strong>coverage role</strong>.
            You can include or exclude specific dependents from individual enrollments.
          </p>
        </SectionCard>
      </div>

      <QuickTip title="Phone Numbers and Family Members">
        Spouse and dependent phone numbers are stored separately from the primary member&apos;s phone.
        When searching, you can find a member by searching for their spouse&apos;s or child&apos;s name.
      </QuickTip>

      <div id="dates">
        <SectionCard title="Start Dates">
          <p>
            Each member record can display two important dates:
          </p>
          <ul className="list-disc pl-5 space-y-2 mt-2">
            <li><strong>Original Start Date:</strong> The date the member first enrolled (ever). This is preserved across annual renewals.</li>
            <li><strong>Current Year Start Date:</strong> The start date of the member&apos;s current coverage year or renewal period.</li>
          </ul>
          <p className="mt-3 text-sm text-slate-500">
            These dates are displayed in the Product section of the record detail view.
          </p>
        </SectionCard>
      </div>

      <div id="import">
        <SectionCard title="Importing Member Data">
          <p>
            Bulk import members from CSV files to save time when onboarding large groups.
          </p>
          <StepList steps={[
            {
              title: 'Prepare Your CSV',
              description: 'Ensure your CSV has columns for: full_name, email, phone, date_of_birth, and address fields.',
            },
            {
              title: 'Navigate to Import',
              description: 'Go to Members → Import, or type "goto members/import" in the Command Center.',
            },
            {
              title: 'Upload and Map Fields',
              description: 'Upload your CSV file and map each column to the corresponding member field.',
            },
            {
              title: 'Review and Confirm',
              description: 'Review the preview of imported records, check for duplicates, and confirm the import.',
            },
          ]} />
        </SectionCard>
      </div>

      <div id="status">
        <SectionCard title="Contact Status">
          <p>
            Every member record has a <strong>Contact Status</strong> field that can be edited from the record detail or edit page.
            Available statuses: Active, Inactive, Pending, Cancelled, Deceased, Terminated.
          </p>
          <p className="mt-2">
            This field is visible and editable on all contact, lead, and member records.
          </p>
        </SectionCard>
      </div>
    </ArticleLayout>
  );
}
