export const runtime = 'nodejs'

import { NextResponse } from 'next/server'

export async function GET() {
  // Cost data is computed client-side from cron run data via /api/logs.
  // This endpoint is kept as a placeholder for future detailed cost tracking.
  return NextResponse.json({
    totalCost: 0,
    categories: {
      anthropic: 0,
      vapi: 0,
      make: 0,
      vercel: 0,
    },
    message: 'Cost tracking populates as crons run and usage data accumulates.',
  })
}
