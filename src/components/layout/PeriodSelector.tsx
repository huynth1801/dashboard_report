import React, { useState, useEffect, useRef } from 'react'
import { usePeriod } from '../../lib/context'
import { formatPeriod } from '../../lib/format'
import { ChevronDown, Calendar, CheckSquare, Square } from 'lucide-react'

export function PeriodSelector() {
  const { period, setPeriod, periods, setPeriods } = usePeriod()
  const [open, setOpen] = useState(false)
  const [localSelected, setLocalSelected] = useState<string[]>([])
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/settings/periods')
      .then(r => r.json())
      .then(data => {
        const list: string[] = data.periods ?? []
        setPeriods(list)
        if (!period && list.length > 0) setPeriod(list[0])
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (period) {
      setLocalSelected(period.split(',').map(p => p.trim()).filter(Boolean))
    }
  }, [period, open])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const togglePeriod = (p: string) => {
    setLocalSelected(prev => 
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    )
  }

  const applySelection = () => {
    if (localSelected.length > 0) {
      setPeriod(localSelected.join(','))
      setOpen(false)
    }
  }

  if (periods.length === 0) {
    return (
      <div className="period-selector" style={{ opacity: 0.5 }}>
        <Calendar size={13} />
        <span>Chưa có dữ liệu</span>
      </div>
    )
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div className="period-selector" onClick={() => setOpen(o => !o)}>
        <Calendar size={13} style={{ color: 'var(--shopee-orange)' }} />
        <span>{period ? formatPeriod(period) : 'Chọn kỳ'}</span>
        <ChevronDown size={13} style={{ marginLeft: 4, color: 'var(--text-muted)' }} />
      </div>
      {open && (
        <div className="period-dropdown" style={{ minWidth: 200 }}>
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {periods.map(p => {
              const isSelected = localSelected.includes(p)
              return (
                <div
                  key={p}
                  className={`period-option${isSelected ? ' active' : ''}`}
                  onClick={() => togglePeriod(p)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  {isSelected ? <CheckSquare size={14} color="var(--shopee-orange)" /> : <Square size={14} color="var(--text-muted)" />}
                  <span style={{ flex: 1 }}>{formatPeriod(p)}</span>
                  <span style={{ opacity: 0.5, fontSize: 11 }}>{p}</span>
                </div>
              )
            })}
          </div>
          <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)' }}>
            <button 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '6px 12px', fontSize: 13 }}
              onClick={applySelection}
              disabled={localSelected.length === 0}
            >
              Áp dụng
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
