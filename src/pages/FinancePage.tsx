import React, { useEffect, useState, useCallback } from 'react'
import { usePeriod } from '../lib/context'
import { fetchWithAuth } from '../lib/api'
import { formatCurrency, formatDate, formatPeriod } from '../lib/format'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend
} from 'recharts'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Transaction {
  id: string
  date: string
  type: string
  typeRaw: string
  detail: string
  orderId: string
  amount: number
}

interface Summary {
  type: string
  total: number
  count: number
}

interface Comparison {
  period: string
  income: number
  expense: number
  net: number
}

interface FinanceData {
  period: string
  transactions: Transaction[]
  summary: Summary[]
  comparison: Comparison[]
}

const TYPE_LABELS: Record<string, string> = {
  revenue: 'Doanh thu đơn hàng',
  ads: 'Quảng cáo',
  adjustment: 'Điều chỉnh',
  withdrawal: 'Rút tiền',
  return_refund: 'Hoàn tiền',
  service_fee: 'Phí dịch vụ',
  commission_fee: 'Hoa hồng',
  shipping_rebate: 'Hoàn phí ship',
  voucher: 'Voucher',
}

const TYPE_BADGE: Record<string, string> = {
  revenue: 'badge-success',
  ads: 'badge-danger',
  adjustment: 'badge-warning',
  withdrawal: 'badge-info',
  return_refund: 'badge-danger',
  service_fee: 'badge-warning',
  commission_fee: 'badge-warning',
  shipping_rebate: 'badge-success',
  voucher: 'badge-neutral',
}

const PAGE_SIZE = 20

