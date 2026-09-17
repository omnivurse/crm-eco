#!/usr/bin/env node
/**
 * Dry-run for the one-test-employer pilot.
 * Does not write PIF-ECO-V2. --apply is refused unless the owner sets
 * SPONSOR_PILOT_APPLY=true AND sends a new explicit approval in chat.
 */

const APPLY = process.argv.includes('--apply');
const APPLY_FLAG = process.env.SPONSOR_PILOT_APPLY === 'true';

const roster = [
  { first_name: 'Ada', last_name: 'Pilot', dob: '1984-12-10', mode: 'known_roster' },
  { first_name: 'Ben', last_name: 'Pilot', dob: '1986-03-02', mode: 'known_roster' },
  { first_name: 'Cara', last_name: 'Pilot', dob: '1990-07-19', mode: 'known_roster' },
  { first_name: 'Drew', last_name: 'Pilot', dob: '1991-01-08', mode: 'known_roster' },
  { first_name: 'Eve', last_name: 'Pilot', dob: '1988-11-21', mode: 'known_roster' },
  { first_name: 'Finn', last_name: 'Pilot', dob: '1993-05-14', mode: 'known_roster' },
  { first_name: 'Gia', last_name: 'Pilot', dob: '1987-09-30', mode: 'eligible_only' },
  { first_name: 'Hugo', last_name: 'Pilot', dob: '1992-04-17', mode: 'eligible_only' },
  { first_name: 'Ivy', last_name: 'Pilot', dob: '1989-08-03', mode: 'eligible_only' },
  { first_name: 'Jed', last_name: 'Pilot', dob: '1994-02-26', mode: 'eligible_only' },
];

const plan = {
  sponsor: 'PIFH Test Employer (do not use a live roster)',
  defaultPlan: 'existing org core plan',
  people: roster.length,
  knownRoster: roster.filter((row) => row.mode === 'known_roster').length,
  eligibleOnly: roster.filter((row) => row.mode === 'eligible_only').length,
  midYearTerm: { name: 'Finn Pilot', eligible_end: '2026-06-30' },
  shopAddOn: 'one employee test-card add-on (not billed to sponsor)',
  invoice: 'one sponsor invoice for the period; staff records offline payment',
  watchWindow: 'first 50 enrolls / first sponsor invoice',
  rollbackTrigger: 'wrong headcount, duplicate person, or charge on a sponsor-paid core',
};

console.log(JSON.stringify({ dryRun: true, applyRequested: APPLY, plan, roster }, null, 2));

if (!APPLY) {
  process.exit(0);
}

if (!APPLY_FLAG) {
  console.error('Refusing --apply: set SPONSOR_PILOT_APPLY=true only after explicit owner approval.');
  process.exit(2);
}

console.error(
  'Refusing production write: this script will not insert the 10-person pilot into PIF-ECO-V2 until the owner sends a new explicit approval in chat.',
);
process.exit(3);
