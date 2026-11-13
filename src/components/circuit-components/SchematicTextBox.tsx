import React, { useState, useEffect, useRef } from 'react';
import { CircuitComponent } from '../../types/circuit';
import { useCircuitStore } from '../../store/useCircuitStore';
import { snapToGrid } from '../../utils/geometry';

interface SchematicTextBoxProps {
  component: CircuitComponent;
  isSelected: boolean;
  theme: 'dark' | 'light';
  zoom: number;
}

export const SchematicTextBox: React.FC<SchematicTextBoxProps> = ({
  component,
  isSelected,
  theme,
}) => {
  const { updateComponentProperty } = useCircuitStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(component.properties.text || 'Add note here...');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isDark = theme === 'dark';
  const p = component.properties;

  const boxWidth = Math.max(80, p.boxWidth || 160);
  const boxHeight = Math.max(40, p.boxHeight || 80);
  const fontSize = p.fontSize || 'md';
  const fontWeight = p.fontWeight || 'normal';
  const fontStyle = p.fontStyle || 'normal';
  const bgStyle = p.bgStyle || 'sticky-yellow';
  const borderStyle = p.borderStyle || 'dashed';

  // Resize drag state
  const [, setIsResizing] = useState(false);
  const resizeStartRef = useRef<{ startX: number; startY: number; initW: number; initH: number } | null>(null);

  useEffect(() => {
    setEditText(p.text || 'Add note here...');
  }, [p.text]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  const commitText = () => {
    setIsEditing(false);
    updateComponentProperty(component.id, 'text', editText);
  };

  // Font size mapping
  const getFontSizePx = () => {
    switch (fontSize) {
      case 'sm':
        return 12;
      case 'lg':
        return 18;
      case 'xl':
        return 22;
      case 'md':
      default:
        return 14;
    }
  };

  // Background and text color mapping
  const getStyles = () => {
    let bg = 'transparent';
    let textColor = isDark ? '#e2e8f0' : '#1e293b';
    let borderColor = isDark ? '#475569' : '#cbd5e1';

    if (p.color) {
      textColor = p.color;
    }

    switch (bgStyle) {
      case 'sticky-yellow':
        bg = isDark ? '#854d0e' : '#fef08a';
        textColor = isDark ? '#fef08a' : '#713f12';
        borderColor = isDark ? '#ca8a04' : '#facc15';
        break;
      case 'sticky-blue':
        bg = isDark ? '#1e3a8a' : '#e0f2fe';
        textColor = isDark ? '#bfdbfe' : '#0369a1';
        borderColor = isDark ? '#2563eb' : '#38bdf8';
        break;
      case 'sticky-green':
        bg = isDark ? '#14532d' : '#dcfce7';
        textColor = isDark ? '#bbf7d0' : '#15803d';
        borderColor = isDark ? '#16a34a' : '#4ade80';
        break;
      case 'card':
        bg = isDark ? '#1e293b' : '#ffffff';
        textColor = isDark ? '#f8fafc' : '#0f172a';
        borderColor = isDark ? '#334155' : '#e2e8f0';
        break;
      case 'transparent':
      default:
        bg = 'transparent';
        break;
    }

    return { bg, textColor, borderColor };
  };

  const { bg, textColor, borderColor } = getStyles();

  // Resize handler
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    resizeStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initW: boxWidth,
      initH: boxHeight,
    };

    const handleWindowMouseMove = (moveEvent: MouseEvent) => {
      if (!resizeStartRef.current) return;
      const dx = moveEvent.clientX - resizeStartRef.current.startX;
      const dy = moveEvent.clientY - resizeStartRef.current.startY;
      const newW = snapToGrid(Math.max(80, resizeStartRef.current.initW + dx));
      const newH = snapToGrid(Math.max(40, resizeStartRef.current.initH + dy));
      updateComponentProperty(component.id, 'boxWidth', newW);
      updateComponentProperty(component.id, 'boxHeight', newH);
    };

    const handleWindowMouseUp = () => {
      setIsResizing(false);
      resizeStartRef.current = null;
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
  };

  return (
    <g className="select-none">
      {/* Background Rect */}
      <rect
        x="0"
        y="0"
        width={boxWidth}
        height={boxHeight}
        rx="6"
        fill={bg}
        stroke={
          isSelected
            ? '#38bdf8'
            : borderStyle === 'none'
            ? 'transparent'
            : borderColor
        }
        strokeWidth={isSelected ? 2 : borderStyle === 'none' ? 0 : 1.5}
        strokeDasharray={borderStyle === 'dashed' ? '5 3' : 'none'}
        className="transition-colors"
      />

      {/* HTML ForeignObject for rich multiline text editing */}
      <foreignObject
        x="6"
        y="6"
        width={boxWidth - 12}
        height={boxHeight - 12}
        className="overflow-hidden"
      >
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={commitText}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                commitText();
              }
            }}
            className="w-full h-full p-1 bg-transparent resize-none border-none outline-none font-sans"
            style={{
              fontSize: `${getFontSizePx()}px`,
              fontWeight: fontWeight,
              fontStyle: fontStyle,
              color: textColor,
            }}
          />
        ) : (
          <div
            onDoubleClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            className="w-full h-full p-1 whitespace-pre-wrap break-words cursor-text font-sans overflow-hidden"
            style={{
              fontSize: `${getFontSizePx()}px`,
              fontWeight: fontWeight,
              fontStyle: fontStyle,
              color: textColor,
            }}
            title="Double-click to edit note"
          >
            {p.text || 'Double-click to add note...'}
          </div>
        )}
      </foreignObject>

      {/* Bottom-right Corner Resize Grip Handle */}
      {isSelected && (
        <g
          transform={`translate(${boxWidth - 10}, ${boxHeight - 10})`}
          className="cursor-nwse-resize"
          onMouseDown={handleResizeMouseDown}
        >
          <rect x="-4" y="-4" width="14" height="14" fill="transparent" />
          <path
            d="M 2 8 L 8 2 M 5 8 L 8 5 M 8 8 L 8 8"
            stroke="#38bdf8"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </g>
      )}
    </g>
  );
};
