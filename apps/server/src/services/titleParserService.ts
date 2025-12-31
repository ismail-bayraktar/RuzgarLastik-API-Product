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

// Detailed parsing result interfaces
export interface ParsingFieldResult {
  field: string;           // "width", "ratio", "season" etc.
  value: any | null;       // Extracted value
  success: boolean;        // Was extraction successful?
  reason?: string;         // "Pattern bulunamadı", "Geçersiz değer" etc.
  pattern?: string;        // Used regex pattern (if successful)
  confidence?: number;     // 0-1 confidence score
}

export interface DetailedParseResult<T> {
  success: boolean;
  data: T | null;
  rawTitle: string;
  fields: ParsingFieldResult[];
}

export class TitleParserService {
  // Regex patterns for tire titles
  private static TIRE_PATTERNS = [
    // 205/55R16 91V or 245/35ZR20 (91Y) format - Z optional for ZR tires
    /(\d{3})\/(\d{2,3})Z?R(\d{2})\s*\(?(\d{2,3})?([HJKLMNPQRSTUVWYZ])?\)?/i,
    // 205/55/16 91V format (alternative separator)
    /(\d{3})\/(\d{2,3})\/(\d{2})\s*\(?(\d{2,3})?([HJKLMNPQRSTUVWYZ])?\)?/i,
    // 2055516 format (no separators)
    /(\d{3})(\d{2,3})Z?R?(\d{2})/i,
  ];

  // Regex patterns for rim titles
  private static RIM_PATTERNS = [
    // 7Jx17 5x112 ET45 format
    /(\d+\.?\d*)J?[xX](\d{2})\s*([\dx]+)?\s*(?:ET|et)?(\d+)?/i,
    // 7" x 17" format
    /(\d+\.?\d*)"?\s*[xX]\s*(\d{2})"?/i,
  ];

  // Regex patterns for battery titles
  private static BATTERY_PATTERNS = [
    // 60Ah 540A format
    /(\d+)\s*Ah\s*(\d+)\s*A/i,
    // 60AH/540A format
    /(\d+)\s*AH?\/(\d+)\s*A/i,
  ];

  // Season keywords
  private static SEASON_KEYWORDS = {
    yaz: ["summer", "yaz", "primacy", "pilot", "eagle", "p zero"],
    kis: ["winter", "kış", "alpin", "blizzak", "ice", "snow"],
    dort_mevsim: ["4season", "all season", "vector", "crossclimate", "quattro"],
  };

  parseTireTitle(title: string): TireParseResult | null {
    for (const pattern of TitleParserService.TIRE_PATTERNS) {
      const match = title.match(pattern);
      if (match && match[1] && match[2] && match[3]) {
        const width = parseInt(match[1], 10);
        const aspectRatio = parseInt(match[2], 10);
        const rimDiameter = parseInt(match[3], 10);
        const loadIndex = match[4] ? parseInt(match[4], 10) : undefined;
        const speedIndex = match[5] || undefined;

        // Detect season from title
        const season = this.detectSeason(title);

        return {
          width,
          aspectRatio,
          rimDiameter,
          loadIndex,
          speedIndex,
          season,
        };
      }
    }
    return null;
  }

  parseRimTitle(title: string): RimParseResult | null {
    for (const pattern of TitleParserService.RIM_PATTERNS) {
      const match = title.match(pattern);
      if (match && match[1] && match[2]) {
        const width = parseFloat(match[1]);
        const diameter = parseInt(match[2], 10);
        const pcd = match[3] || undefined;
        const offset = match[4] ? parseInt(match[4], 10) : undefined;

        return {
          width,
          diameter,
          pcd,
          offset,
        };
      }
    }
    return null;
  }

  parseBatteryTitle(title: string): BatteryParseResult | null {
    for (const pattern of TitleParserService.BATTERY_PATTERNS) {
      const match = title.match(pattern);
      if (match && match[1] && match[2]) {
        const capacity = parseInt(match[1], 10);
        const cca = parseInt(match[2], 10);

        // Extract voltage if present (usually 12V)
        const voltageMatch = title.match(/(\d+)\s*V/i);
        const voltage = voltageMatch && voltageMatch[1] ? parseInt(voltageMatch[1], 10) : undefined;

        return {
          capacity,
          cca,
          voltage,
        };
      }
    }
    return null;
  }

