import React, { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast, useShop, Shop } from '../lib/context'
import { fetchWithAuth } from '../lib/api'
import { formatCurrency } from '../lib/format'
import { Pencil, Check, X, AlertTriangle, CheckCircle, RefreshCw, Trash2, Unlink } from 'lucide-react'

interface ProductCost {
  productShort: string
  costPrice: number | null
  note?: string
}

type RowState = 'view' | 'edit' | 'saving'

function CostRow({
  product,
  isHighlighted,
  onSave,
}: {
  product: ProductCost
  isHighlighted: boolean
  onSave: (productShort: string, costPrice: number, note?: string) => void
}) {
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
    if (!inputVal || isNaN(val) || val <= 0) { setError('Giá gốc phải lớn hơn 0'); return }
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
    <div ref={rowRef} className={`cost-row${isHighlighted ? ' highlighted' : ''}`}>
      <div className="cost-row-name">
        {isHighlighted && (
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--shopee-orange)', marginRight: 6 }}>🆕 Mới</span>
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
            <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--text-muted)' }}>₫</span>
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
            {state === 'saving' ? <RefreshCw size={12} /> : <Check size={12} />} Lưu
          </button>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={handleCancel}><X size={12} /></button>
        </div>
      )}
    </div>
  )
}

// ======================== Per-shop cost panel ========================
function ShopCostPanel({ shop }: { shop: Shop | null }) {
  // shop = null → "Chưa gán shop" (shopId = '')
  const shopId = shop?.id ?? ''
  const shopName = shop?.name ?? 'Chưa gán shop'
  const { addToast } = useToast()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<'all' | 'missing' | 'done'>('all')
  const [copying, setCopying] = useState(false)
  const highlightIds = new URLSearchParams(window.location.search).get('highlight')?.split(',') ?? []

  const { data: periodsData } = useQuery({
    queryKey: ['settings', 'periods', shopId],
    queryFn: async () => {
      const url = shopId ? `/api/settings/periods?shopId=${shopId}` : '/api/settings/periods'
      const r = await fetchWithAuth(url)
      return r.json()
    }
  })

  const { data: costs = [], isPending: loading, refetch } = useQuery<ProductCost[]>({
    queryKey: ['settings', 'costs-panel', shopId],
    queryFn: async () => {
      const periods: string[] = periodsData?.periods ?? []

      // Lấy giá vốn đã lưu cho shop này
      const rc = await fetchWithAuth(`/api/settings/costs?shopId=${encodeURIComponent(shopId)}`)
      const dc = await rc.json()
      const costsMap: Record<string, number> = {}
      const notesMap: Record<string, string> = {}
      for (const c of dc.costs ?? []) {
        costsMap[c.productShort] = c.costPrice
        notesMap[c.productShort] = c.note ?? ''
      }

      // Lấy danh sách sản phẩm từ đơn hàng của shop này
      const productSet = new Set<string>(Object.keys(costsMap))
      const shopParam = shopId ? `&shopId=${encodeURIComponent(shopId)}` : ''
      for (const p of (periods ?? []).slice(0, 6)) {
        const rr = await fetchWithAuth(`/api/products?period=${p}&limit=100${shopParam}`)
        if (rr.ok) {
          const dd = await rr.json()
          for (const prod of dd.products ?? []) productSet.add(prod.productShort)
        }
      }

      return Array.from(productSet).sort().map(p => ({
        productShort: p,
        costPrice: costsMap[p] ?? null,
        note: notesMap[p],
      }))
    },
    enabled: !!periodsData,
  })

  const saveMutation = useMutation({
    mutationFn: async ({ productShort, costPrice, note }: { productShort: string; costPrice: number; note?: string }) => {
      const r = await fetchWithAuth('/api/settings/costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productShort, costPrice, note, shopId }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error ?? 'Lỗi lưu')
      return { productShort, costPrice, note }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'costs-panel', shopId] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })

  // Sao chép giá vốn sang shop này từ shop khác
  const handleCopyFrom = async (sourceShopId: string, sourceShopName: string) => {
    if (!confirm(`Sao chép giá vốn từ "${sourceShopName}" sang "${shopName}"?\nGiá vốn đã có sẽ bị ghi đè.`)) return
    setCopying(true)
    try {
      const rg = await fetchWithAuth(`/api/settings/costs?shopId=${encodeURIComponent(sourceShopId)}`)
      const dg = await rg.json()
      const sourceCosts: Array<{ productShort: string; costPrice: number; note: string }> = dg.costs ?? []
      if (sourceCosts.length === 0) { addToast(`"${sourceShopName}" chưa có giá vốn nào`, 'info'); setCopying(false); return }
      for (const c of sourceCosts) {
        await fetchWithAuth('/api/settings/costs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productShort: c.productShort, costPrice: c.costPrice, note: c.note, shopId }),
        })
      }
      queryClient.invalidateQueries({ queryKey: ['settings', 'costs-panel', shopId] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      addToast(`✅ Đã sao chép ${sourceCosts.length} giá vốn → "${shopName}"`, 'success')
    } catch { addToast('Lỗi sao chép giá vốn', 'error') }
    setCopying(false)
  }

  const withCost = costs.filter(c => c.costPrice != null)
  const withoutCost = costs.filter(c => c.costPrice == null)
  const displayList = filter === 'missing' ? withoutCost : filter === 'done' ? withCost : costs

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <span className="badge badge-orange">{costs.length} sản phẩm</span>
        <span className="badge badge-success">
          <CheckCircle size={10} style={{ marginRight: 3 }} />{withCost.length} đã nhập
        </span>
        {withoutCost.length > 0 && (
          <span className="badge badge-warning">
            <AlertTriangle size={10} style={{ marginRight: 3 }} />{withoutCost.length} chưa nhập
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
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
        <div className="alert alert-warning" style={{ marginBottom: 16 }}>
          <span style={{ fontSize: 18 }}>🆕</span>
          <div className="alert-body">
            <div className="alert-title">Phát hiện {highlightIds.length} sản phẩm mới</div>
            <div className="alert-desc">Nhập giá gốc để tính lợi nhuận chính xác</div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="card">
          {Array(5).fill(0).map((_, i) => (
            <div key={i} className="cost-row">
              <div className="skeleton" style={{ height: 14, flex: 1, borderRadius: 4 }} />
              <div className="skeleton" style={{ height: 32, width: 120, borderRadius: 6 }} />
            </div>
          ))}
        </div>
      ) : costs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📦</div>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>Chưa có sản phẩm nào cho {shopName}</p>
          <p style={{ marginBottom: 16, fontSize: 13, color: 'var(--text-muted)' }}>
            Upload file đơn hàng và gán đúng shop để hiển thị sản phẩm tại đây
          </p>
          <a href="/upload" className="btn btn-primary">Upload ngay</a>
        </div>
      ) : (
        <>
          {(filter === 'all' || filter === 'missing') && withoutCost.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                <AlertTriangle size={15} style={{ color: 'var(--warning)' }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--warning)' }}>CHƯA CÓ GIÁ GỐC ({withoutCost.length})</span>
              </div>
              {withoutCost.map(p => (
                <CostRow key={p.productShort} product={p} isHighlighted={highlightIds.includes(p.productShort)}
                  onSave={(ps, cp, n) => { saveMutation.mutate({ productShort: ps, costPrice: cp, note: n }) }} />
              ))}
            </div>
          )}
          {(filter === 'all' || filter === 'done') && withCost.length > 0 && (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                <CheckCircle size={15} style={{ color: 'var(--success)' }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--success)' }}>ĐÃ CÓ GIÁ GỐC ({withCost.length})</span>
              </div>
              {withCost.map(p => (
                <CostRow key={p.productShort} product={p} isHighlighted={highlightIds.includes(p.productShort)}
                  onSave={(ps, cp, n) => { saveMutation.mutate({ productShort: ps, costPrice: cp, note: n }) }} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ======================== Danger Zone ========================
function DangerZone() {
  const { shops, setShopId } = useShop()
  const { addToast } = useToast()
  const queryClient = useQueryClient()
  const [resetting, setResetting] = useState(false)
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null)

  const handleResetAllCosts = async () => {
    if (!confirm('⚠️ Xoá TẤT CẢ giá vốn của mọi shop?\nThao tác này không thể hoàn tác.')) return
    setResetting(true)
    try {
      const r = await fetchWithAuth('/api/settings/costs/all', { method: 'DELETE' })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      addToast(`✅ Đã xoá ${d.deleted ?? 0} giá vốn`, 'success')
    } catch (e: any) {
      addToast(e.message ?? 'Lỗi', 'error')
    }
    setResetting(false)
  }

  const handleUnlinkShop = async (shop: Shop) => {
    if (!confirm(`Hủy gán tất cả đơn hàng & giao dịch của "${shop.name}"?\nDữ liệu không bị xoá, chỉ bỏ liên kết shop.`)) return
    setUnlinkingId(shop.id)
    try {
      const r = await fetchWithAuth(`/api/shops/${shop.id}/unlink`, { method: 'PATCH' })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      queryClient.invalidateQueries()
      setShopId(null)
      addToast(`✅ Đã hủy gán: ${d.ordersUnlinked} đơn, ${d.transactionsUnlinked} giao dịch`, 'success')
    } catch (e: any) {
      addToast(e.message ?? 'Lỗi', 'error')
    }
    setUnlinkingId(null)
  }

  return (
    <div className="card" style={{ marginTop: 32, border: '1px solid var(--danger)', opacity: 0.95 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
        <AlertTriangle size={15} style={{ color: 'var(--danger)' }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--danger)' }}>VÙNG NGUY HIỂM</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Reset all costs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Reset toàn bộ giá vốn</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Xoá giá vốn của tất cả sản phẩm ở mọi shop để nhập lại từ đầu</div>
          </div>
          <button className="btn btn-sm" onClick={handleResetAllCosts} disabled={resetting}
            style={{ background: 'var(--danger)', color: '#fff', border: 'none', flexShrink: 0 }}>
            <Trash2 size={13} /> {resetting ? 'Đang xoá...' : 'Xoá tất cả giá vốn'}
          </button>
        </div>

        {/* Unlink per shop */}
        {shops.map(shop => (
          <div key={shop.id} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Hủy gán shop: {shop.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Bỏ liên kết tất cả đơn hàng & giao dịch khỏi shop này (dữ liệu không bị xoá)</div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => handleUnlinkShop(shop)}
              disabled={unlinkingId === shop.id} style={{ flexShrink: 0 }}>
              <Unlink size={13} /> {unlinkingId === shop.id ? 'Đang hủy...' : `Hủy gán ${shop.name}`}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ======================== Settings Page ========================
export function SettingsPage() {
  const { shops } = useShop()
  const [activeTab, setActiveTab] = useState<string>(() => shops[0]?.id ?? '__none__')

  useEffect(() => {
    if (activeTab === '__none__' && shops.length > 0) setActiveTab(shops[0].id)
  }, [shops])

  // No shops created yet — fallback to old single-panel mode (shopId='')
  if (shops.length === 0) {
    return (
      <div>
        <div className="alert alert-info" style={{ marginBottom: 20 }}>
          <span style={{ fontSize: 18 }}>💡</span>
          <div className="alert-body">
            <div className="alert-title">Chưa có shop nào</div>
            <div className="alert-desc">
              Tạo shop từ dropdown <strong>"Tất cả shop"</strong> ở header để quản lý giá vốn riêng từng shop.
            </div>
          </div>
        </div>
        <ShopCostPanel shop={null} />
        <DangerZone />
      </div>
    )
  }

  const activeShop = shops.find(s => s.id === activeTab) ?? shops[0]

  return (
    <div>
      {/* Shop Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '2px solid var(--border)',
        marginBottom: 24,
        gap: 0,
        overflowX: 'auto',
      }}>
        {shops.map(shop => {
          const isActive = shop.id === activeTab
          return (
            <button
              key={shop.id}
              onClick={() => setActiveTab(shop.id)}
              style={{
                padding: '10px 20px',
                background: 'none',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--shopee-orange)' : '2px solid transparent',
                marginBottom: -2,
                cursor: 'pointer',
                fontWeight: isActive ? 700 : 400,
                fontSize: 14,
                color: isActive ? 'var(--shopee-orange)' : 'var(--text-secondary)',
                whiteSpace: 'nowrap',
                transition: 'color 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              🏪 {shop.name}
            </button>
          )
        })}
      </div>

      {/* Active shop panel */}
      <ShopCostPanel key={activeShop.id} shop={activeShop} />

      {/* Danger Zone */}
      <DangerZone />
    </div>
  )
}
