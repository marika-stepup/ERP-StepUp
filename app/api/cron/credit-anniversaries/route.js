import { NextResponse } from 'next/server';
import { checkAndCreditAnniversaries } from '../../../../lib/anniversaryService';

export async function GET(req) {
  // 1. Strict Security Check for CRON Secret (mandatory)
  const cronSecret = process.env.CRON_SECRET;
  const { searchParams } = new URL(req.url);
  const querySecret = searchParams.get('secret');
  const authHeader = req.headers.get('authorization');
  
  const isAuthorized = !!cronSecret && (
    authHeader === `Bearer ${cronSecret}` || querySecret === cronSecret
  );

  if (!isAuthorized) {
    console.warn('[Cron] Unauthorized anniversary credit attempt.');
    return NextResponse.json({ error: 'Non autorisé : secret CRON manquant ou invalide.' }, { status: 401 });
  }

  try {
    console.log('[Cron] Checking contract anniversaries...');
    const result = await checkAndCreditAnniversaries();

    return NextResponse.json({
      success: true,
      message: `Checked contract anniversaries. Credited ${result.creditedCount} users.`,
      creditedUsers: result.creditedUsers
    });

  } catch (error) {
    console.error('[Cron] Error crediting contract anniversaries:', error);
    return NextResponse.json(
      { error: 'Internal server error during contract anniversary check.' },
      { status: 500 }
    );
  }
}

