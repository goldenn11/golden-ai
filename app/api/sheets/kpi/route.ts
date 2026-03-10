import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export const dynamic = 'force-dynamic';

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;
const SHEET = 'KPI Tracker';
const TOT = 'AH'; // Total column

const MONTHS = [
  { name: 'January',   row: 4   },
  { name: 'February',  row: 26  },
  { name: 'March',     row: 48  },
  { name: 'April',     row: 70  },
  { name: 'May',       row: 92  },
  { name: 'June',      row: 113 },
  { name: 'July',      row: 135 },
  { name: 'August',    row: 157 },
  { name: 'September', row: 179 },
  { name: 'October',   row: 201 },
  { name: 'November',  row: 223 },
  { name: 'December',  row: 245 },
];

// Offsets from month header row (confirmed from actual sheet structure)
const OFF = {
  callsScheduled: 2,
  noShows:        3,
  reschedules:    4,
  cancels:        5,
  liveCalls:      6,
  deposits:       9,
  salesOneCall:   10,
  followUpSales:  11,
  totalSales:     12,
  contractValue:  13,
  cashCollected:  14,
};

const FIELD_KEYS = Object.keys(OFF) as (keyof typeof OFF)[];

function parseNum(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0;
  const s = String(val).replace(/[$,%\s]/g, '');
  return parseFloat(s) || 0;
}

export async function GET() {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // One batch request for all cells
    const ranges = MONTHS.flatMap(({ row }) =>
      FIELD_KEYS.map(k => `'${SHEET}'!${TOT}${row + OFF[k]}`)
    );

    const resp = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: SPREADSHEET_ID,
      ranges,
    });

    const vr = resp.data.valueRanges || [];
    const fc = FIELD_KEYS.length;

    const months = MONTHS.map((m, mi) => {
      const get = (fi: number) => vr[mi * fc + fi]?.values?.[0]?.[0] ?? 0;
      const d = Object.fromEntries(FIELD_KEYS.map((k, fi) => [k, parseNum(get(fi))])) as Record<keyof typeof OFF, number>;

      // Calculate rates from raw numbers (sheet formula cells return null in API)
      const closeRate     = d.liveCalls > 0 ? Math.round((d.totalSales / d.liveCalls) * 100) : 0;
      const cashPerCall   = d.liveCalls > 0 ? Math.round(d.cashCollected / d.liveCalls) : 0;
      const revenuePerCall = d.liveCalls > 0 ? Math.round(d.contractValue / d.liveCalls) : 0;
      const showRate      = d.callsScheduled > 0 ? Math.round((d.liveCalls / d.callsScheduled) * 100) : 0;

      return { month: m.name, ...d, closeRate, cashPerCall, revenuePerCall, showRate };
    });

    const active = months.filter(m => m.liveCalls > 0);

    const ytd = {
      callsScheduled: active.reduce((s, m) => s + m.callsScheduled, 0),
      liveCalls:      active.reduce((s, m) => s + m.liveCalls, 0),
      noShows:        active.reduce((s, m) => s + m.noShows, 0),
      totalSales:     active.reduce((s, m) => s + m.totalSales, 0),
      contractValue:  active.reduce((s, m) => s + m.contractValue, 0),
      cashCollected:  active.reduce((s, m) => s + m.cashCollected, 0),
      revenuePerCall: 0,
      closeRate:      0,
      cashPerCall:    0,
      showRate:       0,
    };
    ytd.closeRate   = ytd.liveCalls > 0 ? Math.round((ytd.totalSales / ytd.liveCalls) * 100) : 0;
    ytd.cashPerCall = ytd.liveCalls > 0 ? Math.round(ytd.cashCollected / ytd.liveCalls) : 0;
    ytd.revenuePerCall = ytd.liveCalls > 0 ? Math.round(ytd.contractValue / ytd.liveCalls) : 0;
    ytd.showRate    = ytd.callsScheduled > 0 ? Math.round((ytd.liveCalls / ytd.callsScheduled) * 100) : 0;

    return NextResponse.json({ months, ytd, activeMonths: active.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('KPI fetch error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
