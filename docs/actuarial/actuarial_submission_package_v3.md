# Pay It Forward Health
# Actuarial Data Submission Package

**Prepared for:** Actuarial Review  
**Organization:** Pay It Forward Health  
**Platform:** Pay It Forward Technologies EMS  
**Date:** February 19, 2026  
**Version:** 3.0

---

This submission is intended to provide an actuarial firm with sufficient aggregated experience data to evaluate contribution adequacy, financial sustainability, reserve requirements, and stop-loss structuring for the Pay It Forward Health program administered on the Pay It Forward Technologies EMS platform. The organization is seeking an independent actuarial review and funding opinion. The organization is requesting an actuarial funding adequacy opinion and recommended contribution ranges, including reserve guidance and stop-loss attachment recommendations based on the provided experience data.

---

## Part 1: Privacy & Compliance Framework

### De-Identification Method

All data provided in this package is **aggregated-only, de-identified data**. De-identification is enforced at the **database level** via PostgreSQL stored procedures (`SECURITY DEFINER` functions). The application layer never has access to individual-level records.

De-identification is achieved through aggregation, suppression, and removal of all direct identifiers. The dataset contains no individually identifiable information and is intended to meet HIPAA de-identification standards as described in 45 CFR 164.514. The organization is not representing a formal Safe Harbor certification, but that all 18 identifiers are excluded and only aggregate statistics are provided.

### What is NEVER Included

- No member names, dates of birth, SSNs, or member IDs
- No email addresses, phone numbers, or physical addresses
- No individual claim/need records
- No individual payment records
- Geographic data limited to state-level only
- Age data presented only as bucketed ranges (0-17, 18-25, 26-35, 36-45, 46-55, 56-64, 65+)

### Small-Group Suppression

Any aggregated category with fewer than 5 individuals returns a suppressed value (displayed as "< 5") to prevent re-identification in small populations.

### Access Control

- Database functions validate caller authentication and organization membership
- API restricted to owner and admin roles only
- Cross-tenant isolation: one organization cannot access another's data
- All functions use `SET search_path = public` to prevent SQL injection

---

## Part 2: Actuarial Experience Data Extract Specification

The platform generates five datasets on-demand, covering a configurable lookback period (default: 24 months). All data is exportable as CSV directly from the admin dashboard.

---

### Dataset 1: Monthly Experience Summary

The primary actuarial input. Each row represents one calendar month.

| Field | Type | Description |
|-------|------|-------------|
| Period | YYYY-MM | Calendar month |
| Eligible Members | Integer | Unique members eligible for sharing at any point during the calendar month (headcount measure). Exposure for actuarial modeling is provided separately in Dataset 5 as Member Months. |
| New Members | Integer | Members who joined that month |
| Contributions Collected | Currency | Total $ collected from member sharing contributions |
| Processing Fees | Currency | Payment processing fees deducted |
| Net Revenue | Currency | Collected minus fees |
| Failed Payments | Integer | Number of failed payment attempts |
| Failed Amount | Currency | $ value of failed payments |
| Needs Submitted (Count) | Integer | Number of needs/claims filed |
| Needs Submitted ($) | Currency | Total $ value of needs filed |
| Needs Approved (Count) | Integer | Number approved for sharing |
| Needs Approved ($) | Currency | Total $ value approved |
| Needs Paid/Shared ($) | Currency | Total $ actually reimbursed/shared to members |
| Avg Need Size | Currency | Average submitted need amount |
| Median Need Size | Currency | Median submitted need amount |
| Max Single Need | Currency | Largest single need (catastrophic indicator) |
| Needs > $25,000 | Integer | Catastrophic exposure count |
| Needs > $50,000 | Integer | Severe catastrophic exposure count |
| Needs per 100 Members | Percentage | Utilization rate |
| Loss Ratio | Percentage | Paid / Collected * 100 |
| Avg Member Contribution | Currency | Collected / Eligible Members |
| IUA Applied | Currency | Total Initial Unshareable Amount applied (deductible equivalent) |
| Member Responsibility | Currency | Total member cost-share |

**Actuarial Use:** Loss ratio trending, contribution adequacy, reserve estimation, catastrophic exposure modeling, utilization trending.

---

### Dataset 2: Needs Distribution by Type (Utilization Mix)

Each row represents a need category over the full lookback period.

| Field | Type | Description |
|-------|------|-------------|
| Need Type | Text | Category (e.g., ER, preventive, surgical, diagnostic, prescription, etc.) |
| Count | Integer | Number of needs in this category |
| Total Submitted ($) | Currency | Total $ submitted |
| Total Approved ($) | Currency | Total $ approved for sharing |
| Total Paid ($) | Currency | Total $ shared/reimbursed |
| Avg Amount | Currency | Average need size for this type |
| % of Total | Percentage | This type as proportion of all needs |

