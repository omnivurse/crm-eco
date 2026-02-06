import { ArticleLayout, StepList, QuickTip, SectionCard } from '@/components/learn/LearnComponents';

export default function MembersLearnPage() {
  return (
    <ArticleLayout
      title="Member Management"
      description="Learn how to create, edit, and manage member profiles and their dependents."
      readTime="4 min read"
    >
      <SectionCard title="Overview">
        <p>
          The Members module is the heart of the Admin Portal. Here you manage all member profiles,
          track their enrollment status, manage dependents, and maintain contact information.
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
            title: 'Set Member Status',
            description: 'Choose the appropriate status: Active, Inactive, or Pending. New members are typically set to Pending until enrollment is confirmed.',
          },
          {
            title: 'Save the Member',
            description: 'Click "Save" to create the member profile. You can then proceed to add dependents and enrollment records.',
          },
        ]} />
      </SectionCard>

      <div id="dependents">
        <SectionCard title="Managing Dependents">
          <p>
            Dependents are family members covered under a member&#39;s enrollment, such as spouses and children.
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
              description: 'Click "Add Dependent" and enter their name, date of birth, relationship (spouse/child), and coverage role.',
            },
          ]} />
        </SectionCard>
      </div>

      <QuickTip title="Coverage Roles">
        Each dependent has a <strong>coverage_role</strong> (spouse or child) and an <strong>included_in_enrollment</strong> flag.
        You can exclude specific dependents from coverage on particular enrollments without removing them from the household.
      </QuickTip>

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

      <div id="search">
        <SectionCard title="Searching & Filtering Members">
          <p>
            Use the search bar on the Members page to find members by name, email, or phone number.
            You can also use the Command Center:
          </p>
          <ul className="list-disc pl-5 space-y-2 mt-2">
            <li><code>member John</code> — Search for members named John</li>
            <li><code>search member john@example.com</code> — Search by email</li>
            <li><code>member</code> — Navigate to the full members list</li>
          </ul>
        </SectionCard>
      </div>
    </ArticleLayout>
  );
}
