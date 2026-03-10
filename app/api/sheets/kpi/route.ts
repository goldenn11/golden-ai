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

// Daily metrics subset
const DAILY_OFF = {
  callsScheduled: 2,
  noShows:        3,
  liveCalls:      6,
  totalSales:     12,
  contractValue:  13,
  cashCollected:  14,
};

const DAILY_KEYS = Object.keys(DAILY_OFF) as (keyof typeof DAILY_OFF)[];

// Day-to-column mapping: day 1=C, 2=D, ..., 26=AB, 27=AC, ..., 31=AG
const DAY_COLS: string[] = [];
for (let d = 1; d <= 31; d++) {
  // C=3rd column (A=1, B=2, C=3, ...)
  const colNum = d + 2; // day 1 -> col 3 (C)
  if (colNum <= 26) {
    DAY_COLS.push(String.fromCharCode(64 + colNum));
  } else {
    DAY_COLS.push('A' + String.fromCharCode(64 + colNum - 26));
  }
}

const WEEK_BUCKETS = [
  { label: 'Week 1 (1\u20137)',   start: 1,  end: 7  },
  { label: 'Week 2 (8\u201314)',  start: 8,  end: 14 },
  { label: 'Week 3 (15\u201321)', start: 15, end: 21 },
  { label: 'Week 4 (22\u201328)', start: 22, end: 28 },
  { label: 'Week 5 (29\u201331)', start: 29, end: 31 },
];

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

    // Monthly totals ranges (existing)
    const monthlyRanges = MONTHS.flatMap(({ row }) =>
      FIELD_KEYS.map(k => `'${SHEET}'!${TOT}${row + OFF[k]}`)
    );

    // Current month daily ranges
    const now = new Date();
    const currentMonthIdx = now.getUTCMonth(); // 0-based
    const currentMonthRow = MONTHS[currentMonthIdx].row;

    const dailyRanges = DAY_COLS.flatMap(col =>
      DAILY_KEYS.map(k => `'${SHEET}'!${col}${currentMonthRow + DAILY_OFF[k]}`)
    );

    // Single batch request for everything
    const allRanges = [...monthlyRanges, ...dailyRanges];

    const resp = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: SPREADSHEET_ID,
      ranges: allRanges,
    });

    const vr = resp.data.valueRanges || [];
    const fc = FIELD_KEYS.length;
    const dc = DAILY_KEYS.length;
    const monthlyCount = monthlyRanges.length;

    // Parse monthly totals
    const months = MONTHS.map((m, mi) => {
      const get = (fi: number) => vr[mi * fc + fi]?.values?.[0]?.[0] ?? 0;
      const d = Object.fromEntries(FIELD_KEYS.map((k, fi) => [k, parseNum(get(fi))])) as Record<keyof typeof OFF, number>;

      const closeRate     = d.liveCalls > 0 ? Math.round((d.totalSales / d.liveCalls) * 100) : 0;
      const cashPerCall   = d.liveCalls > 0 ? Math.round(d.cashCollected / d.liveCalls) : 0;
      const revenuePerCall = d.liveCalls > 0 ? Math.round(d.contractValue / d.liveCalls) : 0;
      const showRate      = d.callsScheduled > 0 ? Math.round((d.liveCalls / d.callsScheduled) * 100) : 0;

      return { month: m.name, ...d, closeRate, cashPerCall, revenuePerCall, showRate };
    });

    // Parse daily data for current month
    const daily = Array.from({ length: 31 }, (_, di) => {
      const get = (fi: number) => vr[monthlyCount + di * dc + fi]?.values?.[0]?.[0] ?? 0;
      const d = Object.fromEntries(DAILY_KEYS.map((k, fi) => [k, parseNum(get(fi))])) as Record<keyof typeof DAILY_OFF, number>;
      return { day: di + 1, ...d };
    });

    // Aggregate into weekly buckets
    const weekly = WEEK_BUCKETS.map(bucket => {
      const days = daily.filter(d => d.day >= bucket.start && d.day <= bucket.end);
      const sum = (key: keyof typeof DAILY_OFF) => days.reduce((s, d) => s + d[key], 0);
      const liveCalls = sum('liveCalls');
      const totalSales = sum('totalSales');
      const closeRate = liveCalls > 0 ? Math.round((totalSales / liveCalls) * 100) : 0;
      return {
        week: bucket.label,
        callsScheduled: sum('callsScheduled'),
        noShows: sum('noShows'),
        liveCalls,
        totalSales,
        contractValue: sum('contractValue'),
        cashCollected: sum('cashCollected'),
        closeRate,
      };
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
    ytd.closeRate      = ytd.liveCalls > 0 ? Math.round((ytd.totalSales / ytd.liveCalls) * 100) : 0;
    ytd.cashPerCall    = ytd.liveCalls > 0 ? Math.round(ytd.cashCollected / ytd.liveCalls) : 0;
    ytd.revenuePerCall = ytd.liveCalls > 0 ? Math.round(ytd.contractValue / ytd.liveCalls) : 0;
    ytd.showRate       = ytd.callsScheduled > 0 ? Math.round((ytd.liveCalls / ytd.callsScheduled) * 100) : 0;

    return NextResponse.json({
      months,
      ytd,
      activeMonths: active.length,
      daily,
      weekly,
      currentMonth: MONTHS[currentMonthIdx].name,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('KPI fetch error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
