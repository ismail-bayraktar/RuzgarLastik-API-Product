
export const parserTestCases = [
  // --- TIRE (Lastik) ---
  {
    input: "205/55 R16 91V Lassa Greenways",
    expectedCategory: "tire",
    expected: { width: 205, aspectRatio: 55, rimDiameter: 16, loadIndex: 91, speedIndex: "V" }
  },
  {
    input: "Michelin 205 55 16 91H Primacy 4", // Space separator
    expectedCategory: "tire",
    expected: { width: 205, aspectRatio: 55, rimDiameter: 16, loadIndex: 91, speedIndex: "H" }
  },
  {
    input: "Goodyear 225/45R17 94W XL Eagle F1", // XL marking
    expectedCategory: "tire",
    expected: { width: 225, aspectRatio: 45, rimDiameter: 17, loadIndex: 94, speedIndex: "W" }
  },
  {
    input: "195/65R15 91T (Yaz Lastiği)", // Extra text
    expectedCategory: "tire",
    expected: { width: 195, aspectRatio: 65, rimDiameter: 15, loadIndex: 91, speedIndex: "T" }
  },

  // --- RIM (Jant) ---
  {
    input: "Alant 17 inç 5x112 ET45 Jant", // Standard
    expectedCategory: "rim",
    expected: { diameter: 17, pcd: "5x112", offset: 45 }
  },
  {
    input: "CMS 8.5Jx19 5x120 ET35", // J notation
    expectedCategory: "rim",
    expected: { width: 8.5, diameter: 19, pcd: "5x120", offset: 35 }
  },
  {
    input: "Çelik Jant 16x7 4x100 ET 40", // x notation
    expectedCategory: "rim",
    expected: { width: 7, diameter: 16, pcd: "4x100", offset: 40 }
  },

  // --- BATTERY (Akü) ---
  {
    input: "Varta 12V 60Ah 540A Blue Dynamic", // Standard
    expectedCategory: "battery",
    expected: { voltage: 12, capacity: 60, cca: 540 }
  },
  {
    input: "Mutlu Akü 12V 72 Ah (Alçak) 640 A", // Spaced units
    expectedCategory: "battery",
    expected: { voltage: 12, capacity: 72, cca: 640 }
  },
  {
    input: "Yiğit Akü 100AH 850A 12V", // Uppercase
    expectedCategory: "battery",
    expected: { voltage: 12, capacity: 100, cca: 850 }
  }
];
