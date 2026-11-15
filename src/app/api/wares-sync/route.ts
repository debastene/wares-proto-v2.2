import { NextResponse } from 'next/server';

// Handle request GET untuk mengambil data Dashboard
export async function GET() {
  try {
    const response = await fetch(process.env.GAS_WEBAPP_URL as string);
    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: 'Gagal mengambil data dashboard' }, { status: 500 });
  }
}

// Handle request POST untuk mengirim input Transaksi baru
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const response = await fetch(process.env.GAS_WEBAPP_URL as string, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    });
    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: 'Gagal mencatat transaksi' }, { status: 500 });
  }
}