import { z } from "zod";

/**
 * Shopify metafield type definitions
 * @see https://shopify.dev/docs/apps/custom-data/metafields/types
 */
export const MetafieldType = {
  single_line_text_field: "single_line_text_field",
  multi_line_text_field: "multi_line_text_field",
  number_integer: "number_integer",
  number_decimal: "number_decimal",
  boolean: "boolean",
  json: "json",
  list_single_line_text_field: "list.single_line_text_field",
  date: "date",
  date_time: "date_time",
} as const;

export type MetafieldTypeKey = keyof typeof MetafieldType;

// Zod schemas for validation
const singleLineSchema = z.string().max(255);
const multiLineSchema = z.string();
const integerSchema = z.number().int();
const decimalSchema = z.number();
const jsonSchema = z.record(z.string(), z.unknown());
const listSchema = z.array(z.string());

/**
 * Coerces a value to the correct format for a Shopify metafield type
 * @param value - The raw value to coerce
 * @param type - The Shopify metafield type
 * @returns The coerced value as a string (Shopify API requires string values)
 * @throws Error if the value cannot be coerced to the specified type
 */
export function coerceMetafieldValue(
  value: unknown,
  type: MetafieldTypeKey
): string {
  // Handle null/undefined
  if (value === null || value === undefined) {
    throw new Error(`Cannot coerce null/undefined to ${type}`);
  }

  switch (type) {
    case "single_line_text_field": {
      const str = String(value).trim();
      const validated = singleLineSchema.safeParse(str);
      if (!validated.success) {
        // Truncate if too long instead of throwing
        return str.slice(0, 255);
      }
      return validated.data;
    }

    case "multi_line_text_field": {
      return multiLineSchema.parse(String(value));
    }

    case "number_integer": {
      const num = Number(value);
      if (isNaN(num)) {
        throw new Error(`Cannot convert "${value}" to integer`);
      }
      const rounded = Math.round(num);
      integerSchema.parse(rounded);
      return String(rounded);
    }

    case "number_decimal": {
      const num = Number(value);
      if (isNaN(num)) {
        throw new Error(`Cannot convert "${value}" to decimal`);
      }
      decimalSchema.parse(num);
      return String(num);
    }

    case "boolean": {
      // Handle various boolean representations
      let boolValue: boolean;
      if (typeof value === "boolean") {
        boolValue = value;
      } else if (typeof value === "string") {
        const lower = value.toLowerCase().trim();
        if (["true", "1", "yes", "evet"].includes(lower)) {
          boolValue = true;
        } else if (["false", "0", "no", "hayır", "hayir"].includes(lower)) {
          boolValue = false;
        } else {
          throw new Error(`Cannot convert "${value}" to boolean`);
        }
      } else if (typeof value === "number") {
        boolValue = value !== 0;
      } else {
        boolValue = Boolean(value);
      }
      z.boolean().parse(boolValue);
      return String(boolValue);
    }

    case "json": {
      if (typeof value === "string") {
        // Validate that it's valid JSON
        try {
          JSON.parse(value);
          return value;
        } catch {
          // If it's not valid JSON, wrap it as a string value
          return JSON.stringify({ value });
        }
      }
      return JSON.stringify(jsonSchema.parse(value));
    }

    case "list_single_line_text_field": {
      let arr: string[];
      if (Array.isArray(value)) {
        arr = value.map(String);
      } else if (typeof value === "string") {
        // Try to parse as JSON array, otherwise split by comma
        try {
          const parsed = JSON.parse(value);
          arr = Array.isArray(parsed) ? parsed.map(String) : [value];
        } catch {
          arr = value.split(",").map(s => s.trim()).filter(Boolean);
        }
      } else {
        arr = [String(value)];
      }
      listSchema.parse(arr);
      return JSON.stringify(arr);
    }

    case "date": {
      if (value instanceof Date) {
        const isoDate = value.toISOString().split("T")[0];
        return isoDate || value.toISOString().substring(0, 10);
      }
      const dateStr = String(value);
      // Try to parse and format
      const parsed = new Date(dateStr);
      if (isNaN(parsed.getTime())) {
        throw new Error(`Cannot convert "${value}" to date`);
      }
      const isoDate = parsed.toISOString().split("T")[0];
      return isoDate || parsed.toISOString().substring(0, 10);
    }

    case "date_time": {
      if (value instanceof Date) {
        return value.toISOString();
      }
      const dateTimeStr = String(value);
      const parsedDt = new Date(dateTimeStr);
      if (isNaN(parsedDt.getTime())) {
        throw new Error(`Cannot convert "${value}" to datetime`);
      }
      return parsedDt.toISOString();
    }

    default:
      // For unknown types, convert to string
      return String(value);
  }
}

/**
 * Metafield definitions for the Ruzgar Lastik product schema
 * Based on docs/03-metafields-reference.md and parser outputs
 */
