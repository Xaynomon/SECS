import { CircuitComponent, CircuitWire } from '../types/circuit';
import { COMPONENT_DEFINITIONS } from '../constants/componentLibrary';
import { ComponentRegistry } from '../registry/ComponentRegistry';
import {
  getComponentValueString,
  getPinAbsolutePosition,
  getRotatedBoundingBox,
} from './geometry';

function triggerDownloadUrl(url: string, filename: string, revokeAfter = false) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  if (revokeAfter) {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  triggerDownloadUrl(url, filename, true);
}

function sanitizeExportBaseName(projectName?: string): string {
  const cleaned = (projectName || 'circuit_schematic')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || 'circuit_schematic';
}

/**
 * Generates and downloads a Bill of Materials (BOM) CSV file
 * Formatted with exact columns:
 * Component Type, Designators, Parameter/Value, Quantity
 * Example: "Resistor", "R1, R2", "1kΩ", 2
 */
export function exportBomCsv(components: CircuitComponent[]) {
  const circuitParts = components.filter(
    (c) => c.type !== 'textbox' && c.type !== 'shape'
  );

  if (circuitParts.length === 0) {
    alert('No components to export to BOM.');
    return;
  }

  const rows = [['Component Type', 'Designators', 'Parameter/Value', 'Quantity']];

  interface BomGroup {
    typeName: string;
    valueStr: string;
    labels: string[];
    count: number;
  }

  const groups = new Map<string, BomGroup>();

  for (const comp of circuitParts) {
    const def = ComponentRegistry.getComponentDefinition(comp.type) || COMPONENT_DEFINITIONS[comp.type];
    const typeName = def ? def.name : comp.type;
    const valueStr = getComponentValueString(comp) || 'Standard';

    const groupKey = `${comp.type}___${valueStr}`;
    const existing = groups.get(groupKey);

    if (existing) {
      existing.labels.push(comp.label);
      existing.count += 1;
    } else {
      groups.set(groupKey, {
        typeName,
        valueStr,
        labels: [comp.label],
        count: 1,
      });
    }
  }

  groups.forEach(({ typeName, valueStr, labels, count }) => {
    labels.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    rows.push([
      `"${typeName}"`,
      `"${labels.join(', ')}"`,
      `"${valueStr}"`,
      count.toString(),
    ]);
  });

  const csvContent = rows.map((r) => r.join(',')).join('\n');
  downloadFile(csvContent, 'circuit_bom.csv', 'text/csv');
}

/**
 * Calculates tight bounding box across all placed components, shapes, textboxes, and wires.
 */
