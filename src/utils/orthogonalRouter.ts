import { snapToGrid, getRotatedBoundingBox, getPinAbsolutePosition } from './geometry';
import { CircuitComponent, CircuitWire } from '../types/circuit';
import { COMPONENT_DEFINITIONS } from '../constants/componentLibrary';
import { ComponentRegistry } from '../registry/ComponentRegistry';

export interface Point {
  x: number;
  y: number;
}

export interface WireSegment {
  index: number;
  p1: Point;
  p2: Point;
  isHorizontal: boolean;
  midpoint: Point;
  length: number;
}

/**
 * Calculates Manhattan orthogonal points connecting p1 to p2.
 */
export function getManhattanSegment(p1: Point, p2: Point): Point[] {
  if (p1.x === p2.x && p1.y === p2.y) {
    return [p1];
  }
  if (p1.x === p2.x || p1.y === p2.y) {
    return [p1, p2];
  }

  const isHalfGrid = p1.x % 20 !== 0 || p1.y % 20 !== 0 || p2.x % 20 !== 0 || p2.y % 20 !== 0;
  const snapStep = isHalfGrid ? 10 : 20;

  const dx = Math.abs(p2.x - p1.x);
  const dy = Math.abs(p2.y - p1.y);

  if (dx >= dy) {
    // Horizontal step first, then vertical, then horizontal
    const midX = snapToGrid((p1.x + p2.x) / 2, snapStep);
    return [
      p1,
      { x: midX, y: p1.y },
      { x: midX, y: p2.y },
      p2,
    ];
  } else {
    // Vertical step first, then horizontal, then vertical
    const midY = snapToGrid((p1.y + p2.y) / 2, snapStep);
    return [
      p1,
      { x: p1.x, y: midY },
      { x: p2.x, y: midY },
      p2,
    ];
  }
}

/**
 * Removes collinear intermediate points (e.g. (0,0) -> (10,0) -> (20,0) becomes (0,0) -> (20,0))
 */
export function simplifyOrthogonalPoints(points: Point[]): Point[] {
  if (points.length <= 2) return points;

  // First pass: remove consecutive identical points
  const deduped: Point[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = deduped[deduped.length - 1];
    if (prev.x !== points[i].x || prev.y !== points[i].y) {
      deduped.push(points[i]);
    }
  }

  if (deduped.length <= 2) return deduped;

  // Second pass: remove collinear points
  const result: Point[] = [deduped[0]];
  for (let i = 1; i < deduped.length - 1; i++) {
    const prev = result[result.length - 1];
    const curr = deduped[i];
    const next = deduped[i + 1];

    const isHorizontalCollinear = prev.y === curr.y && curr.y === next.y;
    const isVerticalCollinear = prev.x === curr.x && curr.x === next.x;

    if (!isHorizontalCollinear && !isVerticalCollinear) {
      result.push(curr);
    }
  }

  result.push(deduped[deduped.length - 1]);
  return result;
}

/**
 * Computes full orthogonal points for a wire between start and end,
 * taking into account any custom intermediate waypoints or running A* smart obstacle router.
 */
export function computeWirePoints(
  start: Point,
  end: Point,
  waypoints: Point[] = [],
  components?: CircuitComponent[],
  wires?: CircuitWire[],
  ignoreWireId?: string
): Point[] {
  if (!waypoints || waypoints.length === 0) {
    if (components && components.length > 0) {
      return routeSmartWireAStar(start, end, components, wires, ignoreWireId);
    }
    return simplifyOrthogonalPoints(getManhattanSegment(start, end));
  }

  const nodes = [start, ...waypoints, end];
  const fullPoints: Point[] = [];

  for (let i = 0; i < nodes.length - 1; i++) {
    const p1 = nodes[i];
    const p2 = nodes[i + 1];
    const segment = getManhattanSegment(p1, p2);

    if (fullPoints.length > 0 && segment.length > 0) {
      fullPoints.push(...segment.slice(1));
    } else {
      fullPoints.push(...segment);
    }
  }

  return simplifyOrthogonalPoints(fullPoints);
}

/**
 * Extracts interior segments from a list of orthogonal points.
 */
