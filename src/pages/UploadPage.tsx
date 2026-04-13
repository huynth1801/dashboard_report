import React, { useState, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast, useShop } from '../lib/context'
import { fetchWithAuth } from '../lib/api'
import { formatPeriod } from '../lib/format'
import { Upload, FileText, CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react'

interface UploadResult {
  batchId: string
  period: string
  rowsImported: number
  errors?: Array<{ row: number; field: string; message: string }>
}

interface UploadBatch {
  id: string
  type: 'orders' | 'balance'
  period: string
  rowsImported: number
  createdAt: string
}

interface DropzoneProps {
  type: 'orders' | 'balance'
  label: string
  description: string
  icon: string
  onSuccess: (result: UploadResult) => void
}

function FileDropzone({ type, label, description, icon, onSuccess }: DropzoneProps) {
  const [dragOver, setDragOver] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [mode, setMode] = useState<'month' | 'day'>('month')
  const [period, setPeriod] = useState<string>(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { addToast } = useToast()
  const { shopId, shops } = useShop()
  const queryClient = useQueryClient()

  const handleUpload = async () => {
    if (!file || !period) return
    setUploading(true)
    setError(null)
    setProgress(0)

    const interval = setInterval(() => {
      setProgress(p => Math.min(p + 15, 85))
    }, 200)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('period', period)
      if (shopId) formData.append('shopId', shopId)

      const response = await fetchWithAuth(`/api/upload/${type}`, {
        method: 'POST',
        body: formData
      })

      clearInterval(interval)
      setProgress(100)

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Upload thất bại')
      
      const typedData = data as UploadResult
      setResult(typedData)
      
      const shopName = shops.find(s => s.id === shopId)?.name
      addToast(
        `✅ Đã import ${typedData.rowsImported} ${type === 'orders' ? 'đơn hàng' : 'giao dịch'} — ${formatPeriod(typedData.period)}${shopName ? ` (${shopName})` : ''}`,
        'success'
      )

      // Invalidate ALL data queries
      queryClient.invalidateQueries()
    } catch (err: any) {
      clearInterval(interval)
      setError(err.message ?? 'Upload thất bại')
      setProgress(0)
      addToast(err.message ?? 'Upload thất bại', 'error')
    } finally {
      setUploading(false)
    }
  }

  // Update period format when mode changes
  const switchMode = (newMode: 'month' | 'day') => {
    if (newMode === mode) return
    setMode(newMode)
    const now = new Date()
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const day = `${month}-${String(now.getDate()).padStart(2, '0')}`
    setPeriod(newMode === 'month' ? month : day)
  }

  const validateFile = (f: File) => {
    if (!f.name.match(/\.(xlsx|xls)$/i)) {
      addToast('Chỉ chấp nhận file .xlsx hoặc .xls', 'error')
      return false
    }
    if (f.size > 10 * 1024 * 1024) {
      addToast('File tối đa 10MB', 'error')
      return false
    }
    return true
  }

  const handleFile = (f: File) => {
    if (!validateFile(f)) return
    setFile(f)
    setResult(null)
    setError(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  const reset = () => {
    setFile(null)
    setResult(null)
    setError(null)
    setProgress(0)
  }

  return (
    <div className="card" style={{ height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <span style={{ fontSize: 24 }}>{icon}</span>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{label}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{description}</div>
        </div>
      </div>

      {/* Dropzone */}
      {!file && !result && (
        <div
          className={`upload-zone${dragOver ? ' drag-over' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <div className="upload-icon">
            <Upload size={20} />
          </div>
          <div className="upload-text">Kéo thả file vào đây</div>
          <div className="upload-hint">hoặc click để chọn file .xlsx</div>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
        </div>
      )}

      {/* File selected */}
      {file && !result && (
        <div style={{
          padding: '14px 16px',
          background: 'var(--bg-base)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 14,
        }}>
          <FileText size={18} style={{ color: 'var(--shopee-orange)', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {file.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {(file.size / 1024).toFixed(0)} KB
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={reset}>
            <XCircle size={14} />
          </button>
        </div>
      )}

      {/* Success */}
      {result && (
        <div className="alert alert-success" style={{ marginBottom: 14 }}>
          <CheckCircle size={16} />
          <div className="alert-body">
            <div className="alert-title">Upload thành công</div>
            <div className="alert-desc">
              {result.rowsImported} {type === 'orders' ? 'đơn hàng' : 'giao dịch'} — kỳ {formatPeriod(result.period)}
              {shops.find(s => s.id === shopId) && (
                <> · Shop: <strong>{shops.find(s => s.id === shopId)?.name}</strong></>
              )}
              {result.errors && result.errors.length > 0 && (
                <> · <span style={{ color: 'var(--warning)' }}>{result.errors.length} cảnh báo</span></>
              )}
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={reset}>Upload lại</button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="alert alert-danger" style={{ marginBottom: 14 }}>
          <AlertTriangle size={16} />
          <div className="alert-body">
            <div className="alert-title">Lỗi upload</div>
            <div className="alert-desc">{error}</div>
          </div>
        </div>
      )}

      {/* Shop indicator */}
      {!result && (
        <div style={{ marginBottom: 10, padding: '8px 12px', background: 'var(--bg-base)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-secondary)' }}>
          <span style={{ color: 'var(--text-muted)' }}>Shop: </span>
          {shops.find(s => s.id === shopId)
            ? <strong style={{ color: 'var(--shopee-orange)' }}>{shops.find(s => s.id === shopId)?.name}</strong>
            : <span style={{ color: 'var(--text-muted)' }}>Chưa chọn shop (dữ liệu chung)</span>
          }
        </div>
      )}

      {/* Period selector */}
      {!result && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 4, marginBottom: 10, background: 'var(--bg-base)', padding: 3, borderRadius: 8, width: 'fit-content' }}>
            <button 
              className={`btn btn-sm ${mode === 'month' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: 11, padding: '4px 10px' }}
              onClick={() => switchMode('month')}
            >
              Cả tháng
            </button>
            <button 
              className={`btn btn-sm ${mode === 'day' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: 11, padding: '4px 10px' }}
              onClick={() => switchMode('day')}
            >
              Một ngày cụ thể
            </button>
          </div>

          <label className="label">
            {mode === 'month' ? 'Chọn tháng báo cáo' : 'Chọn ngày báo cáo'}
          </label>
          <input
            className="input"
            type={mode === 'month' ? 'month' : 'date'}
            value={period}
            onChange={e => setPeriod(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>
      )}

      {/* Progress bar */}
      {uploading && (
        <div style={{ marginBottom: 14 }}>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, textAlign: 'center' }}>
            Đang xử lý... {progress}%
          </div>
        </div>
      )}

      {/* Upload button */}
      {!result && (
        <button
          className="btn btn-primary"
          style={{ width: '100%' }}
          disabled={!file || uploading}
          onClick={handleUpload}
        >
          {uploading ? (
            <><span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span> Đang upload...</>
          ) : (
            <><Upload size={14} /> Upload {label}</>
          )}
        </button>
      )}
    </div>
  )
}

// ======================== Assign Shop Panel ========================
function AssignShopPanel({ periods }: { periods: string[] }) {
  const { shops } = useShop()
  const { addToast } = useToast()
  const queryClient = useQueryClient()
  const [selectedPeriod, setSelectedPeriod] = useState('')
  const [selectedShopId, setSelectedShopId] = useState('')
  const [loading, setLoading] = useState(false)

  if (shops.length === 0) return null

  const handleAssign = async () => {
    if (!selectedPeriod || !selectedShopId) return
    setLoading(true)
    try {
      const r = await fetchWithAuth('/api/upload/assign-shop', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period: selectedPeriod, shopId: selectedShopId }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Thất bại')
      const shopName = shops.find(s => s.id === selectedShopId)?.name ?? ''
      addToast(`✅ Đã gán kỳ ${formatPeriod(selectedPeriod)} → ${shopName} (${data.ordersUpdated} đơn, ${data.transactionsUpdated} giao dịch)`, 'success')
      queryClient.invalidateQueries()
    } catch (err: any) {
      addToast(err.message ?? 'Lỗi gán shop', 'error')
    }
    setLoading(false)
  }

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 20 }}>🔗</span>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Gán dữ liệu cũ vào shop</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Dữ liệu upload trước khi có tính năng shop — gán lại vào đúng shop</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 160px' }}>
          <label className="label">Kỳ dữ liệu</label>
          <select
            className="input"
            value={selectedPeriod}
            onChange={e => setSelectedPeriod(e.target.value)}
            style={{ width: '100%' }}
          >
            <option value="">-- Chọn kỳ --</option>
            {periods.map(p => (
              <option key={p} value={p}>{formatPeriod(p)} ({p})</option>
            ))}
          </select>
        </div>

        <div style={{ flex: '1 1 160px' }}>
          <label className="label">Gán vào shop</label>
          <select
            className="input"
            value={selectedShopId}
            onChange={e => setSelectedShopId(e.target.value)}
            style={{ width: '100%' }}
          >
            <option value="">-- Chọn shop --</option>
            {shops.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <button
          className="btn btn-primary"
          disabled={!selectedPeriod || !selectedShopId || loading}
          onClick={handleAssign}
          style={{ flexShrink: 0, height: 38 }}
        >
          {loading ? '⏳ Đang gán...' : '🔗 Gán shop'}
        </button>
      </div>

      <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
        ⚠️ Thao tác này sẽ gán <strong>toàn bộ</strong> dữ liệu của kỳ đó vào shop được chọn (bao gồm cả dữ liệu đã gán shop khác).
      </div>
    </div>
  )
}

export function UploadPage() {
  const { data: historyData, isPending: historyLoading, refetch: fetchHistory } = useQuery<{ periods: string[] }>({
    queryKey: ['settings', 'periods-history'],
    queryFn: async () => {
      const r = await fetchWithAuth('/api/settings/periods')
      return r.json()
    }
  })

  const periods = historyData?.periods ?? []
  const history = periods.flatMap((p: string) => [
    { id: `ord-${p}`, type: 'orders' as const, period: p, rowsImported: 0, createdAt: new Date().toISOString() },
    { id: `bal-${p}`, type: 'balance' as const, period: p, rowsImported: 0, createdAt: new Date().toISOString() },
  ])

  return (
    <div>
      {/* Upload sections */}
      <div className="grid-2" style={{ marginBottom: 28 }}>
        <FileDropzone
          type="orders"
          label="Báo cáo Đơn hàng"
          description="File xuất từ Shopee Seller → Đơn hàng → Tất cả đơn"
          icon="📦"
          onSuccess={() => fetchHistory()}
        />
        <FileDropzone
          type="balance"
          label="Báo cáo Số dư"
          description="File xuất từ Shopee Seller → Tài chính → Số dư (header ở dòng 18)"
          icon="💰"
          onSuccess={() => fetchHistory()}
        />
      </div>

      {/* Assign old data to shop */}
      <AssignShopPanel periods={periods} />

      {/* Tips */}
      <div className="alert alert-info" style={{ marginBottom: 24 }}>
        <span style={{ fontSize: 18 }}>💡</span>
        <div className="alert-body">
          <div className="alert-title">Lưu ý khi upload</div>
          <div className="alert-desc">
            File báo cáo số dư Shopee có header ở <strong>dòng 18</strong> (không phải dòng 1).
            Đảm bảo xuất đúng file từ Shopee Seller Center, không chỉnh sửa trước khi upload.
          </div>
        </div>
      </div>

      {/* Upload history */}
      <div className="table-container">
        <div className="table-header-bar">
          <div className="table-title">
            Lịch sử dữ liệu
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8 }}>
              Các kỳ đã có dữ liệu
            </span>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Loại file</th>
              <th>Kỳ</th>
              <th className="right">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {historyLoading ? (
              Array(4).fill(0).map((_, i) => (
                <tr key={i}>
                  {Array(3).fill(0).map((_, j) => (
                    <td key={j}><div className="skeleton" style={{ height: 14, borderRadius: 4 }} /></td>
                  ))}
                </tr>
              ))
            ) : history.length === 0 ? (
              <tr>
                <td colSpan={3}>
                  <div className="empty-state" style={{ padding: '32px 0' }}>
                    <div className="empty-icon">📂</div>
                    <p>Chưa có dữ liệu nào được upload</p>
                  </div>
                </td>
              </tr>
            ) : (
              history.map(batch => (
                <tr key={batch.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>{batch.type === 'orders' ? '📦' : '💰'}</span>
                      <span style={{ fontWeight: 500 }}>
                        {batch.type === 'orders' ? 'Đơn hàng' : 'Số dư'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-orange">{formatPeriod(batch.period)}</span>
                    <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-muted)' }}>{batch.period}</span>
                  </td>
                  <td className="right">
                    <span className="badge badge-success">
                      <CheckCircle size={10} style={{ marginRight: 3 }} /> Có dữ liệu
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
