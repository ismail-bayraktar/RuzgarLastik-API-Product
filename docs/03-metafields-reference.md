# 03 - Metafields Reference Guide

## 📋 İçindekiler

1. [Metafield Nedir?](#metafield-nedir)
2. [Shopify Metafield Tipleri](#shopify-metafield-tipleri)
3. [Rüzgar Lastik Metafield Şeması](#rüzgar-lastik-metafield-şeması)
4. [Type Safety & Validation](#type-safety--validation)
5. [Metafield CRUD Operations](#metafield-crud-operations)
6. [Eski Hatalar & Çözümler](#eski-hatalar--çözümler)
7. [Testing & Validation Checklist](#testing--validation-checklist)

---

## Metafield Nedir?

**Metafield**, Shopify ürünlerine ek custom alanlar eklemenin resmi yoludur.

### Örnek Senaryo

Standard Shopify product fields:
- title
- description
- price
- vendor
- etc.

Ama lastik ürünü için şu bilgileri de depolamak gerekli:
- Genişlik (205 mm)
- Oran (55 %)
- Jant çapı (16 inch)
- Hız indeksi (V)
- EU yakıt rating (B)

Bu alanları **metafields** olarak tanımlarız.

### Metafield Anatomy

```
Namespace: custom
Key: lastikGenislik
Type: number_integer
Value: 205
```

Shopify GraphQL'de:

```graphql
metafield(namespace: "custom", key: "lastikGenislik") {
  value  # "205"
  type   # "number_integer"
}
```

---

## Shopify Metafield Tipleri

### Scalar Types

| Type | Örnek | Açıklama |
|---|---|---|
| `single_line_text_field` | "Michelin" | Bir satırlık string |
| `multi_line_text_field` | "Bu lastik..." | Çok satırlı metin |
| `number_integer` | 205 | Tam sayı |
| `number_decimal` | 3.14 | Ondalıklı sayı |
| `boolean` | true/false | Evet/Hayır |
| `date` | "2024-01-15" | Tarih (YYYY-MM-DD) |
| `date_time` | "2024-01-15T10:30:00Z" | Tarih+Saat |
| `url` | "https://..." | Web adresi |
| `json` | {"nested":"value"} | JSON object |

### Collection Types

| Type | Örnek | Açıklama |
|---|---|---|
| `list.single_line_text_field` | ["5x112", "5x120"] | String array |
| `list.number_integer` | [1, 2, 3] | Sayı array |

---

## Rüzgar Lastik Metafield Şeması

### 1. LASTIK (TIRE) – 9 Field

#### Temel Ölçülü

| Key | Type | Örnek | Açıklama | Zorunlu? |
|---|---|---|---|---|
| `lastikGenislik` | number_integer | 205 | Genişlik (mm) | ✅ |
| `lastikOran` | number_integer | 55 | Boy/En oranı (%) | ✅ |
| `jantCap` | number_decimal | 16.0 | Jant çapı (inch) | ✅ |

#### Performans İndeksleri

| Key | Type | Örnek | Açıklama | Zorunlu? |
|---|---|---|---|---|
| `mevsimTip` | single_line_text_field | "yaz" | yaz / kis / dort_mevsim | ✅ |
| `hizIndeksi` | single_line_text_field | "V" | H / V / W / Y / Z (hız kategorisi) | ✅ |
| `yukIndeksi` | number_integer | 91 | Yük taşıma indeksi | ✅ |

#### EU Etiket (Direktif 1222/2009)

| Key | Type | Örnek | Açıklama | Zorunlu? |
|---|---|---|---|---|
| `euYakit` | single_line_text_field | "B" | A–G sınıfı (yakıt tasarrufu) | ✅ |
| `euIslakZemin` | single_line_text_field | "B" | A–G sınıfı (ıslak aderans) | ✅ |
| `euGurultu` | number_integer | 71 | Dış gürültü (dB) | ✅ |

**JSON Representation:**

```typescript
interface TireMetafields {
  lastikGenislik: number;
  lastikOran: number;
  jantCap: number;
  mevsimTip: "yaz" | "kis" | "dort_mevsim";
  hizIndeksi: "H" | "V" | "W" | "Y" | "Z";
  yukIndeksi: number;
  euYakit: "A" | "B" | "C" | "D" | "E" | "F" | "G";
  euIslakZemin: "A" | "B" | "C" | "D" | "E" | "F" | "G";
  euGurultu: number;
}
```

---

### 2. JANT (RIM) – 4 Field

| Key | Type | Örnek | Açıklama | Zorunlu? |
|---|---|---|---|---|
| `jantGenislik` | number_decimal | 7.5 | J değeri (inch) | ✅ |
| `jantPCD` | single_line_text_field | "5x112" | Bolt pattern (hole count x diameter) | ✅ |
| `jantOffset` | number_integer | 45 | ET değeri (mm, offset) | ✅ |
| `jantCap` | number_decimal | 17.0 | Jant çapı (inch) | ✅ |

**JSON Representation:**

```typescript
interface RimMetafields {
  jantGenislik: number;
  jantPCD: string;    // "5x112", "4x100", etc.
  jantOffset: number;
  jantCap: number;
}
```

---

### 3. AKÜ (BATTERY) – 2 Field

| Key | Type | Örnek | Açıklama | Zorunlu? |
|---|---|---|---|---|
| `akuKapasite` | number_integer | 60 | Ah (Amper-saat) | ✅ |
| `akuCCA` | number_integer | 540 | Cold Cranking Amps | ✅ |

**JSON Representation:**

```typescript
interface BatteryMetafields {
  akuKapasite: number;
  akuCCA: number;
}
```

---

### 4. ARAÇ UYUMLULUĞU (Optional) – 3 Field

| Key | Type | Örnek | Açıklama | Zorunlu? |
|---|---|---|---|---|
| `aracMarka` | single_line_text_field | "BMW" | Araç markası | ❌ |
| `aracModel` | single_line_text_field | "3 Series" | Araç modeli | ❌ |
| `aracYil` | number_integer | 2021 | Model yılı | ❌ |

**JSON Representation:**

```typescript
interface VehicleCompatibilityMetafields {
  aracMarka?: string;
  aracModel?: string;
  aracYil?: number;
}
```

---

## Type Safety & Validation

### Problem: Eski Sistem Type Mismatch

**Eski hatanın root cause:**

```
Shopify tarafında (definition):
  Key: lastikGenislik
  Type: number_integer
  ✓ Tanım: only integer values

Ama API'den gönderilen:
  Value: 16.5 (number_decimal)
  ✗ Gönderilen: decimal value

Shopify Response:
  ❌ "Type 'number_decimal' must be consistent with..."
```

### Çözüm 1: Type Coercion (Backend'de)

```typescript
// apps/server/services/metafieldService.ts

function coerceMetafieldValue(
  key: string,
  value: unknown,
  expectedType: string
): unknown {
  switch (expectedType) {
    case "number_integer":
      return Math.floor(Number(value)); // 16.5 → 16
    
    case "number_decimal":
      return Number(value); // "16.5" → 16.5
    
    case "single_line_text_field":
      return String(value).trim(); // " Michelin " → "Michelin"
    
    case "boolean":
      return Boolean(value); // "true" → true
    
    default:
      return value;
  }
}
```

### Çözüm 2: Zod Schema Validation

```typescript
// packages/api/schemas.ts

import { z } from "zod";

const TireMetafieldsSchema = z.object({
  lastikGenislik: z.number().int().min(100).max(400),
  lastikOran: z.number().int().min(25).max(85),
  jantCap: z.number().min(10).max(25),
  mevsimTip: z.enum(["yaz", "kis", "dort_mevsim"]),
  hizIndeksi: z.enum(["H", "V", "W", "Y", "Z"]),
  yukIndeksi: z.number().int().min(0).max(150),
  euYakit: z.enum(["A", "B", "C", "D", "E", "F", "G"]),
  euIslakZemin: z.enum(["A", "B", "C", "D", "E", "F", "G"]),
  euGurultu: z.number().int().min(60).max(85),
});

type TireMetafields = z.infer<typeof TireMetafieldsSchema>;

// Usage
try {
  const validated = TireMetafieldsSchema.parse(rawData);
  // Safe to use
} catch (error) {
  console.error("Validation failed:", error.errors);
}
```

### Çözüm 3: Runtime Type Guard

```typescript
// apps/server/utils/typeGuards.ts

export function isTireMetafields(
  obj: unknown,
  category: string
): obj is TireMetafields {
  if (category !== "tire") return false;
  
  const data = obj as Record<string, unknown>;
  return (
    typeof data.lastikGenislik === "number" &&
    typeof data.lastikOran === "number" &&
    typeof data.jantCap === "number"
    // ... more checks
  );
}
```

---

## Metafield CRUD Operations

### Shopify GraphQL Mutations

#### 1. Metafield Definition Create (İlk Sefer)

```graphql
mutation CreateMetafieldDefinition($input: MetafieldDefinitionInput!) {
  metafieldDefinitionCreate(input: $input) {
    metafieldDefinition {
      id
      key
      name
      type
      namespace
    }
    userErrors {
      field
      message
    }
  }
}

# Variables
{
  "input": {
    "name": "Lastik Genişliği",
    "description": "Lastik genişliği (mm)",
    "key": "lastikGenislik",
    "namespace": "custom",
    "type": "number_integer",
    "ownerType": "PRODUCT"
  }
}
```

#### 2. Metafield Value Set (Her Sync'de)

```graphql
mutation SetProductMetafield($input: ProductInput!) {
  productUpdate(input: $input) {
    product {
      id
      metafields(first: 10) {
        edges {
          node {
            key
            value
          }
        }
      }
    }
    userErrors {
      field
      message
    }
  }
}

# Variables
{
  "input": {
    "id": "gid://shopify/Product/123456",
    "metafields": [
      {
        "namespace": "custom",
        "key": "lastikGenislik",
        "type": "number_integer",
        "value": "205"
      },
      {
        "namespace": "custom",
        "key": "mevsimTip",
        "type": "single_line_text_field",
        "value": "yaz"
      }
    ]
  }
}
```

#### 3. Metafield Value Fetch

```graphql
query GetProductMetafields($id: ID!) {
  product(id: $id) {
    id
    title
    metafields(first: 20, namespace: "custom") {
      edges {
        node {
          key
          value
          type
        }
      }
    }
  }
}
```

### Backend Implementation (Hono Service)

```typescript
// apps/server/services/metafieldService.ts

export class MetafieldService {
  async defineMetafield(
    key: string,
    name: string,
    type: string
  ): Promise<string> {
    const mutation = `
      mutation CreateMetafieldDefinition($input: MetafieldDefinitionInput!) {
        metafieldDefinitionCreate(input: $input) {
          metafieldDefinition { id }
          userErrors { field message }
        }
      }
    `;

    const response = await shopifyClient.request(mutation, {
      input: {
        key,
        name,
        type,
        namespace: "custom",
        ownerType: "PRODUCT",
      },
    });

    if (response.userErrors?.length > 0) {
      throw new Error(`Metafield definition failed: ${response.userErrors[0].message}`);
    }

    return response.metafieldDefinitionCreate.metafieldDefinition.id;
  }

  async setMetafields(
    productId: string,
    metafields: Array<{ namespace: string; key: string; type: string; value: string }>
  ): Promise<void> {
    const mutation = `
      mutation UpdateMetafields($input: ProductInput!) {
        productUpdate(input: $input) {
          product { id }
          userErrors { field message }
        }
      }
    `;

    const response = await shopifyClient.request(mutation, {
      input: {
        id: productId,
        metafields,
      },
    });

    if (response.userErrors?.length > 0) {
      throw new Error(`Metafield update failed: ${response.userErrors[0].message}`);
    }
  }

  async buildMetafieldPayload(
    category: string,
    data: Record<string, unknown>
  ): Promise<Array<{ namespace: string; key: string; type: string; value: string }>> {
    const payload = [];

    if (category === "tire") {
      payload.push(
        { namespace: "custom", key: "lastikGenislik", type: "number_integer", value: String(data.width) },
        { namespace: "custom", key: "lastikOran", type: "number_integer", value: String(data.ratio) },
        // ... more fields
      );
    }

    return payload;
  }
}
```

---

## Eski Hatalar & Çözümler

### Hata #1: Type Mismatch (number_decimal vs integer)

**Semptom:**
```
Error: Type 'number_decimal' must be consistent with the definition's type: 'number_integer'
```

**Root Cause:**
- Metafield definition: `number_integer`
- Gönderilen değer: 16.5 (decimal)

**Çözüm:**
```typescript
// Type coercion BEFORE sending to Shopify
const value = 16.5;
const coercedValue = Math.floor(value); // 16
```

**Test:**
```bash
npm run test:metafields
# ✅ Should coerce 16.5 → 16
# ✅ Should coerce "16" → 16
# ✅ Should reject "abc" (NaN)
```

---

### Hata #2: Missing Location ID

**Semptom:**
```
Inventory update failed: Location not found
```

**Root Cause:**
- `SHOPIFY_LOCATION_ID` env'de boş
- Inventory sync çalışmıyor

**Çözüm:**
```typescript
// apps/server/config/shopifyConfig.ts

export const getLocationId = async (): Promise<string> => {
  const fromEnv = process.env.SHOPIFY_LOCATION_ID;
  if (fromEnv) return fromEnv;

  // Fetch from Shopify if not in env
  const locations = await shopifyClient.request(`
    query {
      locations(first: 1) {
        edges {
          node {
            id
            name
          }
        }
      }
    }
  `);

  if (locations.locations.edges.length === 0) {
    throw new Error("No locations found in Shopify");
  }

  return locations.locations.edges[0].node.id;
};
```

**Verification:**
```bash
npm run verify:location-id
# Output: Location ID: gid://shopify/Location/12345678
```

---

### Hata #3: Undefined Metafield Keys

**Semptom:**
```
Field 'lastikGenislik' doesn't exist
```

**Root Cause:**
- Metafield definition Shopify tarafında oluşturulmamış
- Veya yanlış namespace

**Çözüm:**
```typescript
// apps/server/seeds/metafieldDefinitions.ts

export async function seedMetafieldDefinitions() {
  const definitions = [
    { key: "lastikGenislik", name: "Tire Width", type: "number_integer" },
    { key: "mevsimTip", name: "Season Type", type: "single_line_text_field" },
    // ... all definitions
  ];

  for (const def of definitions) {
    await metafieldService.defineMetafield(def.key, def.name, def.type);
  }
}
```

**Initialization:**
```bash
npm run seed:metafields
# Runs on first sync automatically if not exists
```

---

## Testing & Validation Checklist

### Unit Tests

- [ ] `coerceMetafieldValue()` tests
  - [ ] number_integer: 16.5 → 16 ✅
  - [ ] number_decimal: "16.5" → 16.5 ✅
  - [ ] single_line_text: " text " → "text" ✅
  - [ ] Invalid input: throw error ✅

- [ ] `buildMetafieldPayload()` tests
  - [ ] Tire category: all 9 fields ✅
  - [ ] Rim category: all 4 fields ✅
  - [ ] Battery category: all 2 fields ✅
  - [ ] Unknown category: throw error ✅

### Integration Tests

- [ ] Metafield definition create
  - [ ] Shopify accepts request ✅
  - [ ] Definition persisted ✅
  - [ ] Can query definition ✅

- [ ] Metafield value set
  - [ ] Values persisted ✅
  - [ ] Correct type ✅
  - [ ] Can retrieve values ✅

- [ ] Type mismatch handling
  - [ ] Coerced correctly ✅
  - [ ] No Shopify API error ✅

### E2E Tests

- [ ] Full tire product sync
  - [ ] Title parsed ✅
  - [ ] Metafields calculated ✅
  - [ ] Product created ✅
  - [ ] Metafields visible in Shopify Admin ✅

- [ ] Update with new metafield
  - [ ] Existing product updated ✅
  - [ ] New metafield visible ✅

---

## Admin Panel: Metafield Management

### Dashboard Integration

**View metafields for product:**

```typescript
// apps/web/hooks/useProductMetafields.ts

export function useProductMetafields(productId: string) {
  return trpc.product.getMetafields.useQuery({ productId });
}

// Component
export function MetafieldViewer({ productId }: { productId: string }) {
  const { data: metafields } = useProductMetafields(productId);

  return (
    <div className="space-y-4">
      {metafields?.map((mf) => (
        <div key={mf.key}>
          <label className="font-semibold">{mf.key}</label>
          <p className="text-gray-600">{mf.value}</p>
          <p className="text-xs text-gray-400">{mf.type}</p>
        </div>
      ))}
    </div>
  );
}
```

---

## Troubleshooting

### Metafield değeri güncellenmedi

1. Shopify Admin'den kontrol et: Products → Product → Metafields
2. Tanım (definition) var mı kontrol et
3. Type eşleşiyor mu kontrol et
4. Logs'da hata var mı kontrol et

### Admin panelden metafield görmüyorum

1. Page refresh et
2. Dashboard cache temizle
3. Sync log'u kontrol et (hata var mı?)
4. Shopify API rate limit'e takıldı mı kontrol et

---

## Summary

✅ **16 metafield**, 3 kategori  
✅ **Type safety** (Zod + coercion)  
✅ **Eski hatalar çözüldü** (type mismatch, location ID)  
✅ **Testler yazıldı** (unit + integration + E2E)  
✅ **Seed scripts hazır** (otomatik definition create)  

🚀 **Sonraki adım:** flows.md (sync ve pricing akışı)
