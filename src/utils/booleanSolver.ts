/**
 * SECS Boolean Solver & Karnaugh Map (K-Map) Engine
 * Implements Quine-McCluskey minimization, Gray-code ordering,
 * and Prime Implicant grouping for 2, 3, and 4 variables.
 */

export interface TruthTableRow {
  index: number;
  inputs: number[]; // e.g. [0, 1]
  output: 0 | 1 | 'X';
  observedCount?: number;
}

export interface PrimeImplicant {
  term: string; // e.g. "1-0" (- means don't-care / eliminated)
  minterms: number[];
  color: string;
}

export interface KMapCell {
  row: number;
  col: number;
  minterm: number;
  value: 0 | 1 | 'X';
  implicantColors: string[];
}

export interface KMapGrid {
  numInputs: 2 | 3 | 4;
  rowVars: string[];
  colVars: string[];
  rowHeaders: string[];
  colHeaders: string[];
  cells: KMapCell[][];
}

export interface BooleanSolverResult {
  sop: string;
  logicGates: string;
  primeImplicants: PrimeImplicant[];
  kmapGrid: KMapGrid;
}

// Gray code sequences
const GRAY_2 = ['0', '1'];
const GRAY_4 = ['00', '01', '11', '10'];

const IMPLICANT_PALETTE = [
  '#38bdf8', // Sky
  '#f43f5e', // Rose
  '#10b981', // Emerald
  '#a855f7', // Purple
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#84cc16', // Lime
];

/**
 * Solves a 2, 3, or 4 variable truth table into minimal Sum-of-Products (SOP)
 * and constructs the corresponding Gray-code ordered K-Map grid.
 */
export function solveBooleanFunction(
  truthTable: TruthTableRow[],
  variableNames: string[]
): BooleanSolverResult {
  const numVars = variableNames.length as 2 | 3 | 4;
  const numRows = 1 << numVars;

  // 1. Separate minterms (output 1) and don't-cares (output 'X')
  const minterms: number[] = [];
  const dontCares: number[] = [];
  const zeros: number[] = [];

  for (let i = 0; i < numRows; i++) {
    const row = truthTable.find((r) => r.index === i);
    const val = row ? row.output : 'X';
    if (val === 1) minterms.push(i);
    else if (val === 'X') dontCares.push(i);
    else zeros.push(i);
  }

  // Trivial cases
  if (minterms.length === 0) {
    const kmapGrid = buildKMapGrid(numVars, variableNames, truthTable, []);
    return {
      sop: 'Y = 0',
      logicGates: 'GND (0V)',
      primeImplicants: [],
      kmapGrid,
    };
  }

  if (minterms.length + dontCares.length === numRows && minterms.length > 0) {
    const kmapGrid = buildKMapGrid(numVars, variableNames, truthTable, []);
    return {
      sop: 'Y = 1',
      logicGates: 'VCC (5V)',
      primeImplicants: [],
      kmapGrid,
    };
  }

  // 2. Quine-McCluskey Implicant Generation
  interface Term {
    mask: string; // e.g. "01-1"
    minterms: number[];
    used: boolean;
  }

  // Initial terms from minterms + dontCares
  let currentTerms: Term[] = [...minterms, ...dontCares].map((m) => {
    const bin = m.toString(2).padStart(numVars, '0');
    return { mask: bin, minterms: [m], used: false };
  });

  const primeImplicantsRaw: Term[] = [];

  while (currentTerms.length > 0) {
    const nextTerms: Term[] = [];
    const combinedSet = new Set<string>();

    for (let i = 0; i < currentTerms.length; i++) {
      for (let j = i + 1; j < currentTerms.length; j++) {
        const t1 = currentTerms[i];
        const t2 = currentTerms[j];

        // Check if terms differ by exactly one non-hyphen bit
        let diffCount = 0;
        let diffIdx = -1;
        for (let b = 0; b < numVars; b++) {
          if (t1.mask[b] !== t2.mask[b]) {
            if (t1.mask[b] === '-' || t2.mask[b] === '-') {
              diffCount = 999;
              break;
            }
            diffCount++;
            diffIdx = b;
          }
        }

        if (diffCount === 1) {
          t1.used = true;
          t2.used = true;
          const newMask = t1.mask.substring(0, diffIdx) + '-' + t1.mask.substring(diffIdx + 1);
          if (!combinedSet.has(newMask)) {
            combinedSet.add(newMask);
            const combinedMinterms = Array.from(new Set([...t1.minterms, ...t2.minterms])).sort((a, b) => a - b);
            nextTerms.push({ mask: newMask, minterms: combinedMinterms, used: false });
          }
        }
      }
    }

    // Any term not used in a combination is a Prime Implicant
    for (const t of currentTerms) {
      if (!t.used && !primeImplicantsRaw.some((pi) => pi.mask === t.mask)) {
        // Only include if it covers at least one required minterm (not solely don't-cares)
        if (t.minterms.some((m) => minterms.includes(m))) {
          primeImplicantsRaw.push(t);
        }
      }
    }

    currentTerms = nextTerms;
  }

  // 3. Select Minimal Prime Implicant Cover (Greedy Set Cover / Essential PIs)
  const uncoveredMinterms = new Set<number>(minterms);
  const selectedPIs: Term[] = [];

  // Step 3a: Essential Prime Implicants
  for (const m of minterms) {
    const covering = primeImplicantsRaw.filter((pi) => pi.minterms.includes(m));
    if (covering.length === 1) {
      const epi = covering[0];
      if (!selectedPIs.includes(epi)) {
        selectedPIs.push(epi);
        for (const covered of epi.minterms) {
          uncoveredMinterms.delete(covered);
        }
      }
    }
  }

  // Step 3b: Greedy coverage for remaining minterms
  while (uncoveredMinterms.size > 0) {
    let bestPI: Term | null = null;
    let maxCover = -1;

    for (const pi of primeImplicantsRaw) {
      if (selectedPIs.includes(pi)) continue;
      let count = 0;
      for (const m of pi.minterms) {
        if (uncoveredMinterms.has(m)) count++;
      }
      if (count > maxCover) {
        maxCover = count;
        bestPI = pi;
      }
    }

    if (!bestPI || maxCover <= 0) break;
    selectedPIs.push(bestPI);
    for (const m of bestPI.minterms) {
      uncoveredMinterms.delete(m);
    }
  }

  // Assign distinct colors to Prime Implicants
  const primeImplicants: PrimeImplicant[] = selectedPIs.map((pi, idx) => ({
    term: pi.mask,
    minterms: pi.minterms,
    color: IMPLICANT_PALETTE[idx % IMPLICANT_PALETTE.length],
  }));

  // 4. Construct Boolean SOP String & Equivalent Logic Gates
  const productTerms: string[] = [];
  const gateTerms: string[] = [];

  for (const pi of selectedPIs) {
    const literals: string[] = [];
    const gateLiterals: string[] = [];

    for (let b = 0; b < numVars; b++) {
      const bit = pi.mask[b];
      const v = variableNames[b];
      if (bit === '1') {
        literals.push(v);
        gateLiterals.push(v);
      } else if (bit === '0') {
        literals.push(`${v}'`);
        gateLiterals.push(`NOT(${v})`);
      }
    }

    if (literals.length === 0) {
      productTerms.push('1');
      gateTerms.push('1');
    } else if (literals.length === 1) {
      productTerms.push(literals[0]);
      gateTerms.push(gateLiterals[0]);
    } else {
      productTerms.push(literals.join('·'));
      gateTerms.push(`AND(${gateLiterals.join(', ')})`);
    }
  }

  let sopString = `Y = ${productTerms.join(' + ')}`;
  let logicGates = gateTerms.length > 1 ? `OR(${gateTerms.join(', ')})` : gateTerms[0] || '0';

  // Recognized common patterns
  if (numVars === 2) {
    if (sopString === "Y = A'·B + A·B'" || sopString === "Y = A·B' + A'·B") {
      sopString = 'Y = A ⊕ B';
      logicGates = 'XOR(A, B)';
    } else if (sopString === "Y = A'·B' + A·B" || sopString === "Y = A·B + A'·B'") {
      sopString = 'Y = (A ⊕ B)\'';
      logicGates = 'XNOR(A, B)';
    }
  }

  // 5. Construct K-Map Grid
  const kmapGrid = buildKMapGrid(numVars, variableNames, truthTable, primeImplicants);

  return {
    sop: sopString,
    logicGates,
    primeImplicants,
    kmapGrid,
  };
}