export function getWireSegments(points: Point[]): WireSegment[] {
  const segments: WireSegment[] = [];
  if (points.length < 2) return segments;

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const isHorizontal = p1.y === p2.y;
    const length = isHorizontal ? Math.abs(p2.x - p1.x) : Math.abs(p2.y - p1.y);

    segments.push({
      index: i,
      p1,
      p2,
      isHorizontal,
      midpoint: {
        x: Math.round((p1.x + p2.x) / 2),
        y: Math.round((p1.y + p2.y) / 2),
      },
      length,
    });
  }

  return segments;
}

/**
 * Moves a wire segment along its orthogonal axis:
 * - If horizontal, moves vertically to newY.
 * - If vertical, moves horizontally to newX.
 * Returns the new full set of simplified points.
 */
export function moveWireSegment(
  points: Point[],
  segmentIndex: number,
  newCoord: number
): Point[] {
  if (points.length < 2 || segmentIndex < 0 || segmentIndex >= points.length - 1) {
    return points;
  }

  const isHalfGrid = points.some((p) => p.x % 20 !== 0 || p.y % 20 !== 0);
  const snapStep = isHalfGrid ? 10 : 20;
  const snapped = snapToGrid(newCoord, snapStep);
  const pts = points.map((p) => ({ ...p }));
  const p1 = pts[segmentIndex];
  const p2 = pts[segmentIndex + 1];
  const isHorizontal = p1.y === p2.y;

  const isFirstSegment = segmentIndex === 0;
  const isLastSegment = segmentIndex === pts.length - 2;

  if (isHorizontal) {
    // Segment is horizontal: moving in Y
    if (!isFirstSegment && !isLastSegment) {
      // Interior horizontal segment
      p1.y = snapped;
      p2.y = snapped;
      return simplifyOrthogonalPoints(pts);
    }

    if (isFirstSegment && isLastSegment) {
      // Only 1 segment total: (start) -> (end)
      // Inserting two intermediate bends: start -> (midX, start.y) -> (midX, snapped) -> (end.x, snapped) -> end
      const midX = snapToGrid((p1.x + p2.x) / 2, snapStep);
      return simplifyOrthogonalPoints([
        p1,
        { x: midX, y: p1.y },
        { x: midX, y: snapped },
        { x: p2.x, y: snapped },
        p2,
      ]);
    }

    if (isFirstSegment) {
      // First segment: p1 is anchored to start pin
      // Convert p1 -> p2 into: p1 -> (p1.x, snapped) -> (p2.x, snapped) -> rest
      pts[segmentIndex + 1].y = snapped;
      pts.splice(1, 0, { x: p1.x, y: snapped });
      return simplifyOrthogonalPoints(pts);
    }

    if (isLastSegment) {
      // Last segment: p2 is anchored to end pin
      // Convert p1 -> p2 into: p1 -> (p1.x, snapped) -> (p2.x, snapped) -> p2
      pts[segmentIndex].y = snapped;
      pts.splice(pts.length - 1, 0, { x: p2.x, y: snapped });
      return simplifyOrthogonalPoints(pts);
    }
  } else {
    // Segment is vertical: moving in X
    if (!isFirstSegment && !isLastSegment) {
      // Interior vertical segment
      p1.x = snapped;
      p2.x = snapped;
      return simplifyOrthogonalPoints(pts);
    }

    if (isFirstSegment && isLastSegment) {
      // Only 1 segment total: (start) -> (end)
      const midY = snapToGrid((p1.y + p2.y) / 2, snapStep);
      return simplifyOrthogonalPoints([
        p1,
        { x: p1.x, y: midY },
        { x: snapped, y: midY },
        { x: snapped, y: p2.y },
        p2,
      ]);
    }

    if (isFirstSegment) {
      pts[segmentIndex + 1].x = snapped;
      pts.splice(1, 0, { x: snapped, y: p1.y });
      return simplifyOrthogonalPoints(pts);
    }

    if (isLastSegment) {
      pts[segmentIndex].x = snapped;
      pts.splice(pts.length - 1, 0, { x: snapped, y: p2.y });
      return simplifyOrthogonalPoints(pts);
    }
  }

  return simplifyOrthogonalPoints(pts);
}

