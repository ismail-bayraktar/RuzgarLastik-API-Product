
import { type MetafieldKey, METAFIELD_DEFINITIONS } from "./metafieldUtils";

export interface TireParseResult {
  width: number;
  aspectRatio: number;
  rimDiameter: number;
  loadIndex?: number;
  speedIndex?: string;
  season?: "yaz" | "kis" | "dort_mevsim";
}

export interface RimParseResult {
  width: number;
  diameter: number;
  pcd?: string;
  offset?: number;
}

export interface BatteryParseResult {
  capacity?: number;
  cca?: number;
  voltage?: number;
}

export interface ParsingFieldResult {
  field: string;
  value: any | null;
  success: boolean;
  reason?: string;
  confidence?: number;
}

export interface DetailedParseResult<T> {
  success: boolean;
  data: T | null;
  rawTitle: string;
  fields: ParsingFieldResult[];
}

export class TitleParserService {
  
  private static TIRE_BRANDS = ["michelin", "goodyear", "lassa", "bridgestone", "continental", "pirelli", "hankook", "nokian", "petlas", "falken", "dunlop", "kumho", "sava", "starmaxx"];
  
  detectCategory(title: string): "tire" | "rim" | "battery" | "unknown" {
    const lower = title.toLowerCase();
    
    // Battery
    if (/\d+\s*ah\b/.test(lower)) return "battery";
    if (/\d+\s*a\b/.test(lower) && !lower.includes("lastik")) return "battery";
    if (lower.includes("akü") || lower.includes("aku")) return "battery";

    // Rim
    if (lower.includes("jant") && !lower.includes("jant koruma")) return "rim";
    if (/5x\d{3}/.test(lower)) return "rim"; 
    if (/\d+j?x\d{2}/.test(lower)) return "rim"; 

    // Tire
    if (/\d{3}[\/\s]+\d{2}/.test(lower)) return "tire"; 
    if (TitleParserService.TIRE_BRANDS.some(b => lower.includes(b))) return "tire";
    if (lower.includes("lastik")) return "tire";

    return "unknown";
  }

  // Wrappers
  parseTireTitle(title: string) { return this.parseTire(title).data; }
  parseRimTitle(title: string) { return this.parseRim(title).data; }
  parseBatteryTitle(title: string) { return this.parseBattery(title).data; }

  private detectSeason(title: string): "yaz" | "kis" | "dort_mevsim" | undefined {
    const lower = title.toLowerCase();
    if (lower.includes("kış") || lower.includes("winter") || lower.includes("snow") || lower.includes("kar")) return "kis";
    if (lower.includes("4 mevsim") || lower.includes("dort") || lower.includes("all season") || lower.includes("cross") || lower.includes("vector")) return "dort_mevsim";
    if (lower.includes("yaz") || lower.includes("summer") || lower.includes("primacy") || lower.includes("sport")) return "yaz";
    return undefined;
  }

  enrichMetafields(category: any, title: string, existing: any) {
    const detailed = this.parseDetailed(category, title);
    return detailed.success && detailed.data ? { ...existing, ...detailed.data } : existing;
  }

  parseDetailed(category: string, title: string): DetailedParseResult<any> {
    if (!category || category === "unknown") category = this.detectCategory(title);
    switch (category) {
      case "tire": return this.parseTire(title);
      case "rim": return this.parseRim(title);
      case "battery": return this.parseBattery(title);
      default: return { success: false, data: null, rawTitle: title, fields: [] };
    }
  }

  // --- TIRE PARSER ---
  private parseTire(title: string): DetailedParseResult<TireParseResult> {
    const fields: ParsingFieldResult[] = [];
    const lower = title.toLowerCase().replace(/[\(\)\[\]]/g, " ");

    let width: number | undefined;
    let ratio: number | undefined;
    let diameter: number | undefined;
    let loadIndex: number | undefined;
    let speedIndex: string | undefined;

    // PATTERN 1: Standard Slash (205/55 R16)
    // Be very explicit about groups
    let match = lower.match(/(\d{3})\s*\/\s*(\d{2})\s*[zZ]?[rR]?\s*(\d{2})/);
    
    if (match) {
        width = parseInt(match[1]);
        ratio = parseInt(match[2]);
        diameter = parseInt(match[3]);
    } else {
        // PATTERN 2: Space Separated (205 55 16)
        match = lower.match(/(\d{3})\s+(\d{2})\s+(\d{2})/);
        if (match) {
            const w = parseInt(match[1]);
            const r = parseInt(match[2]);
            const d = parseInt(match[3]);
            // Strict check to avoid "2024 model 12 ay"
            if (w >= 125 && w <= 355 && r >= 25 && r <= 85 && d >= 10 && d <= 24) {
                width = w; ratio = r; diameter = d;
            }
        } else {
            // PATTERN 3: Compact (2055516)
            match = lower.match(/(\d{3})(\d{2})(\d{2})/);
            if (match) {
                const w = parseInt(match[1]);
                const r = parseInt(match[2]);
                const d = parseInt(match[3]);
                if (w >= 125 && w <= 355 && r >= 25 && r <= 85 && d >= 10 && d <= 24) {
                    width = w; ratio = r; diameter = d;
                }
            }
        }
    }

    // Load & Speed
    const lsMatch = title.match(/\b(\d{2,3})\s*([HJKLMNPQRSTUVWYZ])\b/);
    if (lsMatch) {
        const li = parseInt(lsMatch[1], 10);
        if (li >= 60 && li <= 130) {
            loadIndex = li;
            speedIndex = lsMatch[2].toUpperCase();
        }
    }

    const season = this.detectSeason(title);

    fields.push({ field: "width", value: width, success: !!width });
    fields.push({ field: "aspectRatio", value: ratio, success: !!ratio });
    fields.push({ field: "rimDiameter", value: diameter, success: !!diameter });
    fields.push({ field: "loadIndex", value: loadIndex, success: !!loadIndex });
    fields.push({ field: "speedIndex", value: speedIndex, success: !!speedIndex });
    fields.push({ field: "season", value: season, success: !!season });

    const success = !!(width && ratio && diameter);
    return {
      success,
      data: success ? { width: width!, aspectRatio: ratio!, rimDiameter: diameter!, loadIndex, speedIndex, season } : null,
      rawTitle: title,
      fields
    };
  }

