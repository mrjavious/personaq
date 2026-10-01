import { NextResponse } from 'next/server';
import { getComplianceAuditReport } from '@/lib/compliance/service';
import { requireAuth } from '@/lib/auth/guards';

export async function GET() {
  try {
    await requireAuth();
    const report = await getComplianceAuditReport();
    return NextResponse.json({ report });
  } catch (error) {
    console.error('Error generating compliance report:', error);
    return NextResponse.json({ error: 'Failed to generate compliance report' }, { status: 500 });
  }
}
