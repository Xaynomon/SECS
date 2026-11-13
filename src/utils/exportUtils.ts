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

/**
 * Clones and normalizes the live canvas SVG into a standalone, valid XML document
 * safe for both SVG vector download and offscreen HTMLImageElement PNG rasterization.
 */
function prepareClonedSvgForExport(
  svgEl: SVGSVGElement,
  bbox: { minX: number; minY: number; width: number; height: number },
  bgColor: string
): { clone: SVGSVGElement; serialized: string } {
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
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

  // Convert CSS-function filter attributes (`drop-shadow(...)`) to inline style so strict SVG XML parsers succeed
  const filteredEls = clone.querySelectorAll('[filter]');
  filteredEls.forEach((el) => {
    const val = el.getAttribute('filter');
    el.removeAttribute('filter');
    if (val && val !== 'none' && val.includes('drop-shadow')) {
      (el as SVGElement).style.filter = val;
    }
  });

  // Ensure XHTML namespace inside any foreignObject so SVG-in-Image doesn't reject HTML nodes
  const foreignObjects = clone.querySelectorAll('foreignObject');
  foreignObjects.forEach((fo) => {
    Array.from(fo.children).forEach((child) => {
      if (!child.getAttribute('xmlns')) {
        child.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
      }
    });
  });

  // Prepend opaque background rect
  const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bgRect.setAttribute('x', `${bbox.minX}`);
  bgRect.setAttribute('y', `${bbox.minY}`);
  bgRect.setAttribute('width', `${bbox.width}`);
  bgRect.setAttribute('height', `${bbox.height}`);
  bgRect.setAttribute('fill', bgColor);
  clone.insertBefore(bgRect, clone.firstChild);

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
  projectName?: string
) {
  const svgEl = document.querySelector('main svg') as SVGSVGElement | null;
  if (!svgEl) return;

  const isDark = theme === 'dark';
  const bgColor = isDark ? '#0b1120' : '#f8fafc';
  const bbox = getCircuitBoundingBox(components, wires);
  const { serialized } = prepareClonedSvgForExport(svgEl, bbox, bgColor);

  const source = serialized.startsWith('<?xml')
    ? serialized
    : '<?xml version="1.0" standalone="no"?>\r\n' + serialized;

  const filename = `${sanitizeExportBaseName(projectName)}.svg`;
  downloadFile(source, filename, 'image/svg+xml;charset=utf-8');
}

/**
 * Exports current circuit as high-resolution PNG
 */
export function exportCircuitPng(
  components: CircuitComponent[],
  wires: CircuitWire[],
  theme: 'dark' | 'light',
  projectName?: string
) {
  const svgEl = document.querySelector('main svg') as SVGSVGElement | null;
  if (!svgEl) return;

  const isDark = theme === 'dark';
  const bgColor = isDark ? '#0b1120' : '#f8fafc';
  const bbox = getCircuitBoundingBox(components, wires);
  const { serialized } = prepareClonedSvgForExport(svgEl, bbox, bgColor);
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

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
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