**Actuarial Use:** ER vs preventive ratio, prescription cost analysis, high-cost category identification, service mix modeling.

---

### Dataset 3: Contribution Adequacy (Revenue Side)

Monthly view of the revenue/contribution pipeline.

| Field | Type | Description |
|-------|------|-------------|
| Period | YYYY-MM | Calendar month |
| Active Billing Schedules | Integer | Members with active recurring contributions |
| Avg Monthly Contribution | Currency | Average $ per member |
| Median Monthly Contribution | Currency | Median $ per member |
| Total Expected ($) | Currency | Sum of all active schedule amounts (expected revenue) |
| Total Collected ($) | Currency | Successfully processed charges |
| Total Failed ($) | Currency | Failed charge amounts |
| Failed Count | Integer | Number of failed transactions |
| Processing Fees | Currency | Payment processor fees |
| Net Revenue | Currency | Collected minus fees |
| Collection Rate | Percentage | Collected / Expected * 100 |

**Actuarial Use:** Contribution sufficiency analysis, collection risk, revenue projection, reserve funding adequacy.

---

### Dataset 4: Age-Band Loss Experience (Risk Segmentation)

Each row represents an age cohort over the full lookback period. Small groups (< 5 members) are suppressed.

| Field | Type | Description |
|-------|------|-------------|
| Age Band | Text | Bucketed range (0-17, 18-25, 26-35, 36-45, 46-55, 56-64, 65+) |
| Eligible Members | Integer | Members in this band |
| Needs Count | Integer | Needs filed by this cohort |
| Total Submitted ($) | Currency | $ submitted by this cohort |
| Total Paid ($) | Currency | $ shared/reimbursed to this cohort |
| Avg Need Size | Currency | Average need for this band |
| Needs per 100 | Percentage | Utilization rate for this band |
| Pre-Existing Condition % | Percentage | % of band with pre-existing conditions |

**Actuarial Use:** Age-adjusted risk modeling, morbidity analysis, contribution tier recommendation, stop-loss pricing.

---

### Dataset 5: Member-Month Exposure and Claims Development

Each row represents a service-month cohort and is the critical dataset for credibility analysis, reserve development, and PMPM calculation.

| Field | Type | Description |
|-------|------|-------------|
| Period | YYYY-MM | Calendar month |
| Service Month | YYYY-MM | Month in which the underlying medical service occurred (incident date cohort). Used by actuaries to build completion triangles and analyze claims by date of service rather than date of payment. |
| Member Months | Integer | Total exposure units for the month. Calculated as the count of members eligible for sharing on each day of the month, summed and divided by the number of days in the month. |
| Beginning Members | Integer | Members active on first day of month |
| Ending Members | Integer | Members active on last day of month |
| New Enrollments | Integer | Members joining during month |
| Terminations | Integer | Members leaving during month |
| Incurred Amount ($) | Currency | Approved sharing amounts attributed to the date of service (incident date), not the date of submission or approval. This represents incurred claims for actuarial loss development analysis. |
| Paid Amount ($) | Currency | Amount actually reimbursed during month |
| Pending Amount ($) | Currency | Approved but unpaid needs (open liabilities / IBNR proxy) |
| PMPM | Currency | Per Member Per Month cost (incurred amount / member-months) |
| Report Lag (Days) | Integer | Average days from incident/service date to need submission |
| Payment Lag (Days) | Integer | Average days from submission to reimbursement |

**Actuarial Use:** PMPM cost calculation, incurred-but-not-reported (IBNR) reserve development, claim completion factor triangles, solvency and reserve adequacy analysis.

---

### Portfolio Summary (Included with All Exports)

| Metric | Description |
|--------|-------------|
| Total Members | All-time member count |
| Active Members | Currently active |
| Total Needs Submitted | Count over lookback period |
| Total Amount Submitted | $ over lookback period |
| Total Amount Approved | $ approved for sharing |
| Total Amount Paid/Shared | $ actually reimbursed |
| Total Contributions Collected | $ collected from members |
| Current MRR | Monthly recurring revenue (current) |
| Avg Monthly Share | Average member contribution |
| Overall Loss Ratio | Paid / Collected |
| Collection Rate | Collected / Expected |
| Utilization per 100 | Needs per 100 active members |
| Catastrophic Needs (>$25k) | Count of high-severity needs |

---

## Part 3: What the Actuary Can Model From This Data