  private detectSeason(title: string): "yaz" | "kis" | "dort_mevsim" | undefined {
    const lowerTitle = title.toLowerCase();

    for (const [season, keywords] of Object.entries(TitleParserService.SEASON_KEYWORDS)) {
      if (keywords.some((keyword) => lowerTitle.includes(keyword.toLowerCase()))) {
        return season as "yaz" | "kis" | "dort_mevsim";
      }
    }

    return undefined;
  }

  enrichMetafields(
    category: "tire" | "rim" | "battery",
    title: string,
    existingMetafields?: Record<string, any>
  ): Record<string, any> {
    const metafields = { ...existingMetafields };

    switch (category) {
      case "tire": {
        const parsed = this.parseTireTitle(title);
        if (parsed) {
          if (!metafields.width) metafields.width = parsed.width;
          if (!metafields.aspectRatio) metafields.aspectRatio = parsed.aspectRatio;
          if (!metafields.rimDiameter) metafields.rimDiameter = parsed.rimDiameter;
          if (!metafields.loadIndex && parsed.loadIndex) metafields.loadIndex = parsed.loadIndex;
          if (!metafields.speedIndex && parsed.speedIndex) metafields.speedIndex = parsed.speedIndex;
          if (!metafields.season && parsed.season) metafields.season = parsed.season;
        }
        break;
      }

      case "rim": {
        const parsed = this.parseRimTitle(title);
        if (parsed) {
          if (!metafields.width) metafields.width = parsed.width;
          if (!metafields.diameter) metafields.diameter = parsed.diameter;
          if (!metafields.pcd && parsed.pcd) metafields.pcd = parsed.pcd;
          if (!metafields.offset && parsed.offset) metafields.offset = parsed.offset;
        }
        break;
      }

      case "battery": {
        const parsed = this.parseBatteryTitle(title);
        if (parsed) {
          if (!metafields.capacity && parsed.capacity) metafields.capacity = parsed.capacity;
          if (!metafields.cca && parsed.cca) metafields.cca = parsed.cca;
          if (!metafields.voltage && parsed.voltage) metafields.voltage = parsed.voltage;
        }
        break;
      }
    }

    return metafields;
  }

  // ============================================
  // DETAILED PARSING METHODS
  // ============================================

