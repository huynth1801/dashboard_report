import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { usePeriod } from '../lib/context'
import { fetchWithAuth } from '../lib/api'
import { formatCurrency, formatNumber, formatPercent, calcChange, formatShort } from '../lib/format'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, ReferenceLine, ComposedChart, Line
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react'

// ======================== Types ========================
interface DashboardData {
  period: string
  kpis: {
    totalRevenue: number
    totalOrders: number
    totalUnits: number
    totalQuantity: number
    avgOrderValue: number
    netRevenue: number
    totalFees: number
    shippingAdj: number
    totalRefunds: number
    totalVouchers: number
    avgDailyRevenue: number
  }
  dailySeries: Array<{ day: string; orders: number; revenue: number; units: number; quantity: number }>
  waterfall: Array<{ label: string; value: number; type: string }>
  prevRevenue: Array<{ period: string; revenue: number }>
}

// ======================== KPI Card ========================
interface KpiCardProps {
  label: string
  value: string
  change?: number | null
  icon?: React.ReactNode
  subValue?: string
}

function KpiCard({ label, value, change, icon, subValue }: KpiCardProps) {
  const trend = change === null || change === undefined ? 'neutral' : change > 0 ? 'up' : change < 0 ? 'down' : 'neutral'
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {change !== null && change !== undefined && (
          <span className={`kpi-change ${trend}`}>
            {trend === 'up' ? <TrendingUp size={11} /> : trend === 'down' ? <TrendingDown size={11} /> : <Minus size={11} />}
            {formatPercent(change)}
          </span>
        )}
        {subValue && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{subValue}</span>}
      </div>
    </div>
  )
}

