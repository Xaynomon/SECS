import React, { useState } from 'react';
import { ComponentPinDefinition } from '../../types/componentRegistry';

interface PinTerminalProps {
  pin: ComponentPinDefinition;
  isConnecting: boolean;
  onPinClick: (e: React.MouseEvent) => void;
}

export const PinTerminal: React.FC<PinTerminalProps> = ({
  pin,
  isConnecting,
  onPinClick,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const displayName = pin.label || pin.name || pin.id;
  const pinDir = pin.direction || pin.type || 'passive';

  const getPinColor = () => {
    switch (pinDir) {
      case 'output':
        return '#f59e0b'; // Amber
      case 'input':
        return '#8b5cf6'; // Violet
      case 'bidirectional':
        return '#38bdf8'; // Cyan
      default:
        if (pin.id === 'vcc' || pin.id.includes('pos')) return '#ef4444';
        if (pin.id === 'gnd' || pin.id.includes('neg')) return '#3b82f6';
        return '#22c55e'; // Green
    }
  };

  const pinColor = getPinColor();

  return (
    <g
      transform={`translate(${pin.x}, ${pin.y})`}
      className="cursor-crosshair pointer-events-auto"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        onPinClick(e);
      }}
    >
      {/* Invisible larger hit target for easy clicking */}
      <circle cx="0" cy="0" r="10" fill="transparent" />

      {/* Outer Pulse when connecting */}
      {isConnecting && (
        <circle
          cx="0"
          cy="0"
          r="8"
          fill="none"
          stroke="#38bdf8"
          strokeWidth="1.5"
          className="animate-ping opacity-75"
        />
      )}

      {/* Hover Halo */}
      {isHovered && (
        <circle
          cx="0"
          cy="0"
          r="7"
          fill={pinColor}
          fillOpacity="0.3"
          stroke="#38bdf8"
          strokeWidth="1.5"
        />
      )}

      {/* Main Terminal Pad */}
      <circle
        cx="0"
        cy="0"
        r="4"
        fill="#0f172a"
        stroke={isHovered ? '#38bdf8' : pinColor}
        strokeWidth="1.8"
      />
      <circle cx="0" cy="0" r="1.5" fill={isHovered ? '#38bdf8' : '#ffffff'} />

      {/* Tooltip on Hover */}
      {isHovered && (
        <g transform="translate(0, -14)" className="pointer-events-none select-none z-50">
          <rect
            x={-((displayName.length * 6 + 12) / 2)}
            y="-14"
            width={displayName.length * 6 + 12}
            height="16"
            rx="3"
            fill="#0f172a"
            stroke="#475569"
            strokeWidth="1"
            filter="drop-shadow(0 2px 4px rgba(0,0,0,0.5))"
          />
          <text
            x="0"
            y="-3"
            fill="#f8fafc"
            fontSize="9"
            fontWeight="bold"
            textAnchor="middle"
            fontFamily="monospace"
          >
            {displayName}
          </text>
        </g>
      )}
    </g>
  );
};

