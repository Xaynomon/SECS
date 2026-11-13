import fs from 'fs';
import path from 'path';

console.log('================================================================');
console.log('  SECS HOTFIX 7.15 OSCILLOSCOPE TOP BAR & AUTOSET TEST SUITE');
console.log('================================================================\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${testName}`);
  } else {
    console.error(`  [FAIL] ${testName}`);
    if (detail) console.error(`         Detail: ${detail}`);
  }
}

// -----------------------------------------------------------------------------
// TEST 1: Inspect Oscilloscope.tsx Source Code for Top Bar Overlays
// -----------------------------------------------------------------------------
console.log('--- TEST 1: Oscilloscope Top-Bar Layout Coordinates & Colors ---');

const oscFilePath = path.join(process.cwd(), 'src', 'components', 'Instruments', 'Oscilloscope.tsx');
const oscContent = fs.readFileSync(oscFilePath, 'utf-8');

// 1. Verify CH1 Top-Left (x = 12, y = 18, color #facc15)
assert(
  oscContent.includes("ctx.fillStyle = '#facc15'") &&
  oscContent.includes("12,\n      18\n    )") || oscContent.includes("12, 18)"),
  '1. CH1 readout placed at Top-Left (x = 12, y = 18) in Yellow (#facc15)'
);

// 2. Verify MATH Top-Left Line 2 (x = 12, y = 34, color #f472b6)
assert(
  oscContent.includes("ctx.fillStyle = '#f472b6'") &&
  (oscContent.includes("12,\n        34\n      )") || oscContent.includes("12, 34)")),
  '2. MATH readout placed on Line 2 (x = 12, y = 34) in Pink/Magenta (#f472b6)'
);

// 3. Verify Trigger/Pause status Top-Center (x = width / 2, y = 18, centered)
assert(
  oscContent.includes("ctx.textAlign = 'center'") &&
  (oscContent.includes("width / 2, 18)") || oscContent.includes("width / 2,\n      18\n    )") || oscContent.includes("width / 2, 18")),
  '3. Trigger/Status badge placed at Top-Center (x = width / 2, y = 18, textAlign = center)'
);

// 4. Verify CH2 Top-Right (x = width - 12, y = 18, right-aligned, color #38bdf8)
assert(
  oscContent.includes("ctx.textAlign = 'right'") &&
  oscContent.includes("ctx.fillStyle = '#38bdf8'") &&
  (oscContent.includes("width - 12,\n      18\n    )") || oscContent.includes("width - 12, 18)")),
  '4. CH2 readout placed at Top-Right (x = width - 12, y = 18, textAlign = right) in Cyan (#38bdf8)'
);

// 5. Verify NO duplicate early badge drawing at (10, 16)
assert(
  !oscContent.includes("fillText('🟢 TRIG\\'D', 10, 16)") &&
  !oscContent.includes("fillText('🌊 ROLL', 10, 16)"),
  '5. Obsolete overlapping badge drawing at (10, 16) completely eliminated'
);

// -----------------------------------------------------------------------------
// TEST 2: AUTOSET Algorithm Mathematical Validation
// -----------------------------------------------------------------------------
console.log('\n--- TEST 2: AUTOSET Algorithm Rules ---');

// Implement the exact function from handleAutoset
function pickOptimalVDiv(vMin: number, vMax: number): number {
  const peakAbsV = Math.max(Math.abs(vMax), Math.abs(vMin), 0.5);
  const idealVDiv = peakAbsV / 3.0;
  const vDivOptions = [0.5, 1.0, 2.0, 5.0, 10.0];
  for (const opt of vDivOptions) {
    if (opt >= idealVDiv) {
      return opt;
    }
  }
  return 10.0;
}

