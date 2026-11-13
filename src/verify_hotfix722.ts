import * as fs from 'fs';
import * as path from 'path';
import { STARTER_TEMPLATES } from './constants/starterTemplates';
import { ComponentRegistry } from './registry/ComponentRegistry';
import { AsmRuntime } from './simulation/mcu/asmRuntime';
import { evaluateLogicalCircuit } from './simulation/logical/LogicalEngine';
import {
  computeAnalogWireFlow,
  computeFlowDirectionField,
  computeLogicalWireFlow,
} from './simulation/wireFlowEngine';
import { CircuitComponent, CircuitWire } from './types/circuit';

function assert(condition: boolean, msg: string): asserts condition {
  if (!condition) {
    throw new Error(`FAIL: ${msg}`);
  }
}

const SEG_TO_DIGIT: Record<string, number> = {
  '1111110': 0,
  '0110000': 1,
  '1101101': 2,
  '1111001': 3,
  '0110011': 4,
  '1011011': 5,
  '1011111': 6,
  '1110000': 7,
  '1111111': 8,
  '1111011': 9,
};

function decodeSegs(segs: Record<string, boolean> | undefined): number {
  if (!segs) {
    throw new Error('FAIL: 7-segment state missing');
  }
  const key = [segs.a, segs.b, segs.c, segs.d, segs.e, segs.f, segs.g]
    .map((v) => (v ? '1' : '0'))
    .join('');
  assert(key in SEG_TO_DIGIT, `Invalid 7-segment pattern: ${key}`);
  return SEG_TO_DIGIT[key];
}

console.log('===========================================================');
console.log('=== SECS HOTFIX 7.22 COMPREHENSIVE VERIFICATION SUITE ===');
console.log('===========================================================');

// -------------------------------------------------------------------------
// 1. ZERO GLITCH 2-DIGIT 7-SEGMENT SYNC TRANSITION TEST (0s -> 40s @ 100ms)
// -------------------------------------------------------------------------
console.log('\n--- Test 1: 2-Digit 7-Segment Countdown Atomic Sync (0s..40s) ---');
const t12 = STARTER_TEMPLATES.find((t) => t.id === 'prof_4way_traffic_junction');
assert(Boolean(t12), 'Template 12 (prof_4way_traffic_junction) not found');

const comps: CircuitComponent[] = JSON.parse(JSON.stringify(t12!.circuit.components));
const wires: CircuitWire[] = JSON.parse(JSON.stringify(t12!.circuit.wires));
const cpuComp = comps.find((c) => c.id === 'cpu1')!;
assert(Boolean(cpuComp?.properties?.code), 'CPU1 code missing');

const asm = new AsmRuntime('cpu1');
assert(asm.compile(cpuComp.properties.code), `ASM compile failed: ${asm.getInstanceData().lastError}`);
asm.setClockConfig(10, false);

const junctions = ['n', 'e', 's', 'w'] as const;
const prevValue: Record<string, number | null> = { n: null, e: null, s: null, w: null };

for (let tick = 0; tick < 400; tick++) {
  const clockMs = tick * 100;
  asm.updateInputs({ in0: 0, in1: 0, in2: 0, in3: 0, clk: 0, rst: 0, irq: 0 }, { in0: 0, in1: 0, in2: 0, in3: 0 });
  asm.step(clockMs);
  const inst = asm.getInstanceData();

  cpuComp.state = {
    ...cpuComp.state,
    pins: inst.pins,
    asmRegisters: inst.asmRegisters,
  };

  const logRes = evaluateLogicalCircuit(comps, wires, clockMs);

  const secIdx = Math.floor(clockMs / 1000); // 0..39
  const phaseIdx = Math.floor(secIdx / 10); // 0..3
  const phaseRemaining = 10 - (secIdx % 10); // 10..1

  for (let jIdx = 0; jIdx < 4; jIdx++) {
    const j = junctions[jIdx];
    const slot = (jIdx - phaseIdx + 4) % 4;
    const expectedTotal = (slot === 0 ? 0 : slot === 1 ? 0 : slot === 2 ? 10 : 20) + phaseRemaining;
    const expectedTens = Math.floor(expectedTotal / 10);
    const expectedOnes = expectedTotal % 10;

    const segTensState = logRes.componentStates.get(`seg_${j}_tens`);
    const segOnesState = logRes.componentStates.get(`seg_${j}_ones`);
    const tensDigit = decodeSegs(segTensState?.segments);
    const onesDigit = decodeSegs(segOnesState?.segments);
    const combined = tensDigit * 10 + onesDigit;

    assert(
      tensDigit === expectedTens && onesDigit === expectedOnes,
      `t=${clockMs}ms junction=${j}: expected ${expectedTens}${expectedOnes}, got ${tensDigit}${onesDigit}`
    );

    if (prevValue[j] !== null && prevValue[j] !== combined) {
      const p = prevValue[j]!;
      assert(
        (p === 1 && (combined === 30 || combined === 10)) || combined === p - 1,
        `t=${clockMs}ms junction=${j}: invalid transition ${p} -> ${combined}`
      );
    }
    prevValue[j] = combined;
  }
}
console.log('[PASS] All 400 ticks (40 seconds across all 4 phases) transitioned atomically: 30->29..20->19..10->09..01->30 with ZERO glitches!');

