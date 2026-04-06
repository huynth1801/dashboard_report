import React, { useEffect, useState, useCallback } from 'react'
import { usePeriod } from '../lib/context'
import { formatCurrency, formatNumber, formatPeriod } from '../lib/format'
import { ChevronDown, ChevronRight, AlertTriangle, BarChart3, Table2 } from 'lucide-react'

interface Variant {
  variant: string
  productName: string
  units: number
  qty: number
  revenue: number
  orders: number
}

interface Product {
  productShort: string
  totalUnits: number
  totalQuantity: number
  totalRevenue: number
  totalOrders: number
  variants: Variant[]
  costPrice?: number
}

interface ProductsData {
  period: string
  products: Product[]
}

// Multi-month summary types
interface SummaryProduct {
  productShort: string
  perMonth: Record<string, number>
  perMonthRevenue: Record<string, number>
  perMonthOrders: Record<string, number>
  total: number
  totalRevenue: number
  totalOrders: number
}

interface SummaryData {
  periods: string[]
  products: SummaryProduct[]
  totals: Record<string, number>
  orderCounts: Record<string, number>
}

type SortBy = 'units' | 'revenue' | 'orders'
type ViewMode = 'monthly' | 'summary'

const SORT_LABELS: Record<SortBy, string> = {
  units: 'Số cái',
  revenue: 'Doanh thu',
  orders: 'Số đơn',
}

// ======================== Monthly View ========================
function MonthlyView({
  period,
  sortBy,
  setSortBy,
}: {
  period: string
  sortBy: SortBy
  setSortBy: (s: SortBy) => void
}) {
  const [data, setData] = useState<ProductsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [costs, setCosts] = useState<Record<string, number>>({})

  const fetchCosts = useCallback(() => {
    fetch('/api/settings/costs')
      .then(r => r.json())
      .then(d => {
        const map: Record<string, number> = {}
        for (const c of d.costs ?? []) map[c.productShort] = c.costPrice
        setCosts(map)
      })
      .catch(() => {})
  }, [])

  const fetchProducts = useCallback(() => {
    if (!period) return
    setLoading(true)
    fetch(`/api/products?period=${period}&sortBy=${sortBy}&limit=50`)
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [period, sortBy])

  useEffect(() => { fetchProducts(); fetchCosts() }, [fetchProducts, fetchCosts])

  const toggle = (name: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  const products = data?.products ?? []
  const totalUnits = products.reduce((s, p) => s + p.totalUnits, 0)
  const totalRevenue = products.reduce((s, p) => s + p.totalRevenue, 0)
  const missingCost = products.filter(p => !costs[p.productShort])

  return (
    <div>
      {/* Summary + Sort bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span className="badge badge-orange">{products.length} sản phẩm</span>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {formatNumber(totalUnits)} cái · {formatCurrency(totalRevenue)}
          </span>
          {missingCost.length > 0 && (
            <span className="badge badge-warning">
              <AlertTriangle size={10} style={{ marginRight: 3 }} />
              {missingCost.length} chưa có giá gốc
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sắp xếp theo:</span>
          <select
            className="select"
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortBy)}
          >
            {(Object.entries(SORT_LABELS) as [SortBy, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th style={{ width: 32 }}></th>
              <th>Sản phẩm</th>
              <th className="right">Số cái</th>
              <th className="right">Số lượng</th>
              <th className="right">Số đơn</th>
              <th className="right">Doanh thu</th>
              <th className="right">Giá gốc/cái</th>
              <th className="right">Giá TB/cái</th>
              <th className="right" style={{ width: 80 }}>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array(6).fill(0).map((_, i) => (
                <tr key={i}>
                  {Array(9).fill(0).map((_, j) => (
                    <td key={j}><div className="skeleton" style={{ height: 14, borderRadius: 4 }} /></td>
                  ))}
                </tr>
              ))
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={9}>
                  <div className="empty-state" style={{ padding: '40px 0' }}>
                    <div className="empty-icon">📦</div>
                    <p>Không có sản phẩm trong kỳ này</p>
                  </div>
                </td>
              </tr>
            ) : (
              products.map((product) => {
                const isExp = expanded.has(product.productShort)
                const cost = costs[product.productShort]
                const avgPrice = product.totalUnits > 0 ? product.totalRevenue / product.totalUnits : 0
                const hasCost = cost !== undefined

                return (
                  <React.Fragment key={product.productShort}>
                    <tr style={{ cursor: 'pointer' }} onClick={() => toggle(product.productShort)}>
                      <td>
                        <button className="expand-btn">
                          {isExp ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{product.productShort}</span>
                      </td>
                      <td className="right">{formatNumber(product.totalUnits)}</td>
                      <td className="right muted">{formatNumber(product.totalQuantity)}</td>
                      <td className="right muted">{formatNumber(product.totalOrders)}</td>
                      <td className="right" style={{ fontWeight: 600 }}>{formatCurrency(product.totalRevenue)}</td>
                      <td className="right">
                        {hasCost
                          ? <span style={{ color: 'var(--success)' }}>{formatCurrency(cost)}</span>
                          : <span style={{ color: 'var(--warning)' }}>—</span>
                        }
                      </td>
                      <td className="right muted">{formatCurrency(avgPrice)}</td>
                      <td className="right">
                        {hasCost
                          ? <span className="badge badge-success">✓ Đủ</span>
                          : <span className="badge badge-warning">⚠ Thiếu</span>
                        }
                      </td>
                    </tr>

                    {/* Variants */}
                    {isExp && product.variants.map((v, vi) => {
                      const variantAvg = v.units > 0 ? v.revenue / v.units : 0
                      return (
                        <tr key={vi} className="variant-row">
                          <td />
                          <td>
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)', paddingLeft: 12 }}>
                              ↳ {v.variant || '(mặc định)'}
                            </span>
                          </td>
                          <td className="right muted" style={{ fontSize: 13 }}>{formatNumber(v.units)}</td>
                          <td className="right muted" style={{ fontSize: 13 }}>{formatNumber(v.qty)}</td>
                          <td className="right muted" style={{ fontSize: 13 }}>{formatNumber(v.orders)}</td>
                          <td className="right muted" style={{ fontSize: 13 }}>{formatCurrency(v.revenue)}</td>
                          <td />
                          <td className="right muted" style={{ fontSize: 13 }}>{formatCurrency(variantAvg)}</td>
                          <td />
                        </tr>
                      )
                    })}
                  </React.Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Warning for missing costs */}
      {missingCost.length > 0 && !loading && (
        <div className="alert alert-warning" style={{ marginTop: 16 }}>
          <AlertTriangle size={16} />
          <div className="alert-body">
            <div className="alert-title">{missingCost.length} sản phẩm chưa có giá gốc</div>
            <div className="alert-desc">
              Hãy nhập giá gốc để tính lợi nhuận chính xác:{' '}
              {missingCost.slice(0, 3).map(p => p.productShort).join(', ')}
              {missingCost.length > 3 ? ` và ${missingCost.length - 3} sản phẩm khác` : ''}
            </div>
          </div>
          <a href="/settings" className="btn btn-secondary btn-sm">Nhập giá gốc →</a>
        </div>
      )}
    </div>
  )
}

