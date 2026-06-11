import { NextResponse } from 'next/server';

const FB_GRAPH_URL = 'https://graph.facebook.com/v22.0';

export async function POST(request: Request) {
    try {
        const accessToken = await getMetaAccessToken();

        const { id, status } = await request.json();

        if (!id || !status) {
            return NextResponse.json({ success: false, error: 'ID e status são obrigatórios' }, { status: 400 });
        }

        const url = `${FB_GRAPH_URL}/${id}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                status,
                access_token: accessToken
            })
        });

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error.message || 'Erro ao atualizar o status na Meta');
        }

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

