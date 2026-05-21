import { NextResponse } from 'next/server';
import { listMemberEnrollments } from '@/lib/data/member';

export const dynamic = 'force-dynamic';

export async function GET() {
  const enrollments = await listMemberEnrollments();
  return NextResponse.json({ enrollments });
}