  /**
   * Parse tire title with detailed field-by-field results
   */
  parseTireTitleDetailed(title: string): DetailedParseResult<TireParseResult> {
    const fields: ParsingFieldResult[] = [];
    let mainMatch: RegExpMatchArray | null = null;
    let usedPattern: string | null = null;

    // Try each pattern to find main dimensions
    for (const pattern of TitleParserService.TIRE_PATTERNS) {
      mainMatch = title.match(pattern);
      if (mainMatch) {
        usedPattern = pattern.source;
        break;
      }
    }

    // Width field
    if (mainMatch && mainMatch[1]) {
      const width = parseInt(mainMatch[1], 10);
      if (width >= 125 && width <= 355) {
        fields.push({
          field: "width",
          value: width,
          success: true,
          pattern: usedPattern || undefined,
          confidence: 1.0,
        });
      } else {
        fields.push({
          field: "width",
          value: width,
          success: false,
          reason: `Geçersiz genişlik değeri: ${width} (beklenen: 125-355)`,
          pattern: usedPattern || undefined,
          confidence: 0.3,
        });
      }
    } else {
      fields.push({
        field: "width",
        value: null,
        success: false,
        reason: "Genişlik pattern'i bulunamadı (örn: 205/55R16)",
      });
    }

    // Aspect Ratio field
    if (mainMatch && mainMatch[2]) {
      const ratio = parseInt(mainMatch[2], 10);
      if (ratio >= 25 && ratio <= 85) {
        fields.push({
          field: "aspectRatio",
          value: ratio,
          success: true,
          pattern: usedPattern || undefined,
          confidence: 1.0,
        });
      } else {
        fields.push({
          field: "aspectRatio",
          value: ratio,
          success: false,
          reason: `Geçersiz oran değeri: ${ratio} (beklenen: 25-85)`,
          confidence: 0.3,
        });
      }
    } else {
      fields.push({
        field: "aspectRatio",
        value: null,
        success: false,
        reason: "Kesit oranı pattern'i bulunamadı",
      });
    }

    // Rim Diameter field
    if (mainMatch && mainMatch[3]) {
      const diameter = parseInt(mainMatch[3], 10);
      if (diameter >= 12 && diameter <= 24) {
        fields.push({
          field: "rimDiameter",
          value: diameter,
          success: true,
          pattern: usedPattern || undefined,
          confidence: 1.0,
        });
      } else {
        fields.push({
          field: "rimDiameter",
          value: diameter,
          success: false,
          reason: `Geçersiz çap değeri: ${diameter} (beklenen: 12-24)`,
          confidence: 0.3,
        });
      }
    } else {
      fields.push({
        field: "rimDiameter",
        value: null,
        success: false,
        reason: "Jant çapı pattern'i bulunamadı",
      });
    }

    // Load Index field (optional)
    if (mainMatch && mainMatch[4]) {
      const loadIndex = parseInt(mainMatch[4], 10);
      if (loadIndex >= 60 && loadIndex <= 130) {
        fields.push({
          field: "loadIndex",
          value: loadIndex,
          success: true,
          pattern: usedPattern || undefined,
          confidence: 1.0,
        });
      } else {
        fields.push({
          field: "loadIndex",
          value: loadIndex,
          success: false,
          reason: `Şüpheli yük indeksi: ${loadIndex}`,
          confidence: 0.5,
        });
      }
    } else {
      fields.push({
        field: "loadIndex",
        value: null,
        success: false,
        reason: "Yük indeksi bulunamadı (opsiyonel alan)",
        confidence: 0.0,
      });
    }

    // Speed Index field (optional)
    if (mainMatch && mainMatch[5]) {
      fields.push({
        field: "speedIndex",
        value: mainMatch[5].toUpperCase(),
        success: true,
        pattern: usedPattern || undefined,
        confidence: 1.0,
      });
    } else {
      // Try to find speed index separately
      const speedMatch = title.match(/\b([HJKLMNPQRSTUVWYZ])\b/);
      if (speedMatch && speedMatch[1]) {
        fields.push({
          field: "speedIndex",
          value: speedMatch[1].toUpperCase(),
          success: true,
          pattern: "/\\b([HJKLMNPQRSTUVWYZ])\\b/",
          confidence: 0.7,
        });
      } else {
        fields.push({
          field: "speedIndex",
          value: null,
          success: false,
          reason: "Hız indeksi bulunamadı (opsiyonel alan)",
        });
      }
    }

    // Season field
    const season = this.detectSeason(title);
    if (season) {
      const seasonLabels: Record<string, string> = {
        yaz: "Yaz lastiği",
        kis: "Kış lastiği",
        dort_mevsim: "4 Mevsim",
      };
      fields.push({
        field: "season",
        value: season,
        success: true,
        reason: seasonLabels[season],
        confidence: 0.8,
      });
    } else {
      fields.push({
        field: "season",
        value: null,
        success: false,
        reason: "Mevsim anahtar kelimesi bulunamadı (yaz/kış/4 mevsim)",
      });
    }

    // Build result
    const requiredFields = fields.filter(f => ["width", "aspectRatio", "rimDiameter"].includes(f.field));
    const allRequiredSuccess = requiredFields.every(f => f.success);

    const data: TireParseResult | null = allRequiredSuccess
      ? {
          width: fields.find(f => f.field === "width")!.value,
          aspectRatio: fields.find(f => f.field === "aspectRatio")!.value,
          rimDiameter: fields.find(f => f.field === "rimDiameter")!.value,
          loadIndex: fields.find(f => f.field === "loadIndex")?.value ?? undefined,
          speedIndex: fields.find(f => f.field === "speedIndex")?.value ?? undefined,
          season: fields.find(f => f.field === "season")?.value ?? undefined,
        }
      : null;

    return {
      success: allRequiredSuccess,
      data,
      rawTitle: title,
      fields,
    };
  }

