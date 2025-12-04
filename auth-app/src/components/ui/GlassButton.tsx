'use client'
import React from 'react'
import { useTheme } from '@/hooks/useTheme'
import { withOpacity, glassStyle } from '@/utils/colorUtils'

type Props = {
  tone?: 'primary' | 'secondary' | 'accent'
  variant?: 'solid' | 'soft' | 'homePrimary' | 'homeSecondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
  className?: string
  style?: React.CSSProperties
  disabled?: boolean
  leadingIcon?: React.ComponentType<{ className?: string }>
  trailingIcon?: React.ComponentType<{ className?: string }>
  children?: React.ReactNode
} & React.ButtonHTMLAttributes<HTMLButtonElement>

export function GlassButton({
  tone = 'primary',
  variant = 'soft',
  size = 'md',
  fullWidth = false,
  className = '',
  style,
  disabled = false,
  leadingIcon: LeadingIcon,
  trailingIcon: TrailingIcon,
  children,
  ...rest
}: Props) {
  const theme = useTheme()
  const color = tone === 'primary' ? theme.primary : tone === 'secondary' ? theme.secondary : theme.accent
  let computedStyle: React.CSSProperties = {}
  if (variant === 'solid') {
    computedStyle = glassStyle(color, 0.4, 12, 0.6)
    computedStyle.color = theme.text
  } else if (variant === 'soft') {
    computedStyle = glassStyle(color, 0.28, 12, 0.45)
    computedStyle.color = color as string
  } else if (variant === 'homePrimary') {
    computedStyle = {
      backgroundColor: withOpacity(theme.secondary, 0.5),
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid rgba(255, 255, 255, 0.3)',
      borderBottom: `4px solid ${theme.primary}`,
      boxShadow: `0 0 0 1px rgba(255,255,255,0.1), 0 10px 30px -5px ${withOpacity(theme.primary, 0.38)}`,
      color: theme.text
    }
  } else if (variant === 'homeSecondary') {
    computedStyle = {
      backgroundColor: withOpacity(theme.secondary, 0.15),
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: '1px solid rgba(255, 255, 255, 0.3)',
      boxShadow: '0 6px 14px rgba(0,0,0,0.15)',
      color: theme.text
    }
  } else if (variant === 'ghost') {
    computedStyle = {
      backgroundColor: 'transparent',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      border: `1px dashed ${withOpacity(color as string, 0.5)}`,
      color: color as string
    }
  }
  const sizeClass = size === 'sm' ? 'px-3 py-1.5 text-xs' : size === 'lg' ? 'px-5 py-3 text-base' : 'px-4 py-2 text-sm'
  const widthClass = fullWidth ? 'w-full' : ''
  const base = `glass-button inline-flex items-center justify-center gap-2 ${sizeClass} ${widthClass} rounded-lg font-bold active:scale-[0.98] transition-all`
  return (
    <button disabled={disabled} className={`${base} ${className}`} style={{ ...computedStyle, ...style }} {...rest}>
      {LeadingIcon ? <LeadingIcon className="w-4 h-4" /> : null}
      {children}
      {TrailingIcon ? <TrailingIcon className="w-4 h-4" /> : null}
    </button>
  )
}
