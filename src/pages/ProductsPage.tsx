import React, { useEffect, useState, useCallback } from 'react'
import { usePeriod } from '../lib/context'
import { formatCurrency, formatNumber } from '../lib/format'
import { ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react'

interface Variant {
  variant: string
  productName: string
  units: number
  revenue: number
  orders: number
}

interface Product {
  productShort: string
  totalUnits: number
  totalRevenue: number
  totalOrders: number
  variants: Variant[]
  costPrice?: number
}

interface ProductsData {
  period: string
  products: Product[]
}

type SortBy = 'units' | 'revenue' | 'orders'

const SORT_LABELS: Record<SortBy, string> = {
  units: 'Số cái',
  revenue: 'Doanh thu',
  orders: 'Số đơn',
}

export function ProductsPage() {
  const { period } = usePeriod()
  const [data, setData] = useState<ProductsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [sortBy, setSortBy] = useState<SortBy>('units')
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

  if (!period) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📦</div>
        <p>Chọn kỳ dữ liệu từ header để xem sản phẩm</p>
      </div>
    )
  }

  const products = data?.products ?? []

  // Summary stats
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
                  {Array(8).fill(0).map((_, j) => (
                    <td key={j}><div className="skeleton" style={{ height: 14, borderRadius: 4 }} /></td>
                  ))}
                </tr>
              ))
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={8}>
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