  /**
   * Parse rim title with detailed field-by-field results
   */
  parseRimTitleDetailed(title: string): DetailedParseResult<RimParseResult> {
    const fields: ParsingFieldResult[] = [];
    let mainMatch: RegExpMatchArray | null = null;
    let usedPattern: string | null = null;

    // Try each pattern
    for (const pattern of TitleParserService.RIM_PATTERNS) {
      mainMatch = title.match(pattern);
      if (mainMatch) {
        usedPattern = pattern.source;
        break;
      }
    }

    // Width field
    if (mainMatch && mainMatch[1]) {
      const width = parseFloat(mainMatch[1]);
      if (width >= 4 && width <= 14) {
        fields.push({
          field: "width",
          value: width,
          success: true,
          pattern: usedPattern || undefined,
          confidence: 1.0,
        });
      } else {
        fields.push({
          field: "width",
          value: width,
          success: false,
          reason: `Şüpheli jant genişliği: ${width}" (beklenen: 4-14)`,
          confidence: 0.4,
        });
      }
    } else {
      fields.push({
        field: "width",
        value: null,
        success: false,
        reason: "Jant genişliği pattern'i bulunamadı (örn: 7Jx17)",
      });
    }

    // Diameter field
    if (mainMatch && mainMatch[2]) {
      const diameter = parseInt(mainMatch[2], 10);
      if (diameter >= 12 && diameter <= 24) {
        fields.push({
          field: "diameter",
          value: diameter,
          success: true,
          pattern: usedPattern || undefined,
          confidence: 1.0,
        });
      } else {
        fields.push({
          field: "diameter",
          value: diameter,
          success: false,
          reason: `Şüpheli jant çapı: ${diameter}" (beklenen: 12-24)`,
          confidence: 0.4,
        });
      }
    } else {
      fields.push({
        field: "diameter",
        value: null,
        success: false,
        reason: "Jant çapı pattern'i bulunamadı",
      });
    }

    // PCD field (optional)
    if (mainMatch && mainMatch[3]) {
      const pcd = mainMatch[3];
      // Validate PCD format (e.g., 5x112, 4x100)
      if (/^\d+x\d+$/.test(pcd)) {
        fields.push({
          field: "pcd",
          value: pcd,
          success: true,
          pattern: usedPattern || undefined,
          confidence: 1.0,
        });
      } else {
        fields.push({
          field: "pcd",
          value: pcd,
          success: false,
          reason: `Şüpheli PCD formatı: ${pcd} (beklenen: 5x112)`,
          confidence: 0.5,
        });
      }
    } else {
      // Try to find PCD separately
      const pcdMatch = title.match(/(\d)x(\d{3})/);
      if (pcdMatch) {
        fields.push({
          field: "pcd",
          value: pcdMatch[0],
          success: true,
          pattern: "/(\\d)x(\\d{3})/",
          confidence: 0.8,
        });
      } else {
        fields.push({
          field: "pcd",
          value: null,
          success: false,
          reason: "PCD bulunamadı (opsiyonel alan)",
        });
      }
    }

    // Offset field (optional)
    if (mainMatch && mainMatch[4]) {
      const offset = parseInt(mainMatch[4], 10);
      if (offset >= -30 && offset <= 60) {
        fields.push({
          field: "offset",
          value: offset,
          success: true,
          pattern: usedPattern || undefined,
          confidence: 1.0,
        });
      } else {
        fields.push({
          field: "offset",
          value: offset,
          success: false,
          reason: `Şüpheli ET değeri: ${offset} (beklenen: -30 ile 60 arası)`,
          confidence: 0.5,
        });
      }
    } else {
      // Try to find ET separately
      const etMatch = title.match(/ET\s*(-?\d+)/i);
      if (etMatch && etMatch[1]) {
        const offset = parseInt(etMatch[1], 10);
        fields.push({
          field: "offset",
          value: offset,
          success: true,
          pattern: "/ET\\s*(-?\\d+)/i",
          confidence: 0.9,
        });
      } else {
        fields.push({
          field: "offset",
          value: null,
          success: false,
          reason: "ET (offset) bulunamadı (opsiyonel alan)",
        });
      }
    }

    // Build result
    const requiredFields = fields.filter(f => ["width", "diameter"].includes(f.field));
    const allRequiredSuccess = requiredFields.every(f => f.success);

    const data: RimParseResult | null = allRequiredSuccess
      ? {
          width: fields.find(f => f.field === "width")!.value,
          diameter: fields.find(f => f.field === "diameter")!.value,
          pcd: fields.find(f => f.field === "pcd")?.value ?? undefined,
          offset: fields.find(f => f.field === "offset")?.value ?? undefined,
        }
      : null;

    return {
      success: allRequiredSuccess,
      data,
      rawTitle: title,
      fields,
    };
  }

