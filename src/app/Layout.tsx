import React from 'react'
import { Sidebar } from '../components/layout/Sidebar'
import { PeriodSelector } from '../components/layout/PeriodSelector'
import { ShopSelector } from '../components/layout/ShopSelector'
import { Outlet, useLocation } from 'react-router-dom'
import { ThemeToggle } from '../components/layout/ThemeToggle'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/products': 'Sản phẩm',
  '/finance': 'Tài chính',
  '/upload': 'Upload Báo Cáo',
  '/settings': 'Giá gốc sản phẩm',
}

const PAGES_WITH_PERIOD = ['/dashboard', '/products', '/finance']
const PAGES_WITH_SHOP = ['/dashboard', '/products', '/finance', '/upload']

export function Layout() {
  const location = useLocation()
  const title = PAGE_TITLES[location.pathname] ?? 'Dashboard'
  const showPeriod = PAGES_WITH_PERIOD.includes(location.pathname)
  const showShop = PAGES_WITH_SHOP.includes(location.pathname)

  return (
    <div className="layout">
      <Sidebar />
      <div className="main-content">
        <header className="page-header">
          <div className="page-header-left">
            <h1 className="page-title">{title}</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <ThemeToggle />
            {showShop && <ShopSelector />}
            {showPeriod && <PeriodSelector />}
          </div>
        </header>
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
