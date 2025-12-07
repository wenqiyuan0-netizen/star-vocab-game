import React from 'react';
import { useTheme } from '../../hooks/useTheme';
import { withOpacity, glassStyle } from '../../../utils/colorUtils';

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
}) {
  const theme = useTheme();
  const color = theme[tone] || theme.primary;
  let computedStyle = {};
  if (variant === 'solid') {
    computedStyle = glassStyle(color, 0.4, 12, 0.6);
    computedStyle.color = theme.roles ? theme.roles.buttonPrimaryText : theme.text;
  } else if (variant === 'soft') {
    computedStyle = glassStyle(color, 0.28, 12, 0.45);
    computedStyle.color = theme.contrast && theme.contrast[0] ? theme.contrast[0] : color;
  } else if (variant === 'homePrimary') {
    computedStyle = {
      backgroundColor: withOpacity(theme.secondary, 0.5),
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      border: `1px solid ${withOpacity(theme.contrast && theme.contrast[0] ? theme.contrast[0] : theme.primary, 0.3)}`,
      borderBottom: `4px solid ${theme.primary}`,
      boxShadow: `0 0 0 1px ${withOpacity(theme.contrast && theme.contrast[0] ? theme.contrast[0] : theme.primary, 0.1)}, 0 10px 30px -5px ${withOpacity(theme.contrast && theme.contrast[0] ? theme.contrast[0] : theme.primary, 0.38)}`,
      color: theme.roles ? theme.roles.buttonPrimaryText : theme.text
    };
  } else if (variant === 'homeSecondary') {
    computedStyle = {
      backgroundColor: withOpacity(theme.secondary, 0.15),
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: `1px solid ${withOpacity(theme.contrast && theme.contrast[0] ? theme.contrast[0] : theme.primary, 0.3)}`,
      boxShadow: `0 6px 14px ${withOpacity(theme.contrast && theme.contrast[0] ? theme.contrast[0] : theme.primary, 0.15)}`,
      color: theme.contrast && theme.contrast[0] ? theme.contrast[0] : theme.text
    };
  } else if (variant === 'ghost') {
    computedStyle = {
      backgroundColor: 'transparent',
      backdropFilter: 'blur(8px)',
      border: `1px dashed ${withOpacity((theme.contrast && theme.contrast[0] ? theme.contrast[0] : color), 0.5)}`,
      color: theme.contrast && theme.contrast[0] ? theme.contrast[0] : color
    };
  }
  const sizeClass = size === 'sm' ? 'px-3 py-1.5 text-xs' : size === 'lg' ? 'px-5 py-3 text-base' : 'px-4 py-2 text-sm';
  const widthClass = fullWidth ? 'w-full' : '';
  const base = `glass-button inline-flex items-center justify-center gap-2 ${sizeClass} ${widthClass} rounded-lg font-bold active:scale-[0.98] transition-all`;
  return (
    <button disabled={disabled} className={`${base} ${className}`} style={{ ...computedStyle, ...style }} {...rest}>
      {LeadingIcon ? <LeadingIcon className="w-4 h-4" /> : null}
      {children}
      {TrailingIcon ? <TrailingIcon className="w-4 h-4" /> : null}
    </button>
  );
}
