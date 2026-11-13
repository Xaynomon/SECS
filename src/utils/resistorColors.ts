export interface ResistorColorBands {
  band1: string; // First digit
  band2: string; // Second digit
  multiplier: string; // Multiplier
  tolerance: string; // Tolerance
}

const DIGIT_COLORS: Record<number, string> = {
  0: '#1c1917', // Black
  1: '#78350f', // Brown
  2: '#dc2626', // Red
  3: '#ea580c', // Orange
  4: '#eab308', // Yellow
  5: '#16a34a', // Green
  6: '#2563eb', // Blue
  7: '#7c3aed', // Violet
  8: '#6b7280', // Gray
  9: '#f8fafc', // White
};

const MULTIPLIER_COLORS: Record<number, string> = {
  [-2]: '#cbd5e1', // Silver (x0.01)
  [-1]: '#d97706', // Gold (x0.1)
  0: '#1c1917', // Black (x1)
  1: '#78350f', // Brown (x10)
  2: '#dc2626', // Red (x100)
  3: '#ea580c', // Orange (x1k)
  4: '#eab308', // Yellow (x10k)
  5: '#16a34a', // Green (x100k)
  6: '#2563eb', // Blue (x1M)
  7: '#7c3aed', // Violet (x10M)
  8: '#6b7280', // Gray (x100M)
  9: '#f8fafc', // White (x1G)
};

const TOLERANCE_COLORS: Record<number, string> = {
  1: '#78350f', // Brown (±1%)
  2: '#dc2626', // Red (±2%)
  5: '#d97706', // Gold (±5%)
  10: '#cbd5e1', // Silver (±10%)
};

/**
 * Calculates the standard 4-band resistor color codes based on resistance value in Ohms.
 */
export function calculateResistorBands(
  resistance: number,
  tolerancePercent: number = 5
): ResistorColorBands {
  if (resistance <= 0 || isNaN(resistance)) {
    return {
      band1: '#78350f',
      band2: '#1c1917',
      multiplier: '#dc2626',
      tolerance: '#d97706',
    };
  }

  // Convert to scientific notation to get exponent
  const exponent = Math.floor(Math.log10(resistance));
  const mantissa = resistance / Math.pow(10, exponent);

  // Round mantissa to 2 significant digits
  const rounded2Digits = Math.round(mantissa * 10);
  let d1 = Math.floor(rounded2Digits / 10);
  let d2 = rounded2Digits % 10;
  let multiplierExp = exponent - 1;

  if (d1 >= 10) {
    d1 = 1;
    d2 = 0;
    multiplierExp += 1;
  }

  // Bound digits
  d1 = Math.max(1, Math.min(9, d1));
  d2 = Math.max(0, Math.min(9, d2));

  const band1 = DIGIT_COLORS[d1] || '#78350f';
  const band2 = DIGIT_COLORS[d2] || '#1c1917';
  const multiplier = MULTIPLIER_COLORS[multiplierExp] || '#dc2626';
  const tolerance = TOLERANCE_COLORS[tolerancePercent] || '#d97706';

  return { band1, band2, multiplier, tolerance };
}
