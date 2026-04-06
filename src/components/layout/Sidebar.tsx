import React from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  Wallet,
  Upload,
  Settings,
  TrendingUp,
  LogOut
} from 'lucide-react'
import { useAuth } from '../../lib/AuthContext'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/products', icon: Package, label: 'Sản phẩm' },
  { to: '/finance', icon: Wallet, label: 'Tài chính' },
  { to: '/upload', icon: Upload, label: 'Upload' },
  { to: '/settings', icon: Settings, label: 'Cài đặt' },
]

export function Sidebar() {
  const { logout, user } = useAuth()

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <TrendingUp size={18} />
        </div>
        <div className="sidebar-logo-text">
          <strong>Shopee Analytics</strong>
          <span>Dashboard v1.0</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-label">Menu</div>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <Icon className="nav-icon" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            {user.picture ? (
              <img src={user.picture} alt="Avatar" style={{ width: 24, height: 24, borderRadius: '50%' }} />
            ) : null}
            <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500, color: 'var(--text-primary)' }}>
              {user.name}
            </div>
            <button className="btn btn-ghost btn-sm btn-icon" onClick={logout} title="Đăng xuất" style={{ color: 'var(--danger)' }}>
              <LogOut size={14} />
            </button>
          </div>
        )}
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
          © 2026 Shopee Analytics
        </div>
      </div>
    </aside>
  )
}
