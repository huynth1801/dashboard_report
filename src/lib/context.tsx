import React, { createContext, useContext, useState, useCallback } from 'react'

// ==================== TOAST ====================
interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

interface ToastCtx {
  toasts: Toast[]
  addToast: (msg: string, type?: Toast['type']) => void
}

const ToastContext = createContext<ToastCtx>({ toasts: [], addToast: () => {} })

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast }}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            <span>{t.type === 'success' ? '✅' : t.type === 'error' ? '❌' : 'ℹ️'}</span>
            <span className="toast-msg">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)

// ==================== PERIOD ====================
interface PeriodCtx {
  period: string
  setPeriod: (p: string) => void
  periods: string[]
  setPeriods: (p: string[]) => void
}

const PeriodContext = createContext<PeriodCtx>({
  period: '',
  setPeriod: () => {},
  periods: [],
  setPeriods: () => {},
})

export function PeriodProvider({ children }: { children: React.ReactNode }) {
  const [period, setPeriod] = useState<string>('')
  const [periods, setPeriods] = useState<string[]>([])

  return (
    <PeriodContext.Provider value={{ period, setPeriod, periods, setPeriods }}>
      {children}
    </PeriodContext.Provider>
  )
}

export const usePeriod = () => useContext(PeriodContext)
