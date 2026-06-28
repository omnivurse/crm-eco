/**
 * Curated, reviewed imagery for Pay It Forward Health.
 * Every ID below was verified to resolve (HTTP 200) from images.unsplash.com,
 * which is already whitelisted in next.config. Alt text is intentionally general
 * so it stays accurate. Use `imageUrl()` to request a sized, auto-formatted URL.
 */

export type SiteImage = { id: string; alt: string };

const BASE = 'https://images.unsplash.com/';

export function imageUrl(img: SiteImage, width = 1200, quality = 80): string {
  return `${BASE}${img.id}?auto=format&fit=crop&w=${width}&q=${quality}`;
}

export const IMAGES = {
  heroDoctorPatient: { id: 'photo-1576091160550-2173dba999ef', alt: 'A clinician listening closely to a patient in a warm consultation room' },
  familyTogether:    { id: 'photo-1511895426328-dc8714191300', alt: 'A happy family smiling together at home' },
  consultation:      { id: 'photo-1631217868264-e5b90bb7e133', alt: 'A doctor reviewing a care plan with a patient' },
  clinicianSmiling:  { id: 'photo-1559839734-2b71ea197ec2', alt: 'A friendly healthcare provider smiling' },
  telehealth:        { id: 'photo-1638202993928-7267aad84c31', alt: 'A member meeting a doctor on a video visit' },
  doctorPortrait:    { id: 'photo-1505751172876-fa1923c5c528', alt: 'A confident physician in a bright clinic' },
  nurseCare:         { id: 'photo-1576765608535-5f04d1e3f289', alt: 'A caring nurse with a patient' },
  doctorTablet:      { id: 'photo-1593104547489-5cfb3839a3b5', alt: 'A doctor reviewing notes on a tablet' },
  teamMeeting:       { id: 'photo-1556761175-5973dc0f32e7', alt: 'A team collaborating in a bright office' },
  teamCollab:        { id: 'photo-1454165804606-c3d57bc86b40', alt: 'Colleagues working together around a table' },
  familyOutdoor:     { id: 'photo-1591604021695-0c69b7c05981', alt: 'A family enjoying time together outdoors' },
  parentChild:       { id: 'photo-1518152006812-edab29b069ac', alt: 'A parent holding their young child' },
  community:         { id: 'photo-1530497610245-94d3c16cda28', alt: 'Community members helping one another' },
  wellness:          { id: 'photo-1606166325683-e6deb697d301', alt: 'A person staying active and well outdoors' },
  pharmacy:          { id: 'photo-1532938911079-1b06ac7ceec7', alt: 'A pharmacist preparing a prescription' },
  seniorCare:        { id: 'photo-1577880216142-8549e9488dad', alt: 'An older adult on a video health visit' },
  portraitWoman:     { id: 'photo-1573497019940-1c28c88b4f3e', alt: 'Portrait of a smiling member' },
  happyPeople:       { id: 'photo-1469571486292-0ba58a3f068b', alt: 'People laughing together outdoors' },
} as const;

export type ImageKey = keyof typeof IMAGES;
