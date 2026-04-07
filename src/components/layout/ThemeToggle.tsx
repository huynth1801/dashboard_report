import React from 'react'
import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../../lib/context'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <button 
      className="btn-icon btn-ghost" 
      onClick={toggleTheme}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      aria-label="Toggle theme"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-input)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        color: 'var(--text-primary)',
        transition: 'all 0.2s ease',
        cursor: 'pointer',
        width: 34,
        height: 34
      }}
    >
      {theme === 'dark' ? (
        <Sun size={16} />
      ) : (
        <Moon size={16} />
      )}
    </button>
  )
}
