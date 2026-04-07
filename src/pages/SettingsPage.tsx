import React, { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../lib/context'
import { fetchWithAuth } from '../lib/api'
import { formatCurrency } from '../lib/format'
import { Pencil, Check, X, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react'

interface ProductCost {
  productShort: string
  costPrice: number | null
  note?: string
}

type RowState = 'view' | 'edit' | 'saving'

interface CostRowProps {
  product: ProductCost
  isHighlighted: boolean
  onSave: (productShort: string, costPrice: number, note?: string) => Promise<void>
}

function CostRow({ product, isHighlighted, onSave }: CostRowProps) {
  const [state, setState] = useState<RowState>('view')
  const [inputVal, setInputVal] = useState(product.costPrice?.toString() ?? '')
  const [noteVal, setNoteVal] = useState(product.note ?? '')
  const [error, setError] = useState<string | null>(null)
  const rowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isHighlighted && rowRef.current) {
      rowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [isHighlighted])

  const handleSave = async () => {
    const val = parseFloat(inputVal.replace(/[,\s]/g, ''))
    if (!inputVal || isNaN(val) || val <= 0) {
      setError('Giá gốc phải lớn hơn 0')
      return
    }
    setState('saving')
    setError(null)
    try {
      await onSave(product.productShort, val, noteVal || undefined)
      setState('view')
      product.costPrice = val
    } catch (e: any) {
      setError(e.message)
      setState('edit')
    }
  }

  const handleCancel = () => {
    setInputVal(product.costPrice?.toString() ?? '')
    setNoteVal(product.note ?? '')
    setError(null)
    setState('view')
  }

  return (
    <div
      ref={rowRef}
      className={`cost-row${isHighlighted ? ' highlighted' : ''}`}
    >
      <div className="cost-row-name">
        {isHighlighted && (
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--shopee-orange)', marginRight: 6, textTransform: 'uppercase' }}>
            🆕 Mới
          </span>
        )}
        {product.productShort}
      </div>

      {state === 'view' ? (
        <>
          <div className="cost-row-value">
            {product.costPrice != null
              ? <span style={{ color: 'var(--success)' }}>{formatCurrency(product.costPrice)}</span>
              : <span style={{ color: 'var(--warning)', fontStyle: 'italic' }}>Chưa nhập</span>
            }
          </div>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setState('edit')} title="Sửa">
            <Pencil size={13} />
          </button>
        </>
      ) : (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1 }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 180 }}>
            <input
              className="input"
              autoFocus
              type="number"
              min="0"
              step="500"
              placeholder="35000"
              value={inputVal}
              onChange={e => { setInputVal(e.target.value); setError(null) }}
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel() }}
              style={{ paddingRight: 30 }}
            />
            <span style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              fontSize: 12, color: 'var(--text-muted)'
            }}>₫</span>
          </div>
          <input
            className="input"
            type="text"
            placeholder="Ghi chú (tuỳ chọn)"
            value={noteVal}
            onChange={e => setNoteVal(e.target.value)}
            style={{ flex: 1, maxWidth: 160 }}
          />
          {error && <span style={{ fontSize: 11, color: 'var(--danger)' }}>{error}</span>}
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={state === 'saving'}>
            {state === 'saving' ? <RefreshCw size={12} /> : <Check size={12} />}
            Lưu
          </button>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={handleCancel}>
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  )
}

