import React from 'react';

export function BrandLogo({ size = 64 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 360 220"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Beige V (Left) */}
      <path d="M20,50 L65,50 L100,130 L135,50 L180,50 L100,210 Z" fill="#EAE0C8" />

      {/* Purple V (Middle) */}
      <path d="M100,50 L145,50 L180,130 L225,20 L270,20 L180,210 Z" fill="#9B8DA0" />

      {/* Brown P Loop (Right) */}
      <path d="M270,20 L310,20 C340,20 340,110 310,110 L228,110 L242,70 L310,70 C320,70 320,50 310,50 L258,50 L225,20 Z" fill="#6F4E41" />
    </svg>
  );
}

export default BrandLogo;