  // --- RIM PARSER ---
  private parseRim(title: string): DetailedParseResult<RimParseResult> {
    const fields: ParsingFieldResult[] = [];
    const lower = title.toLowerCase();

    let width: number | undefined;
    let diameter: number | undefined;
    let pcd: string | undefined;
    let offset: number | undefined;

    // 1. Inch Keyword (17 inç) - Highest Priority
    const inchMatch = lower.match(/\b(\d{2})\s*(?:inç|inch|inc)/);
    if (inchMatch) {
        diameter = parseInt(inchMatch[1], 10);
    }

    // 2. Dimension Pair (7x17)
    if (!diameter) {
        const dimMatch = lower.match(/(\d+(?:\.\d+)?)\s*[jJ]?\s*[xX]\s*(\d+(?:\.\d+)?)\b/);
        if (dimMatch) {
            const v1 = parseFloat(dimMatch[1]);
            const v2 = parseFloat(dimMatch[2]);
            if (v1 > 10 && v2 < 14) { diameter = v1; width = v2; } // 17x7
            else if (v2 > 10 && v1 < 14) { width = v1; diameter = v2; } // 7x17
        } else {
            // R17 check
            const rMatch = lower.match(/[R]\s*(\d{2})\b/);
            if (rMatch) diameter = parseInt(rMatch[1], 10);
        }
    }

    // 3. Fallback Width (7J)
    if (!width) {
        const wMatch = lower.match(/\b(\d+(\.\d+)?)[jJ]\b/); // 7J or 7.5J
        if (wMatch) width = parseFloat(wMatch[1]);
    }

    // 4. PCD (5x112)
    const pcdMatch = lower.match(/(\d)[x*](\d{3})/);
    if (pcdMatch) pcd = `${pcdMatch[1]}x${pcdMatch[2]}`;

    // 5. Offset (ET45)
    const etMatch = lower.match(/(?:et|offset)\s*(-?\d+)/);
    if (etMatch) offset = parseInt(etMatch[1], 10);

    fields.push({ field: "width", value: width, success: !!width });
    fields.push({ field: "diameter", value: diameter, success: !!diameter });
    fields.push({ field: "pcd", value: pcd, success: !!pcd });
    fields.push({ field: "offset", value: offset, success: !!offset });

    const success = !!(diameter);
    return { success, data: success ? { width: width || 0, diameter: diameter!, pcd, offset } : null, rawTitle: title, fields };
  }

  // --- BATTERY PARSER ---
  private parseBattery(title: string): DetailedParseResult<BatteryParseResult> {
    const fields: ParsingFieldResult[] = [];
    const lower = title.toLowerCase();

    let capacity, cca, voltage;

    // Capacity (Ah)
    const capMatch = lower.match(/(\d+)\s*ah/);
    if (capMatch) capacity = parseInt(capMatch[1], 10);

    // CCA (A)
    const ccaMatch = title.match(/(\d+)\s*A\b/); 
    if (ccaMatch) {
        const val = parseInt(ccaMatch[1], 10);
        if (val > 100) cca = val;
    }

    // Voltage (V)
    const vMatch = lower.match(/(\d+)\s*v\b/);
    if (vMatch) voltage = parseInt(vMatch[1], 10);
    else voltage = 12;

    fields.push({ field: "capacity", value: capacity, success: !!capacity });
    fields.push({ field: "cca", value: cca, success: !!cca });
    fields.push({ field: "voltage", value: voltage, success: !!voltage });

    const success = !!(capacity);
    return { success, data: success ? { capacity: capacity!, cca, voltage } : null, rawTitle: title, fields };
  }
}
