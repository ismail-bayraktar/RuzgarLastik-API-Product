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

export class TitleParserService {
  // Regex patterns for tire titles
  private static TIRE_PATTERNS = [
    // 205/55R16 91V format
    /(\d{3})\/(\d{2})R(\d{2})\s*(\d{2,3})?([HJKLMNPQRSTUVWYZ])?/i,
    // 205/55/16 91V format (alternative separator)
    /(\d{3})\/(\d{2})\/(\d{2})\s*(\d{2,3})?([HJKLMNPQRSTUVWYZ])?/i,
    // 2055516 format (no separators)
    /(\d{3})(\d{2})R?(\d{2})/i,
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
      if (match) {
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
      if (match) {
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
      if (match) {
        const capacity = parseInt(match[1], 10);
        const cca = parseInt(match[2], 10);

        // Extract voltage if present (usually 12V)
        const voltageMatch = title.match(/(\d+)\s*V/i);
        const voltage = voltageMatch ? parseInt(voltageMatch[1], 10) : undefined;

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
}
