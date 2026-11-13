import { CircuitFileFormat, ViewportTransform } from '../types/circuit';
import { downloadFile } from './exportUtils';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  data?: CircuitFileFormat;
}

/**
 * Validates and normalizes an imported .secs circuit JSON object
 */
export function validateCircuitFile(raw: any): ValidationResult {
  if (!raw || typeof raw !== 'object') {
    return { isValid: false, error: 'File is empty or not a valid JSON object.' };
  }

  // Check version or set default
  const version = typeof raw.version === 'string' ? raw.version : '1.0.0';

  // Check components array
  if (!Array.isArray(raw.components)) {
    return { isValid: false, error: 'Invalid schema: "components" must be an array.' };
  }

  // Validate components
  for (let i = 0; i < raw.components.length; i++) {
    const c = raw.components[i];
    if (!c || typeof c !== 'object') {
      return { isValid: false, error: `Invalid component at index ${i}: not an object.` };
    }
    if (typeof c.id !== 'string' || typeof c.type !== 'string') {
      return { isValid: false, error: `Component at index ${i} is missing valid "id" or "type".` };
    }
    if (typeof c.x !== 'number' || typeof c.y !== 'number') {
      return { isValid: false, error: `Component "${c.id}" has invalid (x, y) coordinates.` };
    }
  }

  // Check wires array
  if (!Array.isArray(raw.wires)) {
    return { isValid: false, error: 'Invalid schema: "wires" must be an array.' };
  }

  // Validate wires
  for (let i = 0; i < raw.wires.length; i++) {
    const w = raw.wires[i];
    if (!w || typeof w !== 'object') {
      return { isValid: false, error: `Invalid wire at index ${i}: not an object.` };
    }
    const fromCompId = w.fromCompId || w.sourceCompId;
    const toCompId = w.toCompId || w.targetCompId;
    const fromPinId = w.fromPinId || w.sourcePin;
    const toPinId = w.toPinId || w.targetPin;

    if (!fromCompId || !toCompId || !fromPinId || !toPinId) {
      return { isValid: false, error: `Wire at index ${i} is missing connection endpoint pin references.` };
    }
  }

  // Normalize viewport / canvasTransform
  const vp = raw.viewport || raw.canvasTransform || {};
  const normalizedViewport: ViewportTransform = {
    zoom: typeof vp.zoom === 'number' ? Math.max(0.2, Math.min(4.0, vp.zoom)) : 1.0,
    panX: typeof vp.panX === 'number' ? vp.panX : 100,
    panY: typeof vp.panY === 'number' ? vp.panY : 100,
  };

  const normalized: CircuitFileFormat = {
    version,
    timestamp: typeof raw.timestamp === 'string' ? raw.timestamp : new Date().toISOString(),
    name: typeof raw.name === 'string' ? raw.name : 'circuit.secs',
    theme: raw.theme === 'light' || raw.theme === 'dark' ? raw.theme : undefined,
    viewport: normalizedViewport,
    canvasTransform: normalizedViewport,
    components: raw.components.map((c: any) => ({
      id: c.id,
      type: c.type,
      label: typeof c.label === 'string' ? c.label : c.id,
      x: Math.round(c.x),
      y: Math.round(c.y),
      rotation: typeof c.rotation === 'number' ? c.rotation : 0,
      mirrored: Boolean(c.mirrored),
      properties: c.properties && typeof c.properties === 'object' ? c.properties : {},
      state: c.state || {},
    })),
    wires: raw.wires.map((w: any) => ({
      id: w.id || `wire_${Math.random().toString(36).substring(2, 8)}`,
      fromCompId: w.fromCompId || w.sourceCompId,
      fromPinId: w.fromPinId || w.sourcePin,
      toCompId: w.toCompId || w.targetCompId,
      toPinId: w.toPinId || w.targetPin,
      waypoints: Array.isArray(w.waypoints)
        ? w.waypoints.map((pt: any) => ({ x: Math.round(pt.x), y: Math.round(pt.y) }))
        : [],
      color: typeof w.color === 'string' ? w.color : '#22c55e',
      state: w.state,
    })),
  };

  return { isValid: true, data: normalized };
}

/**
 * Saves a circuit project to file using modern File System Access API
 * or fallbacks cleanly to browser download.
 */
export async function saveProjectToFile(fileData: CircuitFileFormat): Promise<void> {
  const jsonContent = JSON.stringify(fileData, null, 2);

  // Check if File System Access API is supported
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: fileData.name || 'circuit.secs',
        types: [
          {
            description: 'SECS Circuit Simulator Project (*.secs)',
            accept: {
              'application/json': ['.secs', '.json'],
            },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(jsonContent);
      await writable.close();
      return;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // User cancelled picker, do nothing
        return;
      }
      // If error occurred, fall through to anchor fallback
      console.warn('File System Access API failed, falling back to download:', err);
    }
  }

  // Fallback: browser anchor download
  downloadFile(jsonContent, fileData.name || 'circuit.secs', 'application/json');
}
