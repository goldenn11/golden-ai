'use client';
import { useEffect, useState } from 'react';

interface Month {
  month: string;
  callsScheduled: number; noShows: number; reschedules: number;
  cancels: number; liveCalls: number; deposits: number;
  salesOneCall: number; followUpSales: number; totalSales: number;
  contractValue: number; cashCollected: number;
  closeRate: number; cashPerCall: number; revenuePerCall: number; showRate: number;
}
interface KPIData { months: Month[]; ytd: Record<string, number>; activeMonths: number; }

const fmt$ = (n: number) => n > 0 ? '$' + n.toLocaleString() : '\u2014';
const fmtN = (n: number) => n > 0 ? String(n) : '\u2014';
const fmtP = (n: number) => n > 0 ? n + '%' : '\u2014';

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-5">
      <div className="text-[11px] text-gray-500 uppercase tracking-widest mb-1">{label}</div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

export default function KPIPage() {
  const [data, setData] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updated, setUpdated] = useState('');

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch('/api/sheets/kpi');
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setData(j);
      setUpdated(new Date().toLocaleTimeString());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const active = data?.months.filter(m => m.liveCalls > 0) ?? [];

  return (
    <div className="flex-1 overflow-auto p-6 bg-black min-h-screen text-white">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Deal Scout Elite &mdash; KPIs</h1>
          {updated && <p className="text-xs text-gray-500 mt-1">Updated {updated}</p>}
        </div>
        <button onClick={load} disabled={loading}
          className="px-4 py-2 text-sm bg-[#111] border border-[#2a2a2a] rounded-lg text-gray-300 hover:bg-[#1a1a1a] disabled:opacity-40 transition">
          {loading ? 'Loading...' : '\u21BB Refresh'}
        </button>
      </div>

      {error && <div className="mb-6 p-4 bg-red-950 border border-red-800 rounded-xl text-red-300 text-sm">{error}</div>}
      {loading && !data && <div className="text-gray-500 text-sm">Fetching from Google Sheets...</div>}

      {data && <>
        <p className="text-[11px] text-gray-500 uppercase tracking-widest mb-3">
          YTD &middot; {data.activeMonths} active month{data.activeMonths !== 1 ? 's' : ''}
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <Card label="Live Calls"      value={fmtN(data.ytd.liveCalls)}    sub={`${data.ytd.callsScheduled} scheduled \u00b7 ${data.ytd.showRate}% show`} />
          <Card label="Close Rate"      value={fmtP(data.ytd.closeRate)}     sub={`${data.ytd.totalSales} sales from ${data.ytd.liveCalls} calls`} />
          <Card label="Contract Value"  value={fmt$(data.ytd.contractValue)} sub={`${fmt$(data.ytd.revenuePerCall || 0)} / call`} />
          <Card label="Cash Collected"  value={fmt$(data.ytd.cashCollected)} sub={`${fmt$(data.ytd.cashPerCall)} / call`} />
        </div>

        {/* Monthly table */}
        <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl overflow-hidden mb-6">
          <div className="px-5 py-3 border-b border-[#1a1a1a] text-sm font-semibold text-gray-300">Monthly Breakdown</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1a1a1a] text-[11px] text-gray-500 uppercase tracking-wider">
                  {['Month','Sched','Live','No Shows','Show%','Sales','Close%','Contract','Cash','$/Call'].map(h =>
                    <th key={h} className="text-left px-4 py-3 font-medium whitespace-nowrap">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {data.months.map(m => (
                  <tr key={m.month} className={`border-b border-[#111] transition-colors ${m.liveCalls > 0 ? 'hover:bg-[#111]' : 'opacity-25'}`}>
                    <td className="px-4 py-3 font-medium">{m.month}</td>
                    <td className="px-4 py-3 text-gray-400">{fmtN(m.callsScheduled)}</td>
                    <td className="px-4 py-3 text-gray-300">{fmtN(m.liveCalls)}</td>
                    <td className="px-4 py-3 text-gray-500">{fmtN(m.noShows)}</td>
                    <td className="px-4 py-3 text-gray-400">{fmtP(m.showRate)}</td>
                    <td className="px-4 py-3">{m.totalSales > 0 ? <span className="text-green-400 font-semibold">{m.totalSales}</span> : <span className="text-gray-600">{'\u2014'}</span>}</td>
                    <td className="px-4 py-3">{m.closeRate > 0 ? <span className={m.closeRate >= 25 ? 'text-green-400' : 'text-yellow-500'}>{m.closeRate}%</span> : <span className="text-gray-600">{'\u2014'}</span>}</td>
                    <td className="px-4 py-3 text-gray-300">{fmt$(m.contractValue)}</td>
                    <td className="px-4 py-3 text-gray-300">{fmt$(m.cashCollected)}</td>
                    <td className="px-4 py-3 text-gray-400">{fmt$(m.cashPerCall)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sales breakdown for active months only */}
        {active.length > 0 && (
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-[#1a1a1a] text-sm font-semibold text-gray-300">Sales Breakdown</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1a1a1a] text-[11px] text-gray-500 uppercase tracking-wider">
                    {['Month','Deposits','One-Call','Follow-Up','Total','Contract','Cash'].map(h =>
                      <th key={h} className="text-left px-4 py-3 font-medium whitespace-nowrap">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {active.map(m => (
                    <tr key={m.month} className="border-b border-[#111] hover:bg-[#111] transition-colors">
                      <td className="px-4 py-3 font-medium">{m.month}</td>
                      <td className="px-4 py-3 text-gray-300">{fmtN(m.deposits)}</td>
                      <td className="px-4 py-3 text-gray-300">{fmtN(m.salesOneCall)}</td>
                      <td className="px-4 py-3 text-gray-300">{fmtN(m.followUpSales)}</td>
                      <td className="px-4 py-3 text-green-400 font-semibold">{m.totalSales}</td>
                      <td className="px-4 py-3 text-gray-300">{fmt$(m.contractValue)}</td>
                      <td className="px-4 py-3 text-gray-300">{fmt$(m.cashCollected)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </>}
    </div>
  );
}
