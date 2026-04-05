import React, { useState, useEffect, useRef } from 'react'
import { usePeriod } from '../../lib/context'
import { formatPeriod } from '../../lib/format'
import { ChevronDown, Calendar } from 'lucide-react'

export function PeriodSelector() {
  const { period, setPeriod, periods, setPeriods } = usePeriod()
  const [open, setOpen] = useState(false)
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
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

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
        <div className="period-dropdown">
          {periods.map(p => (
            <div
              key={p}
              className={`period-option${p === period ? ' active' : ''}`}
              onClick={() => { setPeriod(p); setOpen(false) }}
            >
              {formatPeriod(p)} <span style={{ float: 'right', opacity: 0.5, fontSize: 11 }}>{p}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