// ======================== Custom Tooltip ========================
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', padding: '10px 14px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
          <span style={{ color: 'var(--text-secondary)' }}>{p.name}:</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
            {typeof p.value === 'number' && p.value > 1000 ? formatCurrency(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

// ======================== Revenue Chart ========================
function RevenueChart({ data }: { data: DashboardData['dailySeries'] }) {
  const [mode, setMode] = useState<'revenue' | 'units'>('revenue')

  const formatted = data.map(d => ({
    ...d,
    day: d.day ? d.day.slice(5) : '', // MM-DD
  }))

  return (
    <div className="chart-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div className="chart-title">Biểu đồ theo ngày</div>
          <div className="chart-subtitle">Doanh thu & số lượng từng ngày trong tháng</div>
        </div>
        <div className="chart-toggle">
          <button className={`chart-toggle-btn${mode === 'revenue' ? ' active' : ''}`} onClick={() => setMode('revenue')}>
            Doanh thu
          </button>
          <button className={`chart-toggle-btn${mode === 'units' ? ' active' : ''}`} onClick={() => setMode('units')}>
            Số cái
          </button>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={formatted} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#EE4D2D" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#EE4D2D" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorUnits" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="day" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
            axisLine={false} tickLine={false}
            tickFormatter={v => mode === 'revenue' ? `${formatShort(v)}` : `${v}`}
          />
          <Tooltip content={<ChartTooltip />} />
          {mode === 'revenue' ? (
            <Area type="monotone" dataKey="revenue" name="Doanh thu" stroke="#EE4D2D" strokeWidth={2}
              fill="url(#colorRev)" dot={false} activeDot={{ r: 4, fill: '#EE4D2D' }} />
          ) : (
            <Area type="monotone" dataKey="units" name="Số cái" stroke="#3B82F6" strokeWidth={2}
              fill="url(#colorUnits)" dot={false} activeDot={{ r: 4, fill: '#3B82F6' }} />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ======================== Waterfall Chart ========================
function WaterfallChart({ data }: { data: DashboardData['waterfall'] }) {
  // Build stacked bar data for waterfall
  const processed = data.map((item, i) => {
    const isTotal = item.type === 'total' || i === 0
    const prevTotal = isTotal ? 0 : data.slice(0, i).reduce((acc, d) => acc + d.value, 0)
    const val = Math.abs(item.value)
    const base = isTotal ? 0 : Math.min(prevTotal, prevTotal + item.value)
    return {
      label: item.label,
      base: isTotal ? 0 : base,
      value: val,
      type: item.type,
      raw: item.value,
    }
  })

  const colors: Record<string, string> = {
    income: '#10B981',
    expense: '#EF4444',
    total: '#EE4D2D',
  }

  return (
    <div className="chart-container">
      <div className="chart-title" style={{ marginBottom: 4 }}>Phân tích doanh thu ròng</div>
      <div className="chart-subtitle">Doanh thu đơn hàng → DOANH THU RÒNG</div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={processed} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false}
            tickFormatter={v => formatShort(v)} />
          <Tooltip
            formatter={(v: any, name: any, props: any) => [
              formatCurrency(props.payload?.raw ?? 0), props.payload?.label
            ]}
            contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }}
            labelStyle={{ display: 'none' }}
            itemStyle={{ color: 'var(--text-primary)' }}
          />
          <Bar dataKey="base" stackId="a" fill="transparent" />
          <Bar dataKey="value" stackId="a" radius={[4, 4, 0, 0]}>
            {processed.map((entry, i) => (
              <Cell key={i} fill={colors[entry.type] ?? '#EE4D2D'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ======================== Dashboard Page ========================
export function DashboardPage() {
  const { period } = usePeriod()

  const { data, isPending, error, refetch } = useQuery<DashboardData>({
    queryKey: ['dashboard', period],
    queryFn: async () => {
      const r = await fetchWithAuth(`/api/dashboard?period=${period}`)
      const d = await r.json()
      if (d.error) throw new Error(d.error)
      return d
    },
    enabled: !!period,
  })

  if (!period) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📊</div>
        <p style={{ fontWeight: 600, marginBottom: 8 }}>Chưa có dữ liệu</p>
        <p>Upload file Excel Shopee để bắt đầu</p>
        <a href="/upload" className="btn btn-primary" style={{ marginTop: 16 }}>Upload ngay</a>
      </div>
    )
  }

  if (isPending) {
    return (
      <div>
        <div className="kpi-grid">
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="kpi-card">
              <div className="skeleton" style={{ height: 12, width: '60%', marginBottom: 12 }} />
              <div className="skeleton" style={{ height: 28, width: '80%', marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 20, width: 60 }} />
            </div>
          ))}
        </div>
        <div className="skeleton" style={{ height: 270, borderRadius: 14 }} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="alert alert-danger">
        <div className="alert-body">
          <div className="alert-title">Lỗi tải dữ liệu</div>
          <div className="alert-desc">{(error as Error).message}</div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => refetch()}>
          <RefreshCw size={12} /> Thử lại
        </button>
      </div>
    )
  }

  if (!data) return null

  const { kpis, dailySeries, waterfall, prevRevenue } = data
  const prevRev = prevRevenue?.[0]?.revenue ?? 0
  const revenueChange = calcChange(kpis.totalRevenue, prevRev)

  const kpiCards = [
    {
      label: 'Doanh thu đơn hàng',
      value: formatCurrency(kpis.totalRevenue),
      change: revenueChange,
      subValue: 'so với tháng trước',
    },
    {
      label: 'DOANH THU RÒNG',
      value: formatCurrency(kpis.netRevenue),
    },
    {
      label: 'Tổng đơn hoàn thành',
      value: formatNumber(kpis.totalOrders),
      subValue: 'đơn hàng',
    },
    {
      label: 'Tổng cái bán ra',
      value: formatNumber(kpis.totalUnits),
      subValue: 'sản phẩm',
    },
    {
      label: 'Số lượng bán ra',
      value: formatNumber(kpis.totalQuantity),
      subValue: 'sản phẩm (qty)',
    },
    {
      label: 'Giá trị đơn TB',
      value: formatCurrency(kpis.avgOrderValue),
    },
    {
      label: 'Phí QC/Shopee',
      value: formatCurrency(kpis.totalFees),
    },
    {
      label: 'Điều chỉnh phí ship',
      value: formatCurrency(kpis.shippingAdj),
    },
    {
      label: 'Doanh thu TB/ngày',
      value: formatCurrency(kpis.avgDailyRevenue),
    },
  ]

  return (
    <div>
      {/* KPI Grid */}
      <div className="kpi-grid">
        {kpiCards.map((card, i) => (
          <KpiCard key={i} {...card} />
        ))}
      </div>

      {/* Charts Row */}
      {dailySeries.length > 0 && <RevenueChart data={dailySeries} />}

      <div className="grid-2">
        {waterfall.length > 0 && <WaterfallChart data={waterfall} />}

        {/* Cost Breakdown — matches user's Excel */}
        <div className="chart-container">
          <div className="chart-title" style={{ marginBottom: 16 }}>Báo cáo Doanh thu Ròng</div>
          {[
            { label: 'Doanh thu đơn hàng', value: kpis.totalRevenue, color: '#10B981' },
            { label: 'Phí quảng cáo / Shopee', value: kpis.totalFees, color: '#EF4444', isExpense: true },
            { label: 'Điều chỉnh phí ship', value: kpis.shippingAdj, color: '#F59E0B', isExpense: true },
            { label: 'DOANH THU RÒNG', value: kpis.netRevenue, color: '#EE4D2D' },
          ].map((item, i) => {
            const pct = kpis.totalRevenue > 0 ? Math.abs(item.value) / kpis.totalRevenue * 100 : 0
            return (
              <div key={i} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', fontWeight: i === 3 ? 700 : 400 }}>{item.label}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: item.color }}>
                    {item.isExpense ? '-' : ''}{formatCurrency(Math.abs(item.value))}
                    {' '}
                    <span style={{ opacity: 0.6, fontWeight: 400 }}>({pct.toFixed(1)}%)</span>
                  </span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${Math.min(pct, 100)}%`, background: item.color }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Previous Periods Comparison */}
      {prevRevenue && prevRevenue.length > 0 && (
        <div className="card" style={{ marginTop: 4 }}>
          <div className="card-header">
            <div className="card-title">So sánh các kỳ trước</div>
          </div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {[{ period: data.period, revenue: kpis.totalRevenue }, ...prevRevenue].slice(0, 4).map((p, i) => (
              <div key={p.period} style={{
                flex: '1 1 140px',
                padding: '12px 16px',
                background: i === 0 ? 'var(--shopee-orange-50)' : 'var(--bg-base)',
                border: `1px solid ${i === 0 ? 'var(--shopee-orange-100)' : 'var(--border)'}`,
                borderRadius: 'var(--radius)',
              }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                  {p.period}{i === 0 ? ' (hiện tại)' : ''}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: i === 0 ? 'var(--shopee-orange)' : 'var(--text-primary)' }}>
                  {formatCurrency(p.revenue)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