// ======================== Summary View (Multi-month) ========================
function SummaryView({ periods: allPeriods }: { periods: string[] }) {
  const [data, setData] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>([])

  // Auto-select last 3 months when periods change
  useEffect(() => {
    if (allPeriods.length > 0 && selectedPeriods.length === 0) {
      setSelectedPeriods(allPeriods.slice(0, Math.min(3, allPeriods.length)))
    }
  }, [allPeriods])

  const fetchSummary = useCallback(() => {
    if (selectedPeriods.length === 0) return
    setLoading(true)
    fetch(`/api/products/summary?periods=${selectedPeriods.join(',')}`)
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [selectedPeriods])

  useEffect(() => { fetchSummary() }, [fetchSummary])

  const togglePeriod = (p: string) => {
    setSelectedPeriods(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p].sort()
    )
  }

  const sortedPeriods = data?.periods?.sort() ?? selectedPeriods.sort()

  return (
    <div>
      {/* Period Chips */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginRight: 4 }}>Chọn kỳ:</span>
        {allPeriods.map(p => (
          <button
            key={p}
            className={`btn btn-sm ${selectedPeriods.includes(p) ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => togglePeriod(p)}
            style={{ fontSize: 12, padding: '4px 10px' }}
          >
            {formatPeriod(p)}
          </button>
        ))}
      </div>

      {selectedPeriods.length === 0 ? (
        <div className="empty-state" style={{ padding: '40px 0' }}>
          <div className="empty-icon">📋</div>
          <p>Chọn ít nhất 1 kỳ để xem tổng hợp</p>
        </div>
      ) : (
        <>
          {/* Summary stats bar */}
          {data && (
            <div style={{
              display: 'flex', gap: 12, alignItems: 'center',
              marginBottom: 16, padding: '10px 14px',
              background: 'var(--bg-base)', borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              fontSize: 13, flexWrap: 'wrap',
            }}>
              {sortedPeriods.map(p => (
                <span key={p} style={{ color: 'var(--text-secondary)' }}>
                  {formatPeriod(p)}: <strong>{formatNumber(data.orderCounts[p] ?? 0)}</strong> đơn
                </span>
              ))}
              <span style={{ color: 'var(--text-muted)' }}>|</span>
              <span style={{ fontWeight: 700, color: 'var(--shopee-orange)' }}>
                Tổng: {formatNumber(data.orderCounts['total'] ?? 0)} đơn · {formatNumber(data.totals['total'] ?? 0)} cái
              </span>
            </div>
          )}

          {/* Summary Table */}
          <div className="table-container">
            <div className="table-header-bar">
              <div className="table-title">
                Tóm tắt theo sản phẩm
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8 }}>
                  ({sortedPeriods.map(p => formatPeriod(p)).join(' – ')})
                </span>
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Sản phẩm</th>
                  {sortedPeriods.map(p => (
                    <th key={p} className="right">{formatPeriod(p)}</th>
                  ))}
                  <th className="right" style={{ fontWeight: 700, color: 'var(--shopee-orange)' }}>Tổng (cái)</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array(8).fill(0).map((_, i) => (
                    <tr key={i}>
                      {Array(sortedPeriods.length + 2).fill(0).map((_, j) => (
                        <td key={j}><div className="skeleton" style={{ height: 14, borderRadius: 4 }} /></td>
                      ))}
                    </tr>
                  ))
                ) : !data || data.products.length === 0 ? (
                  <tr>
                    <td colSpan={sortedPeriods.length + 2}>
                      <div className="empty-state" style={{ padding: '40px 0' }}>
                        <div className="empty-icon">📦</div>
                        <p>Không có sản phẩm trong kỳ này</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <>
                    {data.products.map((product, idx) => (
                      <tr key={product.productShort}>
                        <td>
                          <span style={{ fontWeight: 500 }}>{product.productShort}</span>
                        </td>
                        {sortedPeriods.map(p => (
                          <td key={p} className="right" style={{ color: product.perMonth[p] ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                            {product.perMonth[p] ? formatNumber(product.perMonth[p]) : '-'}
                          </td>
                        ))}
                        <td className="right" style={{ fontWeight: 700, color: 'var(--shopee-orange)' }}>
                          {formatNumber(product.total)}
                        </td>
                      </tr>
                    ))}
                    {/* Totals row */}
                    <tr style={{
                      borderTop: '2px solid var(--shopee-orange)',
                      background: 'var(--shopee-orange-50)',
                      fontWeight: 700,
                    }}>
                      <td style={{ fontWeight: 700, color: 'var(--shopee-orange)' }}>
                        TỔNG CỘNG (SỐ CÁI THỰC TẾ)
                      </td>
                      {sortedPeriods.map(p => (
                        <td key={p} className="right" style={{ fontWeight: 700 }}>
                          {formatNumber(data.totals[p] ?? 0)}
                        </td>
                      ))}
                      <td className="right" style={{ fontWeight: 700, color: 'var(--shopee-orange)', fontSize: 15 }}>
                        {formatNumber(data.totals['total'] ?? 0)}
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

// ======================== Products Page ========================
export function ProductsPage() {
  const { period, periods } = usePeriod()
  const [viewMode, setViewMode] = useState<ViewMode>('monthly')
  const [sortBy, setSortBy] = useState<SortBy>('units')

  if (!period && viewMode === 'monthly') {
    return (
      <div className="empty-state">
        <div className="empty-icon">📦</div>
        <p>Chọn kỳ dữ liệu từ header để xem sản phẩm</p>
      </div>
    )
  }

  return (
    <div>
      {/* View Mode Toggle */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <div className="chart-toggle">
          <button
            className={`chart-toggle-btn${viewMode === 'monthly' ? ' active' : ''}`}
            onClick={() => setViewMode('monthly')}
          >
            <Table2 size={13} style={{ marginRight: 4 }} />
            Theo tháng
          </button>
          <button
            className={`chart-toggle-btn${viewMode === 'summary' ? ' active' : ''}`}
            onClick={() => setViewMode('summary')}
          >
            <BarChart3 size={13} style={{ marginRight: 4 }} />
            Tổng hợp
          </button>
        </div>
      </div>

      {viewMode === 'monthly' ? (
        <MonthlyView period={period} sortBy={sortBy} setSortBy={setSortBy} />
      ) : (
        <SummaryView periods={periods} />
      )}
    </div>
  )
}