export function SettingsPage() {
  const [filter, setFilter] = useState<'all' | 'missing' | 'done'>('all')
  const { addToast } = useToast()
  const queryClient = useQueryClient()

  // Get highlighted IDs from URL
  const highlightIds = new URLSearchParams(window.location.search).get('highlight')?.split(',') ?? []

  const { data: periodsData } = useQuery({
    queryKey: ['settings', 'periods'],
    queryFn: async () => {
      const r = await fetchWithAuth('/api/settings/periods')
      return r.json()
    }
  })

  const { data: costsResult, isPending: loadingProducts, refetch } = useQuery({
    queryKey: ['settings', 'costs-full'],
    queryFn: async () => {
      const periods: string[] = periodsData?.periods ?? []
      
      // Get costs
      const rc = await fetchWithAuth('/api/settings/costs')
      const dc = await rc.json()
      const costsMap: Record<string, number | null> = {}
      const notesMap: Record<string, string> = {}
      for (const c of dc.costs ?? []) {
        costsMap[c.productShort] = c.costPrice
        notesMap[c.productShort] = c.note ?? ''
      }

      // Aggregate unique products from recent periods
      const productSet = new Set<string>()
      for (const p of periods.slice(0, 6)) {
        const rr = await fetchWithAuth(`/api/products?period=${p}&limit=100`)
        if (rr.ok) {
          const dd = await rr.json()
          for (const prod of dd.products ?? []) productSet.add(prod.productShort)
        }
      }
      for (const k of Object.keys(costsMap)) productSet.add(k)

      const list = Array.from(productSet).sort()
      return list.map(p => ({
        productShort: p,
        costPrice: costsMap[p] ?? null,
        note: notesMap[p],
      }))
    },
    enabled: !!periodsData,
  })

  const saveMutation = useMutation({
    mutationFn: async ({ productShort, costPrice, note }: { productShort: string, costPrice: number, note?: string }) => {
      const response = await fetchWithAuth('/api/settings/costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productShort, costPrice, note }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Lỗi lưu giá gốc')
      return { productShort, costPrice, note }
    },
    onSuccess: (vars) => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      addToast(`Đã lưu giá gốc: ${vars.productShort}`, 'success')
    }
  })

  const costs = costsResult ?? []
  const loading = loadingProducts || !periodsData

  const handleSave = async (productShort: string, costPrice: number, note?: string) => {
    saveMutation.mutate({ productShort, costPrice, note })
  }

  const withCost = costs.filter((c: ProductCost) => c.costPrice != null)
  const withoutCost = costs.filter((c: ProductCost) => c.costPrice == null)

  const displayList = (() => {
    if (filter === 'missing') return withoutCost
    if (filter === 'done') return withCost
    return costs
  })()

  return (
    <div>
      {/* Summary bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <span className="badge badge-orange">{costs.length} sản phẩm</span>
        <span className="badge badge-success">
          <CheckCircle size={10} style={{ marginRight: 3 }} />
          {withCost.length} đã nhập
        </span>
        {withoutCost.length > 0 && (
          <span className="badge badge-warning">
            <AlertTriangle size={10} style={{ marginRight: 3 }} />
            {withoutCost.length} chưa nhập
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Lọc:</span>
          <select className="select" value={filter} onChange={e => setFilter(e.target.value as typeof filter)}>
            <option value="all">Tất cả</option>
            <option value="missing">Chưa nhập ({withoutCost.length})</option>
            <option value="done">Đã nhập ({withCost.length})</option>
          </select>
          <button className="btn btn-secondary btn-sm" onClick={() => refetch()}>
            <RefreshCw size={13} /> Làm mới
          </button>
        </div>
      </div>

      {/* Highlight alert */}
      {highlightIds.length > 0 && (
        <div className="alert alert-warning" style={{ marginBottom: 20 }}>
          <span style={{ fontSize: 18 }}>🆕</span>
          <div className="alert-body">
            <div className="alert-title">Phát hiện {highlightIds.length} sản phẩm mới</div>
            <div className="alert-desc">Nhập giá gốc để tính lợi nhuận chính xác</div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="card">
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="cost-row">
              <div className="skeleton" style={{ height: 14, flex: 1, borderRadius: 4 }} />
              <div className="skeleton" style={{ height: 32, width: 120, borderRadius: 6 }} />
            </div>
          ))}
        </div>
      ) : costs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📦</div>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>Chưa có sản phẩm nào</p>
          <p style={{ marginBottom: 16 }}>Upload file đơn hàng để tự động phát hiện sản phẩm</p>
          <a href="/upload" className="btn btn-primary">Upload ngay</a>
        </div>
      ) : (
        <>
          {/* Without cost section */}
          {(filter === 'all' || filter === 'missing') && withoutCost.length > 0 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
                paddingBottom: 12, borderBottom: '1px solid var(--border)'
              }}>
                <AlertTriangle size={15} style={{ color: 'var(--warning)' }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--warning)' }}>
                  CHƯA CÓ GIÁ GỐC ({withoutCost.length})
                </span>
              </div>
              {withoutCost.map(product => (
                <CostRow
                  key={product.productShort}
                  product={product}
                  isHighlighted={highlightIds.includes(product.productShort)}
                  onSave={handleSave}
                />
              ))}
            </div>
          )}

          {/* With cost section */}
          {(filter === 'all' || filter === 'done') && withCost.length > 0 && (
            <div className="card">
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
                paddingBottom: 12, borderBottom: '1px solid var(--border)'
              }}>
                <CheckCircle size={15} style={{ color: 'var(--success)' }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--success)' }}>
                  ĐÃ CÓ GIÁ GỐC ({withCost.length})
                </span>
              </div>
              {withCost.map(product => (
                <CostRow
                  key={product.productShort}
                  product={product}
                  isHighlighted={highlightIds.includes(product.productShort)}
                  onSave={handleSave}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