/**
 * Moves a corner bend waypoint while maintaining 90-degree orthogonal connections to neighbors.
 */
export function moveCornerWaypoint(
  points: Point[],
  waypointIndex: number,
  targetPoint: Point
): Point[] {
  // waypointIndex is index in points array (must be 1 to points.length - 2)
  if (waypointIndex <= 0 || waypointIndex >= points.length - 1) {
    return points;
  }

  const isHalfGrid = points.some((p) => p.x % 20 !== 0 || p.y % 20 !== 0);
  const snapStep = isHalfGrid ? 10 : 20;

  const snappedX = snapToGrid(targetPoint.x, snapStep);
  const snappedY = snapToGrid(targetPoint.y, snapStep);

  const pts = points.map((p) => ({ ...p }));
  const prev = pts[waypointIndex - 1];
  const curr = pts[waypointIndex];
  const next = pts[waypointIndex + 1];

  const prevIsHorizontal = prev.y === curr.y;

  if (prevIsHorizontal) {
    // prev -> curr is horizontal: prev.y === curr.y
    // curr -> next is vertical: curr.x === next.x
    curr.x = snappedX;
    curr.y = snappedY;
    prev.y = snappedY; // Keeps prev -> curr horizontal
    next.x = snappedX; // Keeps curr -> next vertical
  } else {
    // prev -> curr is vertical: prev.x === curr.x
    // curr -> next is horizontal: curr.y === next.y
    curr.x = snappedX;
    curr.y = snappedY;
    prev.x = snappedX; // Keeps prev -> curr vertical
    next.y = snappedY; // Keeps curr -> next horizontal
  }

  return simplifyOrthogonalPoints(pts);
}

/**
 * Extracts intermediate waypoints (excluding start and end)
 */
export function extractInteriorWaypoints(points: Point[]): Point[] {
  if (points.length <= 2) return [];
  return points.slice(1, -1);
}

/**
 * Converts a sequence of points into an SVG Path string
 */
export function pointsToSvgPath(points: Point[], cornerRadius = 0): string {
  if (points.length < 2) return '';

  if (cornerRadius <= 0 || points.length === 2) {
    return points.reduce((acc, p, idx) => {
      return idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
    }, '');
  }

  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 1; i < points.length - 1; i++) {
    const p0 = points[i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];

    const v0 = { x: p1.x - p0.x, y: p1.y - p0.y };
    const v1 = { x: p2.x - p1.x, y: p2.y - p1.y };

    const len0 = Math.hypot(v0.x, v0.y);
    const len1 = Math.hypot(v1.x, v1.y);

    const r = Math.min(cornerRadius, len0 / 2, len1 / 2);

    const startX = p1.x - (v0.x / len0) * r;
    const startY = p1.y - (v0.y / len0) * r;
    const endX = p1.x + (v1.x / len1) * r;
    const endY = p1.y + (v1.y / len1) * r;

    d += ` L ${startX} ${startY}`;
    d += ` Q ${p1.x} ${p1.y} ${endX} ${endY}`;
  }

  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

interface AStarNode {
  x: number;
  y: number;
  dir: 'H' | 'V' | null;
  g: number;
  f: number;
  parent: AStarNode | null;
}

/**
 * Grid-based A* (A-Star) Manhattan Router with component obstacle avoidance,
 * parallel wire collinear overlap penalty, perpendicular crossover allowance, and turn penalties.
 */
