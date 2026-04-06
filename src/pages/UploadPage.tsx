import React, { useState, useRef, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../lib/context'
import { fetchWithAuth } from '../lib/api'
import { formatDate, formatPeriod } from '../lib/format'
import { Upload, FileText, CheckCircle, XCircle, AlertTriangle, Clock, RefreshCw } from 'lucide-react'

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
      
      addToast(
        `✅ Đã import ${typedData.rowsImported} ${type === 'orders' ? 'đơn hàng' : 'giao dịch'} — ${formatPeriod(typedData.period)}`,
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

      {/* Period selector */}
      {!result && (
        <div style={{ marginBottom: 14 }}>
          <label className="label">Kỳ báo cáo (YYYY-MM)</label>
          <input
            className="input"
            type="month"
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

export function UploadPage() {
  const { data: historyData, isPending: historyLoading, refetch: fetchHistory } = useQuery<UploadBatch[]>({
    queryKey: ['settings', 'periods-history'],
    queryFn: async () => {
      const r = await fetchWithAuth('/api/settings/periods')
      const data = await r.json()
      const periods: string[] = data.periods ?? []
      return periods.flatMap((p: string) => [
        { id: `ord-${p}`, type: 'orders' as const, period: p, rowsImported: 0, createdAt: new Date().toISOString() },
        { id: `bal-${p}`, type: 'balance' as const, period: p, rowsImported: 0, createdAt: new Date().toISOString() },
      ])
    }
  })

  const history = historyData ?? []

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
