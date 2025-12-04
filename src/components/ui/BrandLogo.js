import React from 'react';

export function BrandLogo({ size = 64 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 128 128"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7C3AED"/>
          <stop offset="100%" stopColor="#22D3EE"/>
        </linearGradient>
        <linearGradient id="g2" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22D3EE"/>
          <stop offset="100%" stopColor="#7C3AED"/>
        </linearGradient>
      </defs>
      <rect x="8" y="8" width="112" height="112" rx="28" fill="#0B1020"/>
      <g transform="translate(16,24)">
        <rect x="0" y="18" width="60" height="60" rx="16" fill="url(#g1)" transform="rotate(-12 30 48)" opacity="0.95"/>
        <rect x="36" y="0" width="60" height="60" rx="16" fill="url(#g2)" transform="rotate(12 66 30)" opacity="0.95"/>
        <circle cx="30" cy="48" r="9" fill="#FFFFFF" opacity="0.95"/>
        <circle cx="66" cy="30" r="9" fill="#FFFFFF" opacity="0.95"/>
        <path d="M52 40 L58 28 L64 40" fill="none" stroke="#FFE08A" strokeWidth="5" strokeLinecap="round"/>
      </g>
      <circle cx="108" cy="20" r="5" fill="#FFE08A"/>
      <circle cx="18" cy="108" r="4" fill="#22D3EE"/>
    </svg>
  );
}

export default BrandLogo;