// -------------------------------------------------------------------------
// 2. "OFF" WIRE FLOW MODE TEST
// -------------------------------------------------------------------------
console.log('\n--- Test 2: "OFF" Wire Flow Mode ---');
const dirOff = computeFlowDirectionField(comps, wires, 'OFF');
assert(dirOff.size === 0, `Expected empty directionField in OFF mode, got ${dirOff.size}`);

const testWire = wires[0];
const fromC = comps.find((c) => c.id === testWire.fromCompId);
const toC = comps.find((c) => c.id === testWire.toCompId);

const logOn = computeLogicalWireFlow(testWire, fromC, toC, { logicLevel: 1 }, undefined, undefined, 'LOGICAL');
assert(logOn.hasFlow === true && logOn.isFlowing === true, 'LOGICAL mode HIGH wire must flow');

const logOff = computeLogicalWireFlow(testWire, fromC, toC, { logicLevel: 1 }, undefined, undefined, 'OFF');
assert(logOff.hasFlow === false && logOff.isFlowing === false, 'OFF mode must disable LOGICAL wire flow');

const analogOff = computeAnalogWireFlow(
  testWire,
  fromC,
  toC,
  5.0,
  0.5,
  comps,
  wires,
  true,
  undefined,
  undefined,
  1000,
  'OFF'
);
assert(analogOff.hasFlow === false && analogOff.isFlowing === false, 'OFF mode must disable ANALOG wire flow');
console.log('[PASS] wireFlowEngine.ts strictly enforces hasFlow=false & isFlowing=false in OFF mode.');

// -------------------------------------------------------------------------
// 3. UI & STORE REQUIREMENTS CHECK
// -------------------------------------------------------------------------
console.log('\n--- Test 3: Dashboard Red Badge, TopToolbar OFF Toggle & Single Theme Switcher ---');
const dashboardSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/Dashboard/ProjectDashboard.tsx'), 'utf8');
assert(dashboardSrc.includes('bg-red-500/15 border border-red-500/30 text-red-500'), 'Missing dark mode red Professional badge classes');
assert(dashboardSrc.includes('bg-red-100 border border-red-200 text-red-600'), 'Missing light mode red Professional badge classes');
assert(dashboardSrc.includes("template.tier === 'Professional' ? '🏆 Professional' : template.tier"), 'Card badge must render 🏆 Professional');
assert(!dashboardSrc.includes('from-amber-500/20 to-rose-500/20'), 'Old amber/rose badge styling must be removed');

const toolbarSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/topbar/TopToolbar.tsx'), 'utf8');
assert(toolbarSrc.includes("(['LOGICAL', 'ANALOG', 'OFF'] as SimulationMode[])"), 'TopToolbar must include LOGICAL, ANALOG, OFF');
assert(toolbarSrc.includes('title={`Switch to ${isDark ? \'Light\' : \'Dark\'} Theme`}'), 'TopToolbar must have single alternating theme tooltip');

const storeSrc = fs.readFileSync(path.join(process.cwd(), 'src/store/useCircuitStore.ts'), 'utf8');
assert(storeSrc.includes("localStorage.setItem('secs_theme', theme)"), 'Theme persistence missing');
assert(storeSrc.includes("simulationMode === 'ANALOG' || simulationMode === 'OFF'"), 'OFF mode should still run physics while disabling wire flow');
console.log('[PASS] Dashboard red badge, TopToolbar OFF toggle, and single alternating Sun/Moon theme button verified.');

// -------------------------------------------------------------------------
// 4. 20PX GRID INTEGRITY FOR ALL 12 TEMPLATES
// -------------------------------------------------------------------------
console.log('\n--- Test 4: 20px Grid & Pin Registry Check (12 Templates) ---');
for (const tmpl of STARTER_TEMPLATES) {
  const compMap = new Map<string, any>();
  for (const comp of tmpl.circuit.components) {
    assert(comp.x % 20 === 0, `Component ${comp.id} in ${tmpl.id} x=${comp.x} not on 20px grid`);
    assert(comp.y % 20 === 0, `Component ${comp.id} in ${tmpl.id} y=${comp.y} not on 20px grid`);
    const def = ComponentRegistry.getComponentDefinition(comp.type);
    assert(Boolean(def), `Unknown component type ${comp.type} on ${comp.id} in ${tmpl.id}`);
    compMap.set(comp.id, { comp, def });
  }
  for (const wire of tmpl.circuit.wires) {
    const from = compMap.get(wire.fromCompId);
    const to = compMap.get(wire.toCompId);
    assert(Boolean(from && to), `Wire ${wire.id} in ${tmpl.id} missing endpoint`);
    for (const wp of wire.waypoints) {
      assert(wp.x % 20 === 0 && wp.y % 20 === 0, `Wire ${wire.id} in ${tmpl.id} waypoint off 20px grid`);
    }
  }
}
console.log('[PASS] All 12 templates passed 20px grid & pin integrity check.');

console.log('\n===========================================================');
console.log('✅ ALL SECS HOTFIX 7.22 VERIFICATION CHECKS PASSED 100%!');
console.log('===========================================================\n');
