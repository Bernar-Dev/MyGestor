import { NextRequest, NextResponse } from 'next/server';
import { getActiveAdsForCampaign } from '@/lib/facebook';
import { getMetaAccessToken } from '@/lib/meta-token';

export const dynamic = 'force-dynamic';

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const accessToken = await getMetaAccessToken();
        const ads = await getActiveAdsForCampaign(id, accessToken);
        return NextResponse.json({ success: true, data: ads, count: ads.length });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message || 'Erro ao buscar anúncios ativos da campanha' },
            { status: 500 }
        );
    }
}

