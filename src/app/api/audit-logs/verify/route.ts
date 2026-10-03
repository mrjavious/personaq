import { NextResponse } from 'next/server';
import { verifyAuditLogChain } from '@/lib/audit/service';
import { withApi } from '@/lib/api/handler';

export const GET = withApi(
  async (request: Request) => {
    const { searchParams } = new URL(request.url);
    const maxRecords = searchParams.get('maxRecords')
      ? parseInt(searchParams.get('maxRecords')!, 10)
      : 1000;

    const verification = await verifyAuditLogChain({ maxRecords });
    return NextResponse.json({
      success: verification.valid,
      verification,
    });
  },
  { permission: 'manage_platform_rules' }
);
