import React from 'react';
import { useTheme } from '../../hooks/useTheme';

export const CrayonCheckmark = ({ size = 100, className = '', animate = true }) => {
  const theme = useTheme();
  
  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <svg 
        viewBox="0 0 100 100" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full overflow-visible"
      >
        {/* Defs for crayon texture filter */}
        <defs>
          <filter id="crayon-texture" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="3" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="3" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>

        {/* Animated Path */}
        <path
          d="M20 55 L40 75 L80 25"
          stroke={theme.accent}
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#crayon-texture)"
          className={animate ? "animate-draw-check" : ""}
          style={{
            strokeDasharray: 100,
            strokeDashoffset: animate ? 100 : 0,
            filter: 'url(#crayon-texture) drop-shadow(2px 4px 4px rgba(0,0,0,0.1))'
          }}
        />
        
        {/* Secondary subtle stroke for "messy" crayon look */}
        <path
          d="M22 53 L42 73 L78 27"
          stroke={theme.accent}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeOpacity="0.6"
          filter="url(#crayon-texture)"
          className={animate ? "animate-draw-check-delayed" : ""}
          style={{
            strokeDasharray: 100,
            strokeDashoffset: animate ? 100 : 0,
          }}
        />
      </svg>
      
      <style>{`
        @keyframes draw-check {
          to { stroke-dashoffset: 0; }
        }
        .animate-draw-check {
          animation: draw-check 0.8s cubic-bezier(0.65, 0, 0.45, 1) forwards;
        }
        .animate-draw-check-delayed {
          animation: draw-check 0.8s cubic-bezier(0.65, 0, 0.45, 1) 0.1s forwards;
        }
      `}</style>
    </div>
  );
};