export function routeSmartWireAStar(
  start: Point,
  end: Point,
  components: CircuitComponent[] = [],
  existingWires: CircuitWire[] = [],
  ignoreWireId?: string
): Point[] {
  const isHalfGrid = start.x % 20 !== 0 || start.y % 20 !== 0 || end.x % 20 !== 0 || end.y % 20 !== 0;
  const step = isHalfGrid ? 10 : 20;

  const startX = snapToGrid(start.x, step);
  const startY = snapToGrid(start.y, step);
  const endX = snapToGrid(end.x, step);
  const endY = snapToGrid(end.y, step);

  if (startX === endX && startY === endY) {
    return [start, end];
  }

  // Helper to identify component and pin at world point
  const findPinAt = (pt: Point) => {
    for (const comp of components) {
      const def = ComponentRegistry.getComponentDefinition(comp.type) || COMPONENT_DEFINITIONS[comp.type];
      if (!def?.pins) continue;
      for (const pin of def.pins) {
        const pos = getPinAbsolutePosition(comp, pin.id, def);
        if (Math.abs(pos.x - pt.x) < 3 && Math.abs(pos.y - pt.y) < 3) {
          return { compId: comp.id, pinId: pin.id };
        }
      }
    }
    return null;
  };
  const startPin = findPinAt(start);
  const endPin = findPinAt(end);

  // 1. Collect all unrelated component pins (must NEVER be crossed or stepped on)
  const unrelatedPins = new Set<string>();
  for (const comp of components) {
    const def = ComponentRegistry.getComponentDefinition(comp.type) || COMPONENT_DEFINITIONS[comp.type];
    if (!def?.pins) continue;
    for (const pin of def.pins) {
      const pos = getPinAbsolutePosition(comp, pin.id, def);
      const px = snapToGrid(pos.x, step);
      const py = snapToGrid(pos.y, step);
      const isStart = px === startX && py === startY;
      const isEnd = px === endX && py === endY;
      if (!isStart && !isEnd) {
        unrelatedPins.add(`${px},${py}`);
      }
    }
  }

  // 2. Build Component Obstacle Boxes
  // Component obstacle boxes must be strictly smaller than the pin perimeter
  // (shrunk inward by 10px–15px on each side into the inner component body)
  const obstacleBoxes: { minX: number; maxX: number; minY: number; maxY: number; compId: string }[] = [];
  for (const comp of components) {
    if (comp.type === 'textbox') continue;
    const def = ComponentRegistry.getComponentDefinition(comp.type) || COMPONENT_DEFINITIONS[comp.type];
    const width = def ? def.width : 60;
    const height = def ? def.height : 60;
    const bbox = getRotatedBoundingBox(width, height, comp.rotation || 0);

    const shrinkX = Math.min(12, Math.max(4, Math.floor(bbox.width / 4)));
    const shrinkY = Math.min(12, Math.max(4, Math.floor(bbox.height / 4)));
    obstacleBoxes.push({
      minX: comp.x + bbox.minX + shrinkX,
      maxX: comp.x + bbox.maxX - shrinkX,
      minY: comp.y + bbox.minY + shrinkY,
      maxY: comp.y + bbox.maxY - shrinkY,
      compId: comp.id,
    });
  }

  // 3. Build segments of existing wires to detect collinear overlaps & perpendicular crossovers
  const horizWireSegments: { y: number; minX: number; maxX: number; isSameNetTerminal: boolean }[] = [];
  const vertWireSegments: { x: number; minY: number; maxY: number; isSameNetTerminal: boolean }[] = [];
  for (const wire of existingWires) {
    if (wire.id === ignoreWireId) continue;

    const sharesStartPin = Boolean(
      startPin &&
        ((wire.fromCompId === startPin.compId && wire.fromPinId.toLowerCase() === startPin.pinId.toLowerCase()) ||
          (wire.toCompId === startPin.compId && wire.toPinId.toLowerCase() === startPin.pinId.toLowerCase()))
    );
    const sharesEndPin = Boolean(
      endPin &&
        ((wire.fromCompId === endPin.compId && wire.fromPinId.toLowerCase() === endPin.pinId.toLowerCase()) ||
          (wire.toCompId === endPin.compId && wire.toPinId.toLowerCase() === endPin.pinId.toLowerCase()))
    );
    const isSameNetTerminal = sharesStartPin || sharesEndPin;

    const fromComp = components.find((c) => c.id === wire.fromCompId);
    const toComp = components.find((c) => c.id === wire.toCompId);
    let pts: Point[] = [];
    if (fromComp && toComp) {
      const p1 = getPinAbsolutePosition(fromComp, wire.fromPinId);
      const p2 = getPinAbsolutePosition(toComp, wire.toPinId);
      if (wire.waypoints && wire.waypoints.length > 0) {
        pts = [p1, ...wire.waypoints, p2];
      } else {
        pts = simplifyOrthogonalPoints(getManhattanSegment(p1, p2));
      }
    } else if (wire.waypoints && wire.waypoints.length >= 2) {
      pts = wire.waypoints;
    }

    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      if (p1.y === p2.y) {
        horizWireSegments.push({
          y: p1.y,
          minX: Math.min(p1.x, p2.x),
          maxX: Math.max(p1.x, p2.x),
          isSameNetTerminal,
        });
      } else if (p1.x === p2.x) {
        vertWireSegments.push({
          x: p1.x,
          minY: Math.min(p1.y, p2.y),
          maxY: Math.max(p1.y, p2.y),
          isSameNetTerminal,
        });
      }
    }
  }

  // 4. Pin Outward Stubs: Step 1 grid unit away from component center
  const getPinStub = (pinPt: Point, pinMeta: { compId: string; pinId: string } | null): Point => {
    if (!pinMeta) return { ...pinPt };
    const comp = components.find((c) => c.id === pinMeta.compId);
    if (!comp) return { ...pinPt };
    const def = ComponentRegistry.getComponentDefinition(comp.type) || COMPONENT_DEFINITIONS[comp.type];
    const width = def ? def.width : 60;
    const height = def ? def.height : 60;
    const bbox = getRotatedBoundingBox(width, height, comp.rotation || 0);
    const cx = comp.x + bbox.minX + bbox.width / 2;
    const cy = comp.y + bbox.minY + bbox.height / 2;

    const diffX = pinPt.x - cx;
    const diffY = pinPt.y - cy;
    if (Math.abs(diffX) > Math.abs(diffY)) {
      return { x: pinPt.x + (diffX > 0 ? step : -step), y: pinPt.y };
    } else if (Math.abs(diffY) > 0) {
      return { x: pinPt.x, y: pinPt.y + (diffY > 0 ? step : -step) };
    }
    return { ...pinPt };
  };

  const startStub = getPinStub({ x: startX, y: startY }, startPin);
  const endStub = getPinStub({ x: endX, y: endY }, endPin);

  // 5. Collision helpers for Candidate Fast-Paths
  const doesSegHitObstacle = (p1: Point, p2: Point): boolean => {
    if (p1.y === p2.y) {
      const y = p1.y;
      const minX = Math.min(p1.x, p2.x);
      const maxX = Math.max(p1.x, p2.x);
      for (const b of obstacleBoxes) {
        if (y >= b.minY && y <= b.maxY && maxX > b.minX && minX < b.maxX) {
          return true;
        }
      }
    } else if (p1.x === p2.x) {
      const x = p1.x;
      const minY = Math.min(p1.y, p2.y);
      const maxY = Math.max(p1.y, p2.y);
      for (const b of obstacleBoxes) {
        if (x >= b.minX && x <= b.maxX && maxY > b.minY && minY < b.maxY) {
          return true;
        }
      }
    }
    return false;
  };

  const doesSegHitUnrelatedPins = (p1: Point, p2: Point): boolean => {
    if (p1.y === p2.y) {
      const y = p1.y;
      const minX = Math.min(p1.x, p2.x);
      const maxX = Math.max(p1.x, p2.x);
      for (let x = minX; x <= maxX; x += step) {
        if ((x === startX && y === startY) || (x === endX && y === endY)) continue;
        if (unrelatedPins.has(`${x},${y}`)) return true;
      }
    } else if (p1.x === p2.x) {
      const x = p1.x;
      const minY = Math.min(p1.y, p2.y);
      const maxY = Math.max(p1.y, p2.y);
      for (let y = minY; y <= maxY; y += step) {
        if ((x === startX && y === startY) || (x === endX && y === endY)) continue;
        if (unrelatedPins.has(`${x},${y}`)) return true;
      }
    }
    return false;
  };

  const doesSegOverlapUnrelatedWire = (p1: Point, p2: Point): boolean => {
    if (p1.y === p2.y) {
      const y = p1.y;
      const minX = Math.min(p1.x, p2.x);
      const maxX = Math.max(p1.x, p2.x);
      for (const hw of horizWireSegments) {
        if (!hw.isSameNetTerminal && hw.y === y && Math.max(minX, hw.minX) < Math.min(maxX, hw.maxX)) {
          return true;
        }
      }
    } else if (p1.x === p2.x) {
      const x = p1.x;
      const minY = Math.min(p1.y, p2.y);
      const maxY = Math.max(p1.y, p2.y);
      for (const vw of vertWireSegments) {
        if (!vw.isSameNetTerminal && vw.x === x && Math.max(minY, vw.minY) < Math.min(maxY, vw.maxY)) {
          return true;
        }
      }
    }
    return false;
  };

  const isCandidateClean = (path: Point[]): boolean => {
    for (let i = 0; i < path.length - 1; i++) {
      const p1 = path[i];
      const p2 = path[i + 1];
      if (doesSegHitObstacle(p1, p2)) return false;
      if (doesSegHitUnrelatedPins(p1, p2)) return false;
      if (doesSegOverlapUnrelatedWire(p1, p2)) return false;
    }
    return true;
  };

  // 6. Direct L-Shape / Z-Shape Fast-Path Check
  const candidatePaths: Point[][] = [];

  // Straight line (0 bends)
  if (startX === endX || startY === endY) {
    candidatePaths.push([
      { x: startX, y: startY },
      { x: endX, y: endY },
    ]);
  }

  // 1-Bend L-Paths
  candidatePaths.push([
    { x: startX, y: startY },
    { x: endX, y: startY },
    { x: endX, y: endY },
  ]);
  candidatePaths.push([
    { x: startX, y: startY },
    { x: startX, y: endY },
    { x: endX, y: endY },
  ]);

  // 2-Bend Z-Paths (Midpoint Corridors)
  const midX = snapToGrid((startX + endX) / 2, step);
  candidatePaths.push([
    { x: startX, y: startY },
    { x: midX, y: startY },
    { x: midX, y: endY },
    { x: endX, y: endY },
  ]);
  const midY = snapToGrid((startY + endY) / 2, step);
  candidatePaths.push([
    { x: startX, y: startY },
    { x: startX, y: midY },
    { x: endX, y: midY },
    { x: endX, y: endY },
  ]);

  // Stub-Assisted Fast Paths
  if (startStub.x !== startX || startStub.y !== startY || endStub.x !== endX || endStub.y !== endY) {
    candidatePaths.push([
      { x: startX, y: startY },
      startStub,
      { x: endX, y: startStub.y },
      { x: endX, y: endY },
    ]);
    candidatePaths.push([
      { x: startX, y: startY },
      startStub,
      { x: startStub.x, y: endY },
      { x: endX, y: endY },
    ]);
    candidatePaths.push([
      { x: startX, y: startY },
      { x: startX, y: endStub.y },
      endStub,
      { x: endX, y: endY },
    ]);
    candidatePaths.push([
      { x: startX, y: startY },
      { x: endStub.x, y: startY },
      endStub,
      { x: endX, y: endY },
    ]);
    candidatePaths.push([
      { x: startX, y: startY },
      startStub,
      { x: startStub.x, y: endStub.y },
      endStub,
      { x: endX, y: endY },
    ]);
    candidatePaths.push([
      { x: startX, y: startY },
      startStub,
      { x: endStub.x, y: startStub.y },
      endStub,
      { x: endX, y: endY },
    ]);
    const stubMidX = snapToGrid((startStub.x + endStub.x) / 2, step);
    candidatePaths.push([
      { x: startX, y: startY },
      startStub,
      { x: stubMidX, y: startStub.y },
      { x: stubMidX, y: endStub.y },
      endStub,
      { x: endX, y: endY },
    ]);
    const stubMidY = snapToGrid((startStub.y + endStub.y) / 2, step);
    candidatePaths.push([
      { x: startX, y: startY },
      startStub,
      { x: startStub.x, y: stubMidY },
      { x: endStub.x, y: stubMidY },
      endStub,
      { x: endX, y: endY },
    ]);
  }

  // Find shortest clean fast-path candidate
  let bestCandidate: Point[] | null = null;
  let bestCandidateCost = Infinity;

  for (const rawCandidate of candidatePaths) {
    const candidate = simplifyOrthogonalPoints(rawCandidate);
    if (!isCandidateClean(candidate)) continue;

    let length = 0;
    const bends = candidate.length > 2 ? candidate.length - 2 : 0;
    for (let i = 0; i < candidate.length - 1; i++) {
      length += Math.abs(candidate[i + 1].x - candidate[i].x) + Math.abs(candidate[i + 1].y - candidate[i].y);
    }
    const cost = length + bends * 35;
    if (cost < bestCandidateCost) {
      bestCandidateCost = cost;
      bestCandidate = candidate;
    }
  }

  if (bestCandidate) {
    return bestCandidate;
  }

  // Helper to check if a point is an impassable obstacle in A* search
  const isObstacle = (x: number, y: number): boolean => {
    // Exact start and end pins are never blocked
    if ((x === startX && y === startY) || (x === endX && y === endY)) return false;

    // Unrelated pins are always strictly impassable
    if (unrelatedPins.has(`${x},${y}`)) return true;

    // Check inner component obstacle boxes
    for (const b of obstacleBoxes) {
      if (x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY) {
        return true;
      }
    }
    return false;
  };

  // Helper to compute segment penalty
  const getSegmentPenalty = (p1: Point, p2: Point, dir: 'H' | 'V'): number => {
    let penalty = 0;
    const isNearStart =
      Math.hypot(p1.x - startX, p1.y - startY) <= step * 3 ||
      Math.hypot(p2.x - startX, p2.y - startY) <= step * 3;
    const isNearEnd =
      Math.hypot(p1.x - endX, p1.y - endY) <= step * 3 ||
      Math.hypot(p2.x - endX, p2.y - endY) <= step * 3;

    if (dir === 'H') {
      const y = p1.y;
      const minX = Math.min(p1.x, p2.x);
      const maxX = Math.max(p1.x, p2.x);
      // Collinear check
      for (const hw of horizWireSegments) {
        if (hw.y === y && !(maxX < hw.minX || minX > hw.maxX)) {
          if (hw.isSameNetTerminal && (isNearStart || isNearEnd)) {
            // Wires sharing the same start or target pin exit cleanly without detour
            continue;
          }
          penalty += 500; // Collinear overlap penalty with unrelated wire
        }
      }
      // Perpendicular crossing check
      for (const vw of vertWireSegments) {
        if (vw.x >= minX && vw.x <= maxX && vw.minY <= y && vw.maxY >= y) {
          penalty += 5; // Perpendicular crossing is fine
        }
      }
    } else {
      const x = p1.x;
      const minY = Math.min(p1.y, p2.y);
      const maxY = Math.max(p1.y, p2.y);
      // Collinear check
      for (const vw of vertWireSegments) {
        if (vw.x === x && !(maxY < vw.minY || minY > vw.maxY)) {
          if (vw.isSameNetTerminal && (isNearStart || isNearEnd)) {
            // Wires sharing the same start or target pin exit cleanly without detour
            continue;
          }
          penalty += 500; // Collinear overlap penalty with unrelated wire
        }
      }
      // Perpendicular crossing check
      for (const hw of horizWireSegments) {
        if (hw.y >= minY && hw.y <= maxY && hw.minX <= x && hw.maxX >= x) {
          penalty += 5;
        }
      }
    }
    return penalty;
  };

  // Manhattan heuristic
  const heuristic = (x: number, y: number) => Math.abs(x - endX) + Math.abs(y - endY);

  // Search bounds
  const margin = 160;
  const boundMinX = Math.min(startX, endX) - margin;
  const boundMaxX = Math.max(startX, endX) + margin;
  const boundMinY = Math.min(startY, endY) - margin;
  const boundMaxY = Math.max(startY, endY) + margin;

  // A* Open and Closed lists
  const openList: AStarNode[] = [];
  const closedSet = new Set<string>();

  const startNode: AStarNode = {
    x: startX,
    y: startY,
    dir: null,
    g: 0,
    f: heuristic(startX, startY),
    parent: null,
  };
  openList.push(startNode);

  const keyOf = (x: number, y: number, dir: string | null) => `${x},${y},${dir ?? 'N'}`;

  let bestGoalNode: AStarNode | null = null;
  let iterations = 0;
  const maxIterations = 2500;

  while (openList.length > 0 && iterations < maxIterations) {
    iterations++;

    // Pick node with lowest f
    let bestIdx = 0;
    for (let i = 1; i < openList.length; i++) {
      if (openList[i].f < openList[bestIdx].f) {
        bestIdx = i;
      }
    }
    const current = openList.splice(bestIdx, 1)[0];

    if (current.x === endX && current.y === endY) {
      bestGoalNode = current;
      break;
    }

    const stateKey = keyOf(current.x, current.y, current.dir);
    if (closedSet.has(stateKey)) continue;
    closedSet.add(stateKey);

    // Neighbors (4 orthogonal directions, step 10px or 20px)
    const dirs: Array<{ dx: number; dy: number; dir: 'H' | 'V' }> = [
      { dx: step, dy: 0, dir: 'H' },
      { dx: -step, dy: 0, dir: 'H' },
      { dx: 0, dy: step, dir: 'V' },
      { dx: 0, dy: -step, dir: 'V' },
    ];

    for (const d of dirs) {
      const nx = current.x + d.dx;
      const ny = current.y + d.dy;

      // Check bounds
      if (nx < boundMinX || nx > boundMaxX || ny < boundMinY || ny > boundMaxY) continue;

      const neighborKey = keyOf(nx, ny, d.dir);
      if (closedSet.has(neighborKey)) continue;

      // Obstacle check: component bodies and unrelated pins are strictly impassable
      if (isObstacle(nx, ny)) {
        continue;
      }

      // Turn penalty
      let turnPenalty = 0;
      if (current.dir !== null && current.dir !== d.dir) {
        turnPenalty = 35;
      }

      // Wire overlap penalty
      const wirePenalty = getSegmentPenalty(
        { x: current.x, y: current.y },
        { x: nx, y: ny },
        d.dir
      );

      const stepCost = step + turnPenalty + wirePenalty;
      const tentativeG = current.g + stepCost;

      // Check if already in openList with better g
      const existingOpen = openList.find(
        (n) => n.x === nx && n.y === ny && n.dir === d.dir
      );
      if (existingOpen && existingOpen.g <= tentativeG) {
        continue;
      }

      const neighborNode: AStarNode = {
        x: nx,
        y: ny,
        dir: d.dir,
        g: tentativeG,
        f: tentativeG + heuristic(nx, ny),
        parent: current,
      };

      if (existingOpen) {
        existingOpen.g = tentativeG;
        existingOpen.f = neighborNode.f;
        existingOpen.parent = current;
      } else {
        openList.push(neighborNode);
      }
    }
  }

  if (bestGoalNode) {
    const rawPath: Point[] = [];
    let curr: AStarNode | null = bestGoalNode;
    while (curr) {
      rawPath.push({ x: curr.x, y: curr.y });
      curr = curr.parent;
    }
    rawPath.reverse();
    rawPath[0] = { x: start.x, y: start.y };
    rawPath[rawPath.length - 1] = { x: end.x, y: end.y };
    return simplifyOrthogonalPoints(rawPath);
  }

  // Fallback to simple Manhattan
  return simplifyOrthogonalPoints(getManhattanSegment(start, end));
}

/**
 * Sequentially routes all wires using the Smart A* Obstacle-Avoiding Router,
 * treating components and previously routed wires as obstacles.
 */
export function autoRouteAllWires(
  components: CircuitComponent[],
  wires: CircuitWire[]
): CircuitWire[] {
  const routedWires: CircuitWire[] = [];

  for (const wire of wires) {
    const fromComp = components.find((c) => c.id === wire.fromCompId);
    const toComp = components.find((c) => c.id === wire.toCompId);

    if (!fromComp || !toComp) {
      routedWires.push(wire);
      continue;
    }

    const start = getPinAbsolutePosition(fromComp, wire.fromPinId);
    const end = getPinAbsolutePosition(toComp, wire.toPinId);

    const fullPath = routeSmartWireAStar(start, end, components, routedWires, wire.id);
    const simplified = simplifyOrthogonalPoints(fullPath);
    const waypoints = simplified.slice(1, -1);

    routedWires.push({
      ...wire,
      waypoints,
    });
  }

  return routedWires;
}
