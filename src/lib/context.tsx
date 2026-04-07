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

const ToastContext = createContext<ToastCtx>({ toasts: [], addToast: () => { } })

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
  setPeriod: () => { },
  periods: [],
  setPeriods: () => { },
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

// ==================== SHOP ====================
export interface Shop {
  id: string
  name: string
  createdAt: string
}

interface ShopCtx {
  shopId: string | null      // null = tất cả shop
  setShopId: (id: string | null) => void
  shops: Shop[]
  setShops: (shops: Shop[]) => void
}

const ShopContext = createContext<ShopCtx>({
  shopId: null,
  setShopId: () => {},
  shops: [],
  setShops: () => {},
})

export function ShopProvider({ children }: { children: React.ReactNode }) {
  const [shopId, setShopId] = useState<string | null>(null)
  const [shops, setShops] = useState<Shop[]>([])

  return (
    <ShopContext.Provider value={{ shopId, setShopId, shops, setShops }}>
      {children}
    </ShopContext.Provider>
  )
}

export const useShop = () => useContext(ShopContext)

// ==================== THEME ====================
export type Theme = 'dark' | 'light'

interface ThemeCtx {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeCtx>({ theme: 'dark', toggleTheme: () => {} })

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme') as Theme
    if (saved) return saved
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  })

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark'
      localStorage.setItem('theme', next)
      return next
    })
  }, [])

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