| Actuarial Output | Enabled By |
|-----------------|------------|
| **PMPM cost** | Dataset 5: incurred amount / member-months (true daily exposure) |
| **Expected loss ratio** | Dataset 1: paid / contributions collected |
| **Contribution adequacy** | Datasets 1 + 3: 24-month trend of loss ratio + collection rate |
| **Reserve requirements (IBNR)** | Dataset 5: pending amount + report/payment lag for completion factor triangles by service month cohort |
| **Catastrophic exposure** | Dataset 1: max single need, needs >$25k/>$50k |
| **Sustainability probability** | Datasets 1 + 5: 24-month trend of members, PMPM, revenue, loss ratio |
| **Stop-loss recommendation** | Datasets 1 + 4: distribution of max needs by month + age-band severity |
| **Contribution model / rate-setting** | Datasets 4 + 5: age-band cost per member-month + utilization rates |
| **Funding sufficiency opinion** | Dataset 3: net revenue vs Dataset 5: incurred obligations |
| **Solvency projection** | Datasets 1 + 3 + 5: revenue trajectory vs loss trajectory over 3-5 years |
| **Incurred claims development** | Dataset 5: service month cohort + report lag + payment lag enable completion factor triangles |

---

## Part 4: Data Access

The actuarial data is available via two methods:

1. **Admin Dashboard** -- Navigate to Analytics > Actuarial Data. View all five datasets in interactive tables with charts, or click "Export All CSVs" to download all datasets as CSV files in one click.

2. **API** -- `GET /api/analytics/actuarial-experience?months=24` (authenticated, admin-only). Returns the complete dataset as JSON. Lookback period is configurable from 1 to 60 months.

The data is generated in real-time from the production database. No manual extraction required.

---

## Part 5: Compliance Attestation

- This data extract contains **zero Protected Health Information (PHI)**
- All data uses aggregated `COUNT(*)`, `SUM()`, `AVG()`, and `PERCENTILE_CONT()` functions -- no individual rows are ever returned
- The system enforces de-identification at the database layer; the application cannot bypass it
- Small-group suppression (< 5) prevents re-identification in small populations
- This architecture is consistent with HHS guidance under 45 CFR 164.514

The dataset is intended for actuarial analysis of pooled financial experience only. The actuary will not receive, access, or require individually identifiable health information. All actuarial modeling can be performed using aggregated exposure, utilization, and payment statistics.

The dataset is designed to be de-identified and contain no individually identifiable health information. The determination of whether a Business Associate Agreement is required will be made by the receiving actuarial firm and applicable counsel.

---

## Part 6: Program Structure Description

The following describes the health share program mechanics that influence utilization patterns and should be considered in actuarial modeling:

### Initial Unshareable Amount (IUA)

The IUA functions as the member's responsibility threshold before sharing begins (analogous to a deductible). The IUA amount varies by plan tier and is configured per product. Members must meet their IUA before needs are eligible for sharing. The system tracks IUA amount, remaining IUA, and IUA-met status per need.

### Waiting Periods

*[To be completed by the program administrator -- specify waiting periods for new members before needs are shareable, typically 30-90 days for general needs, longer for pre-existing conditions.]*

### Pre-Existing Condition Sharing Rules

*[To be completed by the program administrator -- specify whether pre-existing conditions are shareable after a waiting period (e.g., 12-24 months), and any limitations on sharing amounts for pre-existing conditions.]*

### Maternity Sharing Rules

*[To be completed by the program administrator -- specify maternity sharing eligibility, waiting periods, and maximum sharing amounts.]*

### Maximum Sharing Limits

The system supports maximum annual share limits per product configuration. Individual needs are capped at the approved amount after IUA application.

*[To be completed by the program administrator -- specify per-need maximums, annual maximums, and lifetime maximums if applicable.]*

### Network / Reference Pricing

*[To be completed by the program administrator -- specify whether a PPO network is used, reference-based pricing methodology, or cash-pay discount arrangements.]*

### Prescription Sharing Structure

*[To be completed by the program administrator -- specify whether prescriptions are shareable, any formulary restrictions, and maximum amounts.]*

### Membership Eligibility Requirements

*[To be completed by the program administrator -- specify age limits, geographic restrictions, health attestation requirements, and any exclusion criteria.]*

> **Note to Program Administrator:** The bracketed items above must be completed with your specific program rules before submission to the actuary. The actuary requires this information because utilization behavior is directly influenced by benefit design -- they price the behavior a plan encourages.

---

## Part 7: What Happens Next

Upon receiving this package with the accompanying CSV exports, the actuarial firm will typically:

1. Validate dataset structure and credibility of exposure data
2. Request CSV exports (available via one-click download from the admin panel)
3. Run credibility analysis on the member-month exposure data
4. Build a PMPM cost curve by age band and service month
5. Compute completion factors from report and payment lag data
6. Estimate expected loss ratio and trend
7. Recommend contribution ranges by tier
8. Recommend reserve levels (including IBNR)
9. Recommend stop-loss attachment point
10. Issue an **Actuarial Memorandum**

The Actuarial Memorandum enables:
- Onboarding new organizations to the platform
- Proving program sustainability to partners and regulators
- Negotiating reinsurance or stop-loss coverage
- Defending against regulatory scrutiny
- Attracting larger advisor groups and institutional partnerships

---

*End of Actuarial Data Submission Package v3.0*