export function getCircuitBoundingBox(
  components: CircuitComponent[],
  wires: CircuitWire[]
): { minX: number; minY: number; width: number; height: number } {
  if (components.length === 0 && wires.length === 0) {
    return { minX: 0, minY: 0, width: 1200, height: 800 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const compMap = new Map<string, CircuitComponent>();
  for (const c of components) {
    compMap.set(c.id, c);
    const def = ComponentRegistry.getComponentDefinition(c.type) || COMPONENT_DEFINITIONS[c.type];

    let baseW = def?.width ?? 80;
    let baseH = def?.height ?? 60;
    if (c.type === 'shape') {
      baseW = Math.max(40, Number(c.properties?.width) || baseW || 200);
      baseH = Math.max(40, Number(c.properties?.height) || baseH || 140);
    } else if (c.type === 'textbox') {
      baseW = Math.max(80, Number(c.properties?.boxWidth ?? c.properties?.width) || baseW || 160);
      baseH = Math.max(40, Number(c.properties?.boxHeight ?? c.properties?.height) || baseH || 80);
    }

    const rotated = getRotatedBoundingBox(baseW, baseH, c.rotation || 0);
    const margin = 24;
    if (def?.origin === 'center') {
      minX = Math.min(minX, c.x - rotated.width / 2 - margin);
      minY = Math.min(minY, c.y - rotated.height / 2 - margin);
      maxX = Math.max(maxX, c.x + rotated.width / 2 + margin);
      maxY = Math.max(maxY, c.y + rotated.height / 2 + margin);
    } else {
      const cx = c.x + baseW / 2;
      const cy = c.y + baseH / 2;
      minX = Math.min(minX, cx - rotated.width / 2 - margin);
      minY = Math.min(minY, cy - rotated.height / 2 - margin);
      maxX = Math.max(maxX, cx + rotated.width / 2 + margin);
      maxY = Math.max(maxY, cy + rotated.height / 2 + margin);
    }
  }

  for (const w of wires) {
    const fromComp = compMap.get(w.fromCompId);
    const toComp = compMap.get(w.toCompId);
    if (fromComp) {
      const fromDef =
        ComponentRegistry.getComponentDefinition(fromComp.type) ||
        COMPONENT_DEFINITIONS[fromComp.type];
      if (fromDef) {
        const pt = getPinAbsolutePosition(fromComp, w.fromPinId, fromDef);
        minX = Math.min(minX, pt.x - 16);
        minY = Math.min(minY, pt.y - 16);
        maxX = Math.max(maxX, pt.x + 16);
        maxY = Math.max(maxY, pt.y + 16);
      }
    }
    if (toComp) {
      const toDef =
        ComponentRegistry.getComponentDefinition(toComp.type) ||
        COMPONENT_DEFINITIONS[toComp.type];
      if (toDef) {
        const pt = getPinAbsolutePosition(toComp, w.toPinId, toDef);
        minX = Math.min(minX, pt.x - 16);
        minY = Math.min(minY, pt.y - 16);
        maxX = Math.max(maxX, pt.x + 16);
        maxY = Math.max(maxY, pt.y + 16);
      }
    }
    if (w.waypoints) {
      for (const pt of w.waypoints) {
        minX = Math.min(minX, pt.x - 16);
        minY = Math.min(minY, pt.y - 16);
        maxX = Math.max(maxX, pt.x + 16);
        maxY = Math.max(maxY, pt.y + 16);
      }
    }
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return { minX: 0, minY: 0, width: 1200, height: 800 };
  }

  const padding = 60;
  return {
    minX: Math.round(minX - padding),
    minY: Math.round(minY - padding),
    width: Math.max(400, Math.round(maxX - minX + padding * 2)),
    height: Math.max(300, Math.round(maxY - minY + padding * 2)),
  };
}

const SVG_NS = 'http://www.w3.org/2000/svg';

function getTextBoxFontSizePx(fontSize?: string): number {
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
}

function getTextBoxExportStyles(
  properties: Record<string, any>,
  theme: 'dark' | 'light'
): { bg: string; textColor: string; borderColor: string } {
  const isDark = theme === 'dark';
  const bgStyle = properties.bgStyle || 'sticky-yellow';
  let bg = 'transparent';
  let textColor = properties.color || (isDark ? '#e2e8f0' : '#1e293b');
  let borderColor = isDark ? '#475569' : '#cbd5e1';

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
}

function wrapTextBoxLines(text: string, maxCharsPerLine: number): string[] {
  const rawLines = text.split(/\r?\n/);
  const result: string[] = [];

  for (const raw of rawLines) {
    if (!raw) {
      result.push('');
      continue;
    }
    if (raw.length <= maxCharsPerLine) {
      result.push(raw);
      continue;
    }

    const words = raw.split(/(\s+)/);
    let current = '';
    for (const part of words) {
      if ((current + part).length <= maxCharsPerLine) {
        current += part;
      } else if (current.trimEnd()) {
        result.push(current.trimEnd());
        current = part.trimStart();
      } else {
        let rest = current + part;
        while (rest.length > maxCharsPerLine) {
          result.push(rest.slice(0, maxCharsPerLine));
          rest = rest.slice(maxCharsPerLine);
        }
        current = rest;
      }
    }
    if (current.trimEnd()) {
      result.push(current.trimEnd());
    }
  }

  return result.length > 0 ? result : [''];
}

function buildNativeSvgTextBoxGroup(
  doc: Document,
  comp: CircuitComponent,
  theme: 'dark' | 'light'
): SVGGElement {
  const p = comp.properties || {};
  const boxWidth = Math.max(80, Number(p.boxWidth ?? p.width) || 160);
  const boxHeight = Math.max(40, Number(p.boxHeight ?? p.height) || 80);
  const fontSizePx = getTextBoxFontSizePx(p.fontSize);
  const fontWeight = String(p.fontWeight || 'normal');
  const fontStyle = String(p.fontStyle || 'normal');
  const borderStyle = String(p.borderStyle || 'dashed');
  const { bg, textColor, borderColor } = getTextBoxExportStyles(p, theme);

  const g = doc.createElementNS(SVG_NS, 'g');
  g.setAttribute('transform', `translate(${comp.x}, ${comp.y})`);

  const rect = doc.createElementNS(SVG_NS, 'rect');
  rect.setAttribute('x', '0');
  rect.setAttribute('y', '0');
  rect.setAttribute('width', `${boxWidth}`);
  rect.setAttribute('height', `${boxHeight}`);
  rect.setAttribute('rx', '6');
  rect.setAttribute('fill', bg === 'transparent' ? 'none' : bg);
  rect.setAttribute('stroke', borderStyle === 'none' ? 'none' : borderColor);
  rect.setAttribute('stroke-width', borderStyle === 'none' ? '0' : '1.5');
  if (borderStyle === 'dashed') {
    rect.setAttribute('stroke-dasharray', '5 3');
  }
  g.appendChild(rect);

  const rawText =
    typeof p.text === 'string' && p.text.length > 0 ? p.text : 'Double-click to add note...';
  const maxChars = Math.max(8, Math.floor((boxWidth - 20) / (fontSizePx * 0.58)));
  const lines = wrapTextBoxLines(rawText, maxChars);
  const lineHeight = Math.round(fontSizePx * 1.35);
  const maxVisibleLines = Math.max(1, Math.floor((boxHeight - 16) / lineHeight));
  const clippedLines = lines.slice(0, maxVisibleLines);

  const textEl = doc.createElementNS(SVG_NS, 'text');
  textEl.setAttribute('x', '10');
  textEl.setAttribute('y', `${10 + fontSizePx}`);
  textEl.setAttribute('fill', textColor);
  textEl.setAttribute(
    'font-family',
    'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  );
  textEl.setAttribute('font-size', `${fontSizePx}`);
  textEl.setAttribute('font-weight', fontWeight);
  textEl.setAttribute('font-style', fontStyle);

  clippedLines.forEach((line, idx) => {
    const tspan = doc.createElementNS(SVG_NS, 'tspan');
    tspan.setAttribute('x', '10');
    tspan.setAttribute('dy', idx === 0 ? '0' : `${lineHeight}`);
    // Preserve blank lines while keeping valid escaped XML text via DOM textContent
    tspan.textContent = line.length > 0 ? line : '\u00A0';
    textEl.appendChild(tspan);
  });

  g.appendChild(textEl);
  return g;
}

/**
 * Clones and normalizes the live canvas SVG into a standalone, valid XML document
 * safe for both SVG vector download and offscreen HTMLImageElement PNG rasterization.
 */
export function prepareClonedSvgForExport(
  svgEl: SVGSVGElement,
  bbox: { minX: number; minY: number; width: number; height: number },
  bgColor: string,
  includeBackground: boolean = true,
  components: CircuitComponent[] = [],
  theme: 'dark' | 'light' = 'dark'
): { clone: SVGSVGElement; serialized: string } {
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', SVG_NS);
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  clone.setAttribute('viewBox', `${bbox.minX} ${bbox.minY} ${bbox.width} ${bbox.height}`);
  clone.setAttribute('width', `${bbox.width}`);
  clone.setAttribute('height', `${bbox.height}`);
  clone.removeAttribute('class');

  // Reset pan/zoom transform on world group so coordinates map 1:1 with viewBox
  const worldGroup = clone.querySelector('g[transform*="translate"]');
  if (worldGroup) {
    worldGroup.removeAttribute('transform');
  }

  if (includeBackground) {
    // Normalize grid patterns & background grid rects to fill the exported viewBox cleanly
    const patterns = clone.querySelectorAll('pattern');
    patterns.forEach((pat) => {
      pat.setAttribute('x', '0');
      pat.setAttribute('y', '0');
    });

    const bgGridRects = clone.querySelectorAll('rect[width="100%"]');
    bgGridRects.forEach((r) => {
      r.setAttribute('x', `${bbox.minX}`);
      r.setAttribute('y', `${bbox.minY}`);
      r.setAttribute('width', `${bbox.width}`);
      r.setAttribute('height', `${bbox.height}`);
    });
  } else {
    // Strip grid background rects, grid patterns, and origin crosshair axes for transparent exports
    clone.querySelectorAll('rect[width="100%"]').forEach((r) => r.remove());
    clone.querySelectorAll('pattern#grid-minor, pattern#grid-major').forEach((p) => p.remove());
    clone
      .querySelectorAll(
        'line[x1="0"][y1="-20"][x2="0"][y2="20"], line[x1="-20"][y1="0"][x2="20"][y2="0"]'
      )
      .forEach((l) => l.remove());
    if (clone.style) {
      clone.style.background = 'transparent';
    }
  }

  // Convert CSS-function filter attributes (`drop-shadow(...)`) to inline style so strict SVG XML parsers succeed
  const filteredEls = clone.querySelectorAll('[filter]');
  filteredEls.forEach((el) => {
    const val = el.getAttribute('filter');
    el.removeAttribute('filter');
    if (val && val !== 'none' && val.includes('drop-shadow')) {
      (el as SVGElement).style.filter = val;
    }
  });

  // Remove HTML <foreignObject> Text Box subtrees (which taint <canvas> on PNG export)
  const foreignObjects = clone.querySelectorAll('foreignObject');
  foreignObjects.forEach((fo) => {
    const wrapper = fo.closest('g[transform^="translate"]');
    if (wrapper && wrapper !== worldGroup) {
      wrapper.remove();
    } else {
      fo.remove();
    }
  });
  clone.querySelectorAll('foreignObject').forEach((fo) => fo.remove());

  // Re-render every Text Box as pure native SVG <rect> + <text>/<tspan> nodes
  const doc = clone.ownerDocument || document;
  const targetParent = worldGroup || clone;
  const textBoxes = components.filter((c) => c.type === 'textbox');
  for (const tb of textBoxes) {
    targetParent.appendChild(buildNativeSvgTextBoxGroup(doc, tb, theme));
  }

  if (includeBackground) {
    // Prepend opaque background rect
    const bgRect = doc.createElementNS(SVG_NS, 'rect');
    bgRect.setAttribute('x', `${bbox.minX}`);
    bgRect.setAttribute('y', `${bbox.minY}`);
    bgRect.setAttribute('width', `${bbox.width}`);
    bgRect.setAttribute('height', `${bbox.height}`);
    bgRect.setAttribute('fill', bgColor);
    clone.insertBefore(bgRect, clone.firstChild);
  }

  const serializer = new XMLSerializer();
  const serialized = serializer.serializeToString(clone);
  return { clone, serialized };
}

/**
 * Exports current circuit as clean, independent vector SVG
 */
export function exportCircuitSvg(
  components: CircuitComponent[],
  wires: CircuitWire[],
  theme: 'dark' | 'light',
  projectName?: string,
  includeBackground: boolean = true
) {
  const svgEl = document.querySelector('main svg') as SVGSVGElement | null;
  if (!svgEl) return;

  const isDark = theme === 'dark';
  const bgColor = isDark ? '#0b1120' : '#f8fafc';
  const bbox = getCircuitBoundingBox(components, wires);
  const { serialized } = prepareClonedSvgForExport(
    svgEl,
    bbox,
    bgColor,
    includeBackground,
    components,
    theme
  );

  const source = serialized.startsWith('<?xml')
    ? serialized
    : '<?xml version="1.0" standalone="no"?>\r\n' + serialized;

  const filename = `${sanitizeExportBaseName(projectName)}.svg`;
  downloadFile(source, filename, 'image/svg+xml;charset=utf-8');
}

/**
 * Exports current circuit as high-resolution PNG (with optional transparent background)
 */
export function exportCircuitPng(
  components: CircuitComponent[],
  wires: CircuitWire[],
  theme: 'dark' | 'light',
  projectName?: string,
  includeBackground: boolean = true
) {
  const svgEl = document.querySelector('main svg') as SVGSVGElement | null;
  if (!svgEl) return;

  const isDark = theme === 'dark';
  const bgColor = isDark ? '#0b1120' : '#f8fafc';
  const bbox = getCircuitBoundingBox(components, wires);
  const { serialized } = prepareClonedSvgForExport(
    svgEl,
    bbox,
    bgColor,
    includeBackground,
    components,
    theme
  );
  const filename = `${sanitizeExportBaseName(projectName)}.png`;

  const img = new Image();
  img.crossOrigin = 'anonymous';
  const svgBlob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
  const blobUrl = URL.createObjectURL(svgBlob);
  let usedDataUriFallback = false;

  img.onload = () => {
    if (!usedDataUriFallback) {
      URL.revokeObjectURL(blobUrl);
    }

    // 2x resolution for crisp lines, capped safely for massive circuits
    const maxDim = 8192;
    const rawScale = 2;
    const scale = Math.min(
      rawScale,
      maxDim / Math.max(1, bbox.width),
      maxDim / Math.max(1, bbox.height)
    );

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bbox.width * scale));
    canvas.height = Math.max(1, Math.round(bbox.height * scale));

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (includeBackground) {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (blob) {
        const pngUrl = URL.createObjectURL(blob);
        triggerDownloadUrl(pngUrl, filename, true);
      } else {
        try {
          const dataUrl = canvas.toDataURL('image/png');
          triggerDownloadUrl(dataUrl, filename, false);
        } catch (err) {
          console.error('Failed to export PNG:', err);
        }
      }
    }, 'image/png');
  };

  img.onerror = () => {
    URL.revokeObjectURL(blobUrl);
    if (!usedDataUriFallback) {
      usedDataUriFallback = true;
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`;
    } else {
      console.error('PNG export failed: unable to rasterize SVG.');
    }
  };

  img.src = blobUrl;
}
