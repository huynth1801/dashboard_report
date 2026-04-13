// Format số tiền VND
export const formatCurrency = (n: number): string => {
  if (n === null || n === undefined || isNaN(n)) return '—'
  if (Math.abs(n) >= 1_000_000) {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 1,
      minimumFractionDigits: 0,
    }).format(n)
  }
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(n)
}

// Format số ngắn gọn: 1,382 cái
export const formatNumber = (n: number): string => {
  if (n === null || n === undefined || isNaN(n)) return '—'
  return new Intl.NumberFormat('vi-VN').format(n)
}

// Format % change
export const formatPercent = (n: number): string => {
  if (n === null || n === undefined || isNaN(n)) return '—'
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
}

// Tính % thay đổi
export const calcChange = (current: number, prev: number): number | null => {
  if (!prev || prev === 0) return null
  return ((current - prev) / Math.abs(prev)) * 100
}

// Format ngày
export const formatDate = (dateStr: string): string => {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return dateStr
  }
}

// Format period YYYY-MM or YYYY-MM-DD → "Tháng M/YYYY" or "DD/MM/YY"
export const formatPeriod = (period: string): string => {
  if (!period) return ''
  const periods = period.split(',').map(p => p.trim()).filter(Boolean)
  
  const formatSingle = (p: string) => {
    const parts = p.split('-')
    if (parts.length === 3) {
      // YYYY-MM-DD
      const [y, m, d] = parts
      return `${d}/${m}/${y.slice(2)}`
    } else if (parts.length === 2) {
      // YYYY-MM
      const [y, m] = parts
      return `T${parseInt(m)}/${y}`
    }
    return p
  }

  if (periods.length === 1) {
    return formatSingle(periods[0])
  }

  return periods.map(formatSingle).join(', ')
}

// Rút gọn số tiền: 50,892,890 → 50.9M
export const formatShort = (n: number): string => {
  if (n === null || n === undefined || isNaN(n)) return '—'
  if (Math.abs(n) >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return n.toString()
}

// Format tiền tệ ngắn gọn có ký hiệu
export const formatCurrencyShort = (n: number): string => {
  return `${formatShort(n)} ₫`
}
