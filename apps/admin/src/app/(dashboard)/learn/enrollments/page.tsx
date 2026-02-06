import { ArticleLayout, StepList, QuickTip, SectionCard } from '@/components/learn/LearnComponents';

export default function EnrollmentsLearnPage() {
  return (
    <ArticleLayout
      title="Enrollment Processing"
      description="Learn the complete enrollment lifecycle from application to activation."
      readTime="5 min read"
    >
      <SectionCard title="Enrollment Lifecycle">
        <p>
          Every enrollment goes through a defined lifecycle with status tracking at each step.
          Understanding this flow is key to efficiently processing enrollments.
        </p>
        <ul className="list-disc pl-5 space-y-2 mt-2">
          <li><strong>Pending</strong> — The enrollment has been submitted and is awaiting review.</li>
          <li><strong>Approved</strong> — The enrollment has been reviewed and approved by staff.</li>
          <li><strong>Active</strong> — The enrollment is live and the member has coverage.</li>
          <li><strong>Terminated</strong> — The enrollment has been ended (voluntarily or involuntarily).</li>
          <li><strong>Rejected</strong> — The enrollment was not approved, with a reason logged.</li>
        </ul>
      </SectionCard>

      <div id="processing">
        <SectionCard title="Processing a New Enrollment">
          <StepList steps={[
            {
              title: 'Review the Enrollment',
              description: 'Navigate to the enrollment detail page. Review the member information, selected plan, effective date, and any dependents included.',
            },
            {
              title: 'Verify Member Information',
              description: 'Confirm that the member\'s profile is complete — name, date of birth, contact information, and any required documents.',
            },
            {
              title: 'Check Plan Eligibility',
              description: 'Ensure the member meets the eligibility requirements for the selected plan (age limits, geographic restrictions, etc.).',
            },
            {
              title: 'Process the Enrollment',
              description: 'Click "Approve" to move the enrollment to active status, or "Reject" with a reason if it cannot be approved.',
            },
          ]} />
        </SectionCard>
      </div>

      <div id="approval">
        <SectionCard title="Approval & Rejection">
          <p>
            The enrollment system tracks every approval and rejection action with a complete audit trail:
          </p>
          <ul className="list-disc pl-5 space-y-2 mt-2">
            <li><strong>submitted_at</strong> — When the enrollment was first created.</li>
            <li><strong>approved_at / approved_by</strong> — When and who approved the enrollment.</li>
            <li><strong>rejected_at / rejection_reason</strong> — When rejected and the documented reason.</li>
            <li><strong>cancelled_at / cancelled_reason</strong> — If an active enrollment was later cancelled.</li>
            <li><strong>last_status_change_at</strong> — Timestamp of the most recent status change.</li>
          </ul>
        </SectionCard>
      </div>

      <QuickTip title="Enrollment Codes">
        Every enrollment is assigned a unique <strong>enrollment_code</strong> automatically.
        You can search enrollments by this code in the Command Center: <code>enrollment ENR-12345</code>
      </QuickTip>

      <div id="links">
        <SectionCard title="Enrollment Links & QR Codes">
          <p>
            Enrollment links allow agents to share branded landing pages where prospective members can start the enrollment process.
          </p>
          <StepList steps={[
            {
              title: 'Create an Enrollment Link',
              description: 'Go to Enrollment Links → Create. Select an agent and configure the landing page content.',
            },
            {
              title: 'Share the Link or QR Code',
              description: 'Copy the unique URL or download the QR code image to share with potential members.',
            },
            {
              title: 'Track Performance',
              description: 'Monitor page views, clicks, and enrollment conversions from each link in the analytics dashboard.',
            },
          ]} />
        </SectionCard>
      </div>

      <QuickTip title="Bulk Enrollment Search" type="info">
        Use <code>search enrollment active</code> to find all active enrollments, or
        <code>search enrollment pending</code> for those awaiting review.
      </QuickTip>
    </ArticleLayout>
  );
}