export const METAFIELD_DEFINITIONS = {
  // --- TIRE (Lastik) ---
  lastikGenislik: { type: "number_integer" as const, name: "Lastik Genişliği" },
  lastikOran: { type: "number_integer" as const, name: "Kesit Oranı" },
  jantCap: { type: "number_decimal" as const, name: "Jant Çapı (İnç)" }, // Shared with Rim
  mevsimTip: { type: "single_line_text_field" as const, name: "Mevsim Tipi" },
  hizIndeksi: { type: "single_line_text_field" as const, name: "Hız Endeksi" },
  yukIndeksi: { type: "number_integer" as const, name: "Yük Endeksi" },
  euYakit: { type: "single_line_text_field" as const, name: "Yakıt Verimliliği" },
  euIslakZemin: { type: "single_line_text_field" as const, name: "Islak Zemin Tutuşu" },
  euGurultu: { type: "number_integer" as const, name: "Gürültü Seviyesi (dB)" },
  runflat: { type: "boolean" as const, name: "Run Flat (Patlamaz)" },
  xl: { type: "boolean" as const, name: "XL (Ekstra Yük)" },

  // --- RIM (Jant) ---
  jantGenislik: { type: "number_decimal" as const, name: "Jant Genişliği" },
  jantPCD: { type: "single_line_text_field" as const, name: "Bijon Aralığı (PCD)" },
  jantOffset: { type: "number_integer" as const, name: "Offset (ET)" },
  
  // --- BATTERY (Akü) ---
  akuKapasite: { type: "number_integer" as const, name: "Kapasite (Ah)" },
  akuCCA: { type: "number_integer" as const, name: "Marş Gücü (CCA)" },
  voltaj: { type: "number_integer" as const, name: "Voltaj (V)" },

  // --- COMMON / OTHER ---
  marka: { type: "single_line_text_field" as const, name: "Marka" },
  model: { type: "single_line_text_field" as const, name: "Model" },
  tedarikci_kodu: { type: "single_line_text_field" as const, name: "Tedarikçi Kodu" },
} as const;

export type MetafieldKey = keyof typeof METAFIELD_DEFINITIONS;

/**
 * Maps parser output keys to Shopify Metafield keys
 * Note: Context-dependent keys (width, diameter) are handled in sync logic
 */
export const PARSER_TO_METAFIELD_MAP: Record<string, MetafieldKey> = {
  // Tire
  aspectRatio: "lastikOran",
  // rimDiameter -> jantCap (handled in sync)
  season: "mevsimTip",
  speedIndex: "hizIndeksi",
  loadIndex: "yukIndeksi",
  fuel: "euYakit",
  wetGrip: "euIslakZemin",
  noise: "euGurultu",
  
  // Rim
  pcd: "jantPCD",
  offset: "jantOffset",
  
  // Battery
  capacity: "akuKapasite",
  cca: "akuCCA",
  voltage: "voltaj",
};

/**
 * Validates and coerces a metafield value based on its key
 * @param key - The metafield key from METAFIELD_DEFINITIONS
 * @param value - The raw value to validate and coerce
 * @returns The coerced value or null if the value is empty and field is optional
 * @throws Error if required field is missing or value is invalid
 */
export function validateMetafield(
  key: MetafieldKey,
  value: unknown
): string | null {
  const definition = METAFIELD_DEFINITIONS[key];

  // Handle empty values
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return coerceMetafieldValue(value, definition.type);
}

/**
 * Prepares metafields for Shopify API submission
 * @param rawMetafields - Raw metafield key-value pairs
 * @param namespace - The metafield namespace (default: "custom")
 * @returns Array of validated metafield objects ready for Shopify API
 */
export function prepareMetafieldsForShopify(
  rawMetafields: Record<string, unknown>,
  namespace = "custom"
): Array<{
  namespace: string;
  key: string;
  value: string;
  type: string;
}> {
  const result: Array<{
    namespace: string;
    key: string;
    value: string;
    type: string;
  }> = [];

  for (const [key, value] of Object.entries(rawMetafields)) {
    // Check if this is a known metafield
    if (key in METAFIELD_DEFINITIONS) {
      const definition = METAFIELD_DEFINITIONS[key as MetafieldKey];
      try {
        const coercedValue = validateMetafield(key as MetafieldKey, value);
        if (coercedValue !== null) {
          result.push({
            namespace,
            key,
            value: coercedValue,
            type: MetafieldType[definition.type],
          });
        }
      } catch (error) {
        console.warn(
          `Skipping metafield "${key}": ${(error as Error).message}`
        );
      }
    } else {
      // Unknown metafield - try to infer type and coerce
      try {
        const inferredType = inferMetafieldType(value);
        const coercedValue = coerceMetafieldValue(value, inferredType);
        result.push({
          namespace,
          key,
          value: coercedValue,
          type: MetafieldType[inferredType],
        });
      } catch (error) {
        console.warn(
          `Skipping unknown metafield "${key}": ${(error as Error).message}`
        );
      }
    }
  }

  return result;
}

/**
 * Infers the most appropriate metafield type from a value
 * @param value - The value to analyze
 * @returns The inferred MetafieldTypeKey
 */
export function inferMetafieldType(value: unknown): MetafieldTypeKey {
  if (typeof value === "boolean") {
    return "boolean";
  }

  if (typeof value === "number") {
    return Number.isInteger(value) ? "number_integer" : "number_decimal";
  }

  if (Array.isArray(value)) {
    return "list_single_line_text_field";
  }

  if (typeof value === "object" && value !== null) {
    return "json";
  }

  if (typeof value === "string") {
    // Check if it looks like a number
    const num = Number(value);
    if (!isNaN(num) && value.trim() !== "") {
      return Number.isInteger(num) ? "number_integer" : "number_decimal";
    }

    // Check if it looks like a boolean
    const lower = value.toLowerCase().trim();
    if (["true", "false", "1", "0", "yes", "no"].includes(lower)) {
      return "boolean";
    }

    // Check if it contains newlines
    if (value.includes("\n")) {
      return "multi_line_text_field";
    }

    // Check if it looks like JSON
    if (
      (value.startsWith("{") && value.endsWith("}")) ||
      (value.startsWith("[") && value.endsWith("]"))
    ) {
      try {
        JSON.parse(value);
        return value.startsWith("[") ? "list_single_line_text_field" : "json";
      } catch {
        // Not valid JSON, fall through
      }
    }
  }

  return "single_line_text_field";
}