export function FinancePage() {
  const { period } = usePeriod()
  const [data, setData] = useState<FinanceData | null>(null)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [typeFilter, setTypeFilter] = useState<string>('all')

  const fetchData = useCallback(() => {
    if (!period) return
    setLoading(true)
    fetchWithAuth(`/api/finance?period=${period}`)
      .then(r => r.json())
      .then(d => { setData(d); setPage(1) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [period])

  useEffect(() => { fetchData() }, [fetchData])

  if (!period) {
    return (
      <div className="empty-state">
        <div className="empty-icon">💰</div>
        <p>Chọn kỳ dữ liệu để xem tài chính</p>
      </div>
    )
  }

  const allTx = data?.transactions ?? []
  const filtered = typeFilter === 'all' ? allTx : allTx.filter(t => t.type === typeFilter)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  const uniqueTypes = Array.from(new Set(allTx.map(t => t.type)))

  // Comparison bar chart data
  const chartData = (data?.comparison ?? []).map(c => ({
    period: formatPeriod(c.period),
    'Thu nhập': c.income,
    'Chi phí': c.expense,
  })).reverse()

  return (
    <div>
      {/* Top: Comparison charts */}
      {data?.comparison && data.comparison.length > 0 && (
        <div className="grid-2" style={{ marginBottom: 24 }}>
          <div className="chart-container" style={{ margin: 0 }}>
            <div className="chart-title" style={{ marginBottom: 4 }}>So sánh 3 kỳ</div>
            <div className="chart-subtitle">Thu nhập & Chi phí theo tháng</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="period" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false}
                  tickFormatter={v => `${(v / 1e6).toFixed(0)}M`} />
                <Tooltip
                  formatter={(v: any) => formatCurrency(v)}
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }}
                  itemStyle={{ color: 'var(--text-primary)' }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Thu nhập" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Chi phí" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Summary by type */}
          <div className="card" style={{ margin: 0 }}>
            <div className="card-title" style={{ marginBottom: 14 }}>Tổng hợp theo loại</div>
            {loading ? (
              Array(4).fill(0).map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 36, borderRadius: 6, marginBottom: 8 }} />
              ))
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(data?.summary ?? []).slice(0, 6).map((s, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 12px', background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)'
                  }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span className={`badge ${TYPE_BADGE[s.type] ?? 'badge-neutral'}`}>
                        {TYPE_LABELS[s.type] ?? s.type}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.count} tx</span>
                    </div>
                    <span style={{
                      fontSize: 13, fontWeight: 600,
                      color: s.total >= 0 ? 'var(--success)' : 'var(--danger)'
                    }}>
                      {s.total >= 0 ? '+' : ''}{formatCurrency(s.total)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Comparison period table */}
      {data?.comparison && (
        <div className="table-container" style={{ marginBottom: 24 }}>
          <div className="table-header-bar">
            <div className="table-title">So sánh kỳ</div>
          </div>
          <table>
            <thead className="comparison-header">
              <tr>
                <th>Kỳ</th>
                <th className="right">Thu nhập</th>
                <th className="right">Chi phí</th>
                <th className="right">Thực nhận</th>
              </tr>
            </thead>
            <tbody>
              {data.comparison.map((c, i) => (
                <tr key={i} style={i === 0 ? { background: 'var(--shopee-orange-50)' } : {}}>
                  <td>
                    <span style={{ fontWeight: 600 }}>{formatPeriod(c.period)}</span>
                    {i === 0 && <span className="badge badge-orange" style={{ marginLeft: 8 }}>Hiện tại</span>}
                  </td>
                  <td className="right" style={{ color: 'var(--success)', fontWeight: 600 }}>
                    {formatCurrency(c.income)}
                  </td>
                  <td className="right" style={{ color: 'var(--danger)', fontWeight: 600 }}>
                    -{formatCurrency(c.expense)}
                  </td>
                  <td className="right" style={{ fontWeight: 700 }}>
                    {formatCurrency(c.net)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Transaction table */}
      <div className="table-container">
        <div className="table-header-bar">
          <div className="table-title">
            Chi tiết giao dịch
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8 }}>
              {filtered.length} giao dịch
            </span>
          </div>
          <select className="select" value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1) }}>
            <option value="all">Tất cả loại</option>
            {uniqueTypes.map(t => (
              <option key={t} value={t}>{TYPE_LABELS[t] ?? t}</option>
            ))}
          </select>
        </div>

        <table>
          <thead>
            <tr>
              <th>Ngày</th>
              <th>Loại</th>
              <th>Chi tiết</th>
              <th>Mã đơn</th>
              <th className="right">Số tiền</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array(10).fill(0).map((_, i) => (
                <tr key={i}>
                  {Array(5).fill(0).map((_, j) => (
                    <td key={j}><div className="skeleton" style={{ height: 13, borderRadius: 4 }} /></td>
                  ))}
                </tr>
              ))
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <div className="empty-state" style={{ padding: '32px 0' }}>
                    <p>Không có giao dịch phù hợp</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginated.map(tx => (
                <tr key={tx.id}>
                  <td className="muted" style={{ fontSize: 12.5 }}>{formatDate(tx.date)}</td>
                  <td>
                    <span className={`badge ${TYPE_BADGE[tx.type] ?? 'badge-neutral'}`}>
                      {TYPE_LABELS[tx.type] ?? tx.typeRaw ?? tx.type}
                    </span>
                  </td>
                  <td className="muted" style={{ fontSize: 12.5, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {tx.detail ?? '—'}
                  </td>
                  <td className="muted" style={{ fontSize: 12, fontFamily: 'monospace' }}>
                    {tx.orderId ? tx.orderId.slice(0, 12) + '…' : '—'}
                  </td>
                  <td className="right" style={{
                    fontWeight: 600,
                    color: tx.amount >= 0 ? 'var(--success)' : 'var(--danger)'
                  }}>
                    {tx.amount >= 0 ? '+' : ''}{formatCurrency(tx.amount)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <button className="page-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const p = i + 1
              return (
                <button key={p} className={`page-btn${p === page ? ' active' : ''}`} onClick={() => setPage(p)}>
                  {p}
                </button>
              )
            })}
            {totalPages > 7 && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>…</span>}
            <button className="page-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
