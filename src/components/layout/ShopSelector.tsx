import React, { useState, useEffect, useRef } from 'react'
import { useShop } from '../../lib/context'
import { usePeriod } from '../../lib/context'
import { fetchWithAuth } from '../../lib/api'
import { ChevronDown, Store, Plus, Check, Pencil, Trash2, X } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'

export function ShopSelector() {
  const { shopId, setShopId, shops, setShops } = useShop()
  const { setPeriod, setPeriods } = usePeriod()
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    fetchWithAuth('/api/shops')
      .then(r => r.json())
      .then(data => setShops(data.shops ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setAdding(false)
        setEditingId(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const refreshPeriods = (sid: string | null) => {
    const url = sid ? `/api/settings/periods?shopId=${sid}` : '/api/settings/periods'
    fetchWithAuth(url)
      .then(r => r.json())
      .then(data => {
        const list: string[] = data.periods ?? []
        setPeriods(list)
        if (list.length > 0) setPeriod(list[0])
        else setPeriod('')
      })
      .catch(() => {})
  }

  const selectShop = (id: string | null) => {
    setShopId(id)
    setOpen(false)
    refreshPeriods(id)
    queryClient.invalidateQueries()
  }

  const addShop = async () => {
    if (!newName.trim() || loading) return
    setLoading(true)
    try {
      const r = await fetchWithAuth('/api/shops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      })
      const data = await r.json()
      if (data.shop) {
        setShops([...shops, data.shop])
        setNewName('')
        setAdding(false)
      }
    } catch {}
    setLoading(false)
  }

  const renameShop = async (id: string) => {
    if (!editName.trim() || loading) return
    setLoading(true)
    try {
      await fetchWithAuth(`/api/shops/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim() }),
      })
      setShops(shops.map(s => s.id === id ? { ...s, name: editName.trim() } : s))
      setEditingId(null)
    } catch {}
    setLoading(false)
  }

  const deleteShop = async (id: string) => {
    if (!confirm('Xoá shop này? Dữ liệu không bị xoá, chỉ bỏ liên kết shop.')) return
    try {
      await fetchWithAuth(`/api/shops/${id}`, { method: 'DELETE' })
      setShops(shops.filter(s => s.id !== id))
      if (shopId === id) selectShop(null)
    } catch {}
  }

  const currentShop = shops.find(s => s.id === shopId)

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div
        className="period-selector"
        onClick={() => setOpen(o => !o)}
        style={{ minWidth: 140 }}
      >
        <Store size={13} style={{ color: 'var(--shopee-orange)' }} />
        <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {currentShop ? currentShop.name : 'Tất cả shop'}
        </span>
        <ChevronDown size={13} style={{ marginLeft: 4, color: 'var(--text-muted)' }} />
      </div>

      {open && (
        <div className="period-dropdown" style={{ minWidth: 220, right: 0, left: 'auto' }}>
          {/* All shops option */}
          <div
            className={`period-option${shopId === null ? ' active' : ''}`}
            onClick={() => selectShop(null)}
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            {shopId === null
              ? <Check size={14} color="var(--shopee-orange)" />
              : <span style={{ width: 14 }} />}
            <span style={{ flex: 1, fontWeight: shopId === null ? 600 : 400 }}>Tất cả shop</span>
          </div>

          {/* Shop list */}
          {shops.map(shop => (
            <div
              key={shop.id}
              className={`period-option${shopId === shop.id ? ' active' : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              {editingId === shop.id ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}
                  onClick={e => e.stopPropagation()}>
                  <input
                    className="input"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') renameShop(shop.id); if (e.key === 'Escape') setEditingId(null) }}
                    autoFocus
                    style={{ flex: 1, padding: '3px 8px', fontSize: 12 }}
                  />
                  <button className="btn btn-primary btn-sm btn-icon" onClick={() => renameShop(shop.id)}>
                    <Check size={12} />
                  </button>
                  <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setEditingId(null)}>
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}
                    onClick={() => selectShop(shop.id)}>
                    {shopId === shop.id
                      ? <Check size={14} color="var(--shopee-orange)" />
                      : <span style={{ width: 14 }} />}
                    <span style={{ fontWeight: shopId === shop.id ? 600 : 400 }}>{shop.name}</span>
                  </div>
                  <button
                    className="btn btn-ghost btn-sm btn-icon"
                    title="Đổi tên"
                    onClick={e => { e.stopPropagation(); setEditingId(shop.id); setEditName(shop.name) }}
                    style={{ opacity: 0.6 }}
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    className="btn btn-ghost btn-sm btn-icon"
                    title="Xoá"
                    onClick={e => { e.stopPropagation(); deleteShop(shop.id) }}
                    style={{ opacity: 0.6, color: 'var(--danger)' }}
                  >
                    <Trash2 size={12} />
                  </button>
                </>
              )}
            </div>
          ))}

          {/* Add shop */}
          <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)' }}>
            {adding ? (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  className="input"
                  placeholder="Tên shop..."
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addShop(); if (e.key === 'Escape') setAdding(false) }}
                  autoFocus
                  style={{ flex: 1, padding: '4px 8px', fontSize: 12 }}
                />
                <button className="btn btn-primary btn-sm" onClick={addShop} disabled={loading}>
                  Thêm
                </button>
                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => { setAdding(false); setNewName('') }}>
                  <X size={12} />
                </button>
              </div>
            ) : (
              <button
                className="btn btn-secondary"
                style={{ width: '100%', padding: '5px 12px', fontSize: 12 }}
                onClick={() => setAdding(true)}
              >
                <Plus size={12} /> Thêm shop mới
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