/**
 * Builds the visual Gray-code ordered K-Map Grid with Prime Implicant color references.
 */
function buildKMapGrid(
  numVars: 2 | 3 | 4,
  variableNames: string[],
  truthTable: TruthTableRow[],
  primeImplicants: PrimeImplicant[]
): KMapGrid {
  let rowVars: string[] = [];
  let colVars: string[] = [];
  let rowHeaders: string[] = [];
  let colHeaders: string[] = [];

  if (numVars === 2) {
    rowVars = [variableNames[0]];
    colVars = [variableNames[1]];
    rowHeaders = GRAY_2;
    colHeaders = GRAY_2;
  } else if (numVars === 3) {
    rowVars = [variableNames[0]];
    colVars = [variableNames[1], variableNames[2]];
    rowHeaders = GRAY_2;
    colHeaders = GRAY_4;
  } else {
    rowVars = [variableNames[0], variableNames[1]];
    colVars = [variableNames[2], variableNames[3]];
    rowHeaders = GRAY_4;
    colHeaders = GRAY_4;
  }

  const cells: KMapCell[][] = [];

  for (let r = 0; r < rowHeaders.length; r++) {
    const rowCells: KMapCell[] = [];
    const rBits = rowHeaders[r];

    for (let c = 0; c < colHeaders.length; c++) {
      const cBits = colHeaders[c];
      const fullBin = rBits + cBits;
      const minterm = parseInt(fullBin, 2);

      const tableRow = truthTable.find((t) => t.index === minterm);
      const val = tableRow ? tableRow.output : 'X';

      // Find which Prime Implicants cover this cell
      const colors = primeImplicants
        .filter((pi) => pi.minterms.includes(minterm))
        .map((pi) => pi.color);

      rowCells.push({
        row: r,
        col: c,
        minterm,
        value: val,
        implicantColors: colors,
      });
    }
    cells.push(rowCells);
  }

  return {
    numInputs: numVars,
    rowVars,
    colVars,
    rowHeaders,
    colHeaders,
    cells,
  };
}