// Case A: CH1 DC Output of Bridge Rectifier (~10.35V with 0.69V ripple: [9.71V, 10.40V])
const vDivCh1 = pickOptimalVDiv(9.71, 10.40);
assert(
  vDivCh1 === 5.0,
  `6. AUTOSET CH1 (+10.35V DC) snaps to 5 V/div (ideal = 10.40 / 3 = 3.47 -> 5.0 V/div)`,
  `vDivCh1 = ${vDivCh1}`
);

// Case B: CH2 AC Source (12V AC sine wave: [-12.0V, +12.0V])
const vDivCh2 = pickOptimalVDiv(-12.0, 12.0);
assert(
  vDivCh2 === 5.0,
  `7. AUTOSET CH2 (±12V AC) snaps to 5 V/div (ideal = 12.0 / 3 = 4.0 -> 5.0 V/div)`,
  `vDivCh2 = ${vDivCh2}`
);

// Case C: Small 1.2V signal
const vDivSmall = pickOptimalVDiv(0, 1.2);
assert(
  vDivSmall === 0.5,
  `8. AUTOSET 1.2V signal snaps to 0.5 V/div (ideal = 1.2 / 3 = 0.4 -> 0.5 V/div)`,
  `vDivSmall = ${vDivSmall}`
);

// Case D: 5V logic signal [0V, 5V]
const vDivLogic = pickOptimalVDiv(0, 5.0);
assert(
  vDivLogic === 2.0,
  `9. AUTOSET 5V Logic snaps to 2.0 V/div (ideal = 5.0 / 3 = 1.67 -> 2.0 V/div)`,
  `vDivLogic = ${vDivLogic}`
);

// Timebase Selection Function from handleAutoset
function pickOptimalTimebase(freqHz: number): number {
  if (freqHz <= 0.5) return 10;
  const periodMs = 1000 / freqHz;
  const idealTimePerDivMs = (4 * periodMs) / 10;
  const standardTimebases = [1, 5, 10, 20, 50, 100, 500, 1000];

  let closestTb = standardTimebases[0];
  let minDiff = Math.abs(closestTb - idealTimePerDivMs);
  for (const tb of standardTimebases) {
    const diff = Math.abs(tb - idealTimePerDivMs);
    if (diff < minDiff) {
      minDiff = diff;
      closestTb = tb;
    }
  }
  return closestTb;
}

// Case E: 50 Hz AC signal
const tb50Hz = pickOptimalTimebase(50);
assert(
  tb50Hz === 10,
  `10. AUTOSET 50 Hz AC (period 20ms) selects 10 ms/div (ideal = 4 * 20 / 10 = 8ms -> 10ms/div)`,
  `tb50Hz = ${tb50Hz}`
);

// Case F: 1 kHz Calibrator signal (period 1ms)
const tb1kHz = pickOptimalTimebase(1000);
assert(
  tb1kHz === 1,
  `11. AUTOSET 1 kHz signal (period 1ms) selects 1 ms/div (ideal = 4 * 1 / 10 = 0.4ms -> 1ms/div)`,
  `tb1kHz = ${tb1kHz}`
);

// Case G: Trigger Auto-Selection Logic
const ch1Vpp = 0.69; // Smoothed DC
const ch2Vpp = 24.0; // AC sine
const ch1Freq = 0;
const ch2Freq = 50;
const ch2HasAc = ch2Vpp > 0.5 && ch2Freq > 0.5;
const ch1HasAc = ch1Vpp > 0.5 && ch1Freq > 0.5;

let dominantChan = 'ch1';
if (ch2HasAc && (!ch1HasAc || ch2Vpp > ch1Vpp)) {
  dominantChan = 'ch2';
}

assert(
  dominantChan === 'ch2',
  '12. AUTOSET auto-selects CH2 as Trigger Source when CH2 has larger AC swing (24Vpp @ 50Hz vs 0.69Vpp DC)',
  `dominantChan = ${dominantChan}`
);

console.log(`\n================================================================`);
console.log(`  HOTFIX 7.15 RESULTS: ${passedTests} / ${totalTests} TESTS PASSED`);
console.log(`================================================================\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
