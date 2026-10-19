import React, { useState, useEffect } from 'react';
import { Database, Zap, Clock, FileSearch, CheckCircle2, ShieldCheck, RefreshCw } from 'lucide-react';
import { api } from '../api/client';
import { PerformanceReport } from '../api/types';
import { useSystem } from '../context/SystemContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';

export const PerformancePage: React.FC = () => {
  const { refreshKey, showToast } = useSystem();
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const runBenchmark = async () => {
    setIsLoading(true);
    try {
      const data = await api.getPerformanceReport();
      setReport(data);
    } catch (err: any) {
      showToast(err.message || 'Error running database performance explain()', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    runBenchmark();
  }, [refreshKey]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <Card className="bg-slate-900 text-white border-slate-800">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              <h3 className="text-sm font-semibold text-white">
                MongoDB Query Optimization & explain("executionStats")
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
              Demonstrates tangible database optimization on high-cardinality sales time-series queries.
              Compares B-tree compound index key scanning (IXSCAN) directly against unindexed full table scans (COLLSCAN).
            </p>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={runBenchmark}
            isLoading={isLoading}
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Re-run explain() Benchmark
          </Button>
        </div>
      </Card>

      {/* Summary Banner */}
      {report && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-900 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong>Benchmark Conclusion:</strong> {report.performance_summary}
          </div>
        </div>
      )}

      {/* Side-by-Side Comparison: Indexed vs Unindexed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Indexed (IXSCAN) */}
        <Card
          title="Indexed Query Execution (IXSCAN + FETCH)"
          subtitle="Targeting compound index: idx_sales_product_date_compound"
        >
          {report ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-3 bg-emerald-50/60 border border-emerald-200/80 rounded">
                  <span className="text-slate-500 block text-[11px] font-sans">Execution Stage:</span>
                  <span className="font-bold text-sm text-emerald-800">
                    {report.indexed_query_benchmark.stage}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                  <span className="text-slate-500 block text-[11px] font-sans">Execution Time:</span>
                  <span className="font-bold text-sm text-slate-900 font-mono">
                    {report.indexed_query_benchmark.execution_time_millis.toFixed(2)} ms
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs font-mono text-center">
                <div className="p-2.5 border border-slate-200 rounded">
                  <span className="text-slate-400 block text-[10px] font-sans">Docs Examined</span>
                  <span className="font-bold text-slate-800 text-sm">
                    {report.indexed_query_benchmark.total_docs_examined}
                  </span>
                </div>
                <div className="p-2.5 border border-slate-200 rounded">
                  <span className="text-slate-400 block text-[10px] font-sans">Keys Examined</span>
                  <span className="font-bold text-slate-800 text-sm">
                    {report.indexed_query_benchmark.total_keys_examined}
                  </span>
                </div>
                <div className="p-2.5 border border-slate-200 rounded">
                  <span className="text-slate-400 block text-[10px] font-sans">Docs Returned</span>
                  <span className="font-bold text-slate-800 text-sm">
                    {report.indexed_query_benchmark.n_returned}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-slate-900 text-slate-300 rounded font-mono text-[11px] space-y-1">
                <div className="text-emerald-400 font-semibold">// Winning Plan Analysis</div>
                <div>Index: {report.indexed_query_benchmark.index_used || 'idx_sales_product_date_compound'}</div>
                <div>Stage: IXSCAN -&gt; FETCH</div>
                <div>Filter: product_id = [ID], sale_date &gt;= [NOW - 60d]</div>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-slate-400">Loading explain stats...</div>
          )}
        </Card>

        {/* Right: Unindexed Table Scan (COLLSCAN) */}
        <Card
          title="Unindexed Table Scan (Forced COLLSCAN)"
          subtitle="Simulates performance when no index is present"
        >
          {report ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-3 bg-rose-50 border border-rose-200 rounded">
                  <span className="text-slate-500 block text-[11px] font-sans">Execution Stage:</span>
                  <span className="font-bold text-sm text-rose-800">
                    {report.unindexed_query_benchmark.stage}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                  <span className="text-slate-500 block text-[11px] font-sans">Execution Time:</span>
                  <span className="font-bold text-sm text-slate-900 font-mono">
                    {report.unindexed_query_benchmark.execution_time_millis.toFixed(2)} ms
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs font-mono text-center">
                <div className="p-2.5 border border-slate-200 rounded bg-rose-50/30">
                  <span className="text-slate-400 block text-[10px] font-sans">Docs Examined</span>
                  <span className="font-bold text-rose-700 text-sm">
                    {report.unindexed_query_benchmark.total_docs_examined}
                  </span>
                </div>
                <div className="p-2.5 border border-slate-200 rounded">
                  <span className="text-slate-400 block text-[10px] font-sans">Keys Examined</span>
                  <span className="font-bold text-slate-800 text-sm">0 (No Index)</span>
                </div>
                <div className="p-2.5 border border-slate-200 rounded">
                  <span className="text-slate-400 block text-[10px] font-sans">Docs Returned</span>
                  <span className="font-bold text-slate-800 text-sm">
                    {report.unindexed_query_benchmark.n_returned}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-slate-900 text-slate-300 rounded font-mono text-[11px] space-y-1">
                <div className="text-rose-400 font-semibold">// Full Scan Breakdown</div>
                <div>Index: None (Table Scan)</div>
                <div>Stage: COLLSCAN</div>
                <div>Penalty: Examines entire collection row-by-row</div>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-slate-400">Loading explain stats...</div>
          )}
        </Card>
      </div>

      {/* Active Database Indexes Registry */}
      <Card
        title="Active MongoDB Index Registry"
        subtitle="Catalog of single-field, compound, text, and unique indexes created across all collections"
      >
        <div className="space-y-4">
          {report?.indexes_by_collection &&
            Object.entries(report.indexes_by_collection).map(([collectionName, idxList]) => (
              <div key={collectionName} className="border border-slate-200 rounded-md overflow-hidden">
                <div className="bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-800 flex items-center justify-between">
                  <span className="font-mono uppercase">{collectionName}</span>
                  <span className="text-slate-500 font-sans font-normal text-[11px]">
                    {idxList.length} indexes registered
                  </span>
                </div>
                <div className="p-3 bg-white overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-100 text-[11px]">
                        <th className="pb-1 font-medium">Index Name</th>
                        <th className="pb-1 font-medium">Index Key Specification</th>
                        <th className="pb-1 font-medium">Unique Constraint</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {idxList.map((idxItem: any, i: number) => (
                        <tr key={i}>
                          <td className="py-1.5 font-bold text-slate-800">{idxItem.name}</td>
                          <td className="py-1.5 text-slate-600">
                            {Array.isArray(idxItem.key)
                              ? idxItem.key.map(([k, v]: [string, any]) => `${k}: ${v}`).join(', ')
                              : JSON.stringify(idxItem.key)}
                          </td>
                          <td className="py-1.5">
                            {idxItem.unique ? (
                              <Badge variant="emerald" size="sm">Unique</Badge>
                            ) : (
                              <span className="text-slate-400 text-[11px]">No</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
        </div>
      </Card>
    </div>
  );
};