  /**
   * Parse battery title with detailed field-by-field results
   */
  parseBatteryTitleDetailed(title: string): DetailedParseResult<BatteryParseResult> {
    const fields: ParsingFieldResult[] = [];
    let mainMatch: RegExpMatchArray | null = null;
    let usedPattern: string | null = null;

    // Try each pattern
    for (const pattern of TitleParserService.BATTERY_PATTERNS) {
      mainMatch = title.match(pattern);
      if (mainMatch) {
        usedPattern = pattern.source;
        break;
      }
    }

    // Capacity field
    if (mainMatch && mainMatch[1]) {
      const capacity = parseInt(mainMatch[1], 10);
      if (capacity >= 30 && capacity <= 250) {
        fields.push({
          field: "capacity",
          value: capacity,
          success: true,
          pattern: usedPattern || undefined,
          confidence: 1.0,
        });
      } else {
        fields.push({
          field: "capacity",
          value: capacity,
          success: false,
          reason: `Şüpheli kapasite: ${capacity}Ah (beklenen: 30-250)`,
          confidence: 0.4,
        });
      }
    } else {
      // Try to find capacity separately
      const capacityMatch = title.match(/(\d+)\s*Ah/i);
      if (capacityMatch && capacityMatch[1]) {
        const capacity = parseInt(capacityMatch[1], 10);
        fields.push({
          field: "capacity",
          value: capacity,
          success: true,
          pattern: "/(\\d+)\\s*Ah/i",
          confidence: 0.9,
        });
      } else {
        fields.push({
          field: "capacity",
          value: null,
          success: false,
          reason: "Kapasite (Ah) bulunamadı",
        });
      }
    }

    // CCA field
    if (mainMatch && mainMatch[2]) {
      const cca = parseInt(mainMatch[2], 10);
      if (cca >= 200 && cca <= 1500) {
        fields.push({
          field: "cca",
          value: cca,
          success: true,
          pattern: usedPattern || undefined,
          confidence: 1.0,
        });
      } else {
        fields.push({
          field: "cca",
          value: cca,
          success: false,
          reason: `Şüpheli CCA değeri: ${cca}A (beklenen: 200-1500)`,
          confidence: 0.4,
        });
      }
    } else {
      // Try to find CCA separately (number followed by A but not Ah)
      const ccaMatch = title.match(/(\d{3,4})\s*A(?!h)/i);
      if (ccaMatch && ccaMatch[1]) {
        const cca = parseInt(ccaMatch[1], 10);
        fields.push({
          field: "cca",
          value: cca,
          success: true,
          pattern: "/(\\d{3,4})\\s*A(?!h)/i",
          confidence: 0.8,
        });
      } else {
        fields.push({
          field: "cca",
          value: null,
          success: false,
          reason: "CCA (Soğuk Marş Akımı) bulunamadı",
        });
      }
    }

    // Voltage field (optional, usually 12V)
    const voltageMatch = title.match(/(\d+)\s*V\b/i);
    if (voltageMatch && voltageMatch[1]) {
      const voltage = parseInt(voltageMatch[1], 10);
      if (voltage === 12 || voltage === 24) {
        fields.push({
          field: "voltage",
          value: voltage,
          success: true,
          pattern: "/(\\d+)\\s*V\\b/i",
          confidence: 1.0,
        });
      } else {
        fields.push({
          field: "voltage",
          value: voltage,
          success: false,
          reason: `Şüpheli voltaj: ${voltage}V (beklenen: 12 veya 24)`,
          confidence: 0.3,
        });
      }
    } else {
      fields.push({
        field: "voltage",
        value: 12, // Default to 12V
        success: true,
        reason: "Voltaj belirtilmemiş, 12V varsayıldı",
        confidence: 0.6,
      });
    }

    // Build result - at least capacity should be found for success
    const capacityField = fields.find(f => f.field === "capacity");
    const success = capacityField?.success ?? false;

    const data: BatteryParseResult | null = success
      ? {
          capacity: fields.find(f => f.field === "capacity")?.value ?? undefined,
          cca: fields.find(f => f.field === "cca")?.value ?? undefined,
          voltage: fields.find(f => f.field === "voltage")?.value ?? undefined,
        }
      : null;

    return {
      success,
      data,
      rawTitle: title,
      fields,
    };
  }

  /**
   * Generic detailed parse method that routes to appropriate category parser
   */
  parseDetailed(
    category: "tire" | "rim" | "battery",
    title: string
  ): DetailedParseResult<TireParseResult | RimParseResult | BatteryParseResult> {
    switch (category) {
      case "tire":
        return this.parseTireTitleDetailed(title);
      case "rim":
        return this.parseRimTitleDetailed(title);
      case "battery":
        return this.parseBatteryTitleDetailed(title);
    }
  }
}
