import { CircuitComponent, CircuitWire } from '../types/circuit';
import { COMPONENT_DEFINITIONS } from '../constants/componentLibrary';
import { getComponentValueString } from './geometry';

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generates and downloads a Bill of Materials (BOM) CSV file
 * Formatted with exact columns:
 * Component Type, Designators, Parameter/Value, Quantity
 * Example: "Resistor", "R1, R2", "1kΩ", 2
 */
export function exportBomCsv(components: CircuitComponent[]) {
  if (components.length === 0) {
    alert('No components to export to BOM.');
    return;
  }

  const rows = [
    ['Component Type', 'Designators', 'Parameter/Value', 'Quantity'],
  ];

  // Group by (type + valueString)
  interface BomGroup {
    typeName: string;
    valueStr: string;
    labels: string[];
    count: number;
  }

  const groups = new Map<string, BomGroup>();

  for (const comp of components) {
    const def = COMPONENT_DEFINITIONS[comp.type];
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
    // Sort labels naturally (e.g. R1, R2, R10)
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
 * Calculates bounding box of all circuit components and wires
 */
function getCircuitBoundingBox(
  components: CircuitComponent[],
  wires: CircuitWire[]
): { minX: number; minY: number; width: number; height: number } {
  if (components.length === 0 && wires.length === 0) {
    return { minX: 0, minY: 0, width: 1000, height: 800 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const c of components) {
    const def = COMPONENT_DEFINITIONS[c.type];
    const w = def ? def.width : 80;
    const h = def ? def.height : 60;
    minX = Math.min(minX, c.x - 30);
    minY = Math.min(minY, c.y - 30);
    maxX = Math.max(maxX, c.x + w + 30);
    maxY = Math.max(maxY, c.y + h + 30);
  }

  for (const w of wires) {
    if (w.waypoints) {
      for (const pt of w.waypoints) {
        minX = Math.min(minX, pt.x - 20);
        minY = Math.min(minY, pt.y - 20);
        maxX = Math.max(maxX, pt.x + 20);
        maxY = Math.max(maxY, pt.y + 20);
      }
    }
  }

  const padding = 50;
  return {
    minX: Math.round(minX - padding),
    minY: Math.round(minY - padding),
    width: Math.max(400, Math.round(maxX - minX + padding * 2)),
    height: Math.max(300, Math.round(maxY - minY + padding * 2)),
  };
}

/**
 * Exports current circuit as clean, independent vector SVG
 */
export function exportCircuitSvg(
  components: CircuitComponent[],
  wires: CircuitWire[],
  theme: 'dark' | 'light'
) {
  const svgEl = document.querySelector('main svg');
  if (!svgEl) return;

  const isDark = theme === 'dark';
  const bgColor = isDark ? '#0b1120' : '#f8fafc';

  const bbox = getCircuitBoundingBox(components, wires);
  const serializer = new XMLSerializer();

  // Clone SVG node so we can manipulate viewBox without affecting live DOM
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('viewBox', `${bbox.minX} ${bbox.minY} ${bbox.width} ${bbox.height}`);
  clone.setAttribute('width', `${bbox.width}`);
  clone.setAttribute('height', `${bbox.height}`);

  // Find the world transform group and reset pan/zoom so it's aligned to world coords
  const worldGroup = clone.querySelector('g[transform*="translate"]');
  if (worldGroup) {
    worldGroup.removeAttribute('transform');
  }

  // Prepend background rect to clone
  const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bgRect.setAttribute('x', `${bbox.minX}`);
  bgRect.setAttribute('y', `${bbox.minY}`);
  bgRect.setAttribute('width', `${bbox.width}`);
  bgRect.setAttribute('height', `${bbox.height}`);
  bgRect.setAttribute('fill', bgColor);
  clone.insertBefore(bgRect, clone.firstChild);

  let source = serializer.serializeToString(clone);
  if (!source.startsWith('<?xml')) {
    source = '<?xml version="1.0" standalone="no"?>\r\n' + source;
  }

  downloadFile(source, 'circuit_schematic.svg', 'image/svg+xml;charset=utf-8');
}

/**
 * Exports current circuit as high-resolution PNG
 */
export function exportCircuitPng(
  components: CircuitComponent[],
  wires: CircuitWire[],
  theme: 'dark' | 'light'
) {
  const svgEl = document.querySelector('main svg');
  if (!svgEl) return;

  const isDark = theme === 'dark';
  const bgColor = isDark ? '#0b1120' : '#f8fafc';
  const bbox = getCircuitBoundingBox(components, wires);

  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('viewBox', `${bbox.minX} ${bbox.minY} ${bbox.width} ${bbox.height}`);
  clone.setAttribute('width', `${bbox.width}`);
  clone.setAttribute('height', `${bbox.height}`);

  const worldGroup = clone.querySelector('g[transform*="translate"]');
  if (worldGroup) {
    worldGroup.removeAttribute('transform');
  }

  const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bgRect.setAttribute('x', `${bbox.minX}`);
  bgRect.setAttribute('y', `${bbox.minY}`);
  bgRect.setAttribute('width', `${bbox.width}`);
  bgRect.setAttribute('height', `${bbox.height}`);
  bgRect.setAttribute('fill', bgColor);
  clone.insertBefore(bgRect, clone.firstChild);

  const serializer = new XMLSerializer();
  const source = serializer.serializeToString(clone);

  const img = new Image();
  const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  img.onload = () => {
    // 2x Retina scale for crisp lines
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = bbox.width * scale;
    canvas.height = bbox.height * scale;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const pngUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = 'circuit_schematic.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(pngUrl);
    }, 'image/png');
  };

  img.src = url;
}
