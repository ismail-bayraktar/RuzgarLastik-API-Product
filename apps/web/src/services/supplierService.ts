import mockProducts from "../../data/mock-products.json";
import { supplierProductService } from "./supplierProductService";

export interface SupplierProduct {
  supplierSku: string;
  title: string;
  brand: string;
  model: string;
  category: "tire" | "rim" | "battery";
  price: number;
  stock: number;
  barcode?: string;
  description?: string;
  images?: string[];
  metafields?: Record<string, any>;
}

export interface SupplierApiResponse {
  products: SupplierProduct[];
  total: number;
  page: number;
  hasMore: boolean;
}

export class SupplierService {
  private useMock: boolean;

  constructor(config?: { useMock?: boolean }) {
    this.useMock = config?.useMock ?? (process.env.USE_MOCK_SUPPLIER === "true");
  }

  async getProducts(options?: {
    category?: "tire" | "rim" | "battery";
    page?: number;
    limit?: number;
  }): Promise<SupplierApiResponse> {
    if (this.useMock) {
      return this.getMockProducts(options);
    }

    return this.getRealProducts(options);
  }

  private getMockProducts(options?: {
    category?: "tire" | "rim" | "battery";
    page?: number;
    limit?: number;
  }): SupplierApiResponse {
    const { category, page = 1, limit = 50 } = options || {};
    
    let allProducts: SupplierProduct[] = [];

    if (!category || category === "tire") {
      allProducts = allProducts.concat(mockProducts.tires as SupplierProduct[]);
    }
    if (!category || category === "rim") {
      allProducts = allProducts.concat(mockProducts.rims as SupplierProduct[]);
    }
    if (!category || category === "battery") {
      allProducts = allProducts.concat(mockProducts.batteries as SupplierProduct[]);
    }

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedProducts = allProducts.slice(startIndex, endIndex);

    return {
      products: paginatedProducts,
      total: allProducts.length,
      page,
      hasMore: endIndex < allProducts.length,
    };
  }

  private async getRealProducts(options?: {
    category?: string;
  }): Promise<SupplierProduct[]> {
    const baseUrl = process.env.SUPPLIER_API_URL;
    const customerId = process.env.SUPPLIER_CUSTOMER_ID;
    const apiKey = process.env.SUPPLIER_API_KEY;

    if (!baseUrl || !customerId || !apiKey) {
      throw new Error("Supplier API configuration is incomplete");
    }

    const categoryIds: Record<string, string | undefined> = {
        "tire": process.env.CATEGORY_ID_LASTIK,
        "rim": process.env.CATEGORY_ID_JANT,
        "battery": process.env.CATEGORY_ID_AKU,
        "catalog": process.env.CATEGORY_ID_CATALOG
    };

    const category = options?.category || "tire";
    const catId = categoryIds[category];
    const url = `${baseUrl}/${customerId}/${apiKey}/${catId || ""}`;

    console.log(`[SupplierService] Fetching ALL products for ${category} from: ${url}`);
    
    let response: Response | null = null;
    let attempts = 0;
    const maxAttempts = 5;
    
    while (attempts < maxAttempts) {
      try {
        response = await fetch(url);
        
        if (response.status === 429) {
          const waitTime = 5000 * Math.pow(2, attempts);
          console.warn(`[SupplierService] Rate limit (429). Sabırla bekleniyor: ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          attempts++;
          continue;
        }

        if (!response.ok) {
          throw new Error(`Supplier API error: ${response.status} ${response.statusText}`);
        }
        break;
      } catch (error: any) {
        attempts++;
        if (attempts >= maxAttempts) throw error;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    if (!response || !response.ok) {
      throw new Error("Failed to fetch from Supplier API after retries");
    }

    const data = await response.json() as any;
    const rawProducts = Array.isArray(data) ? data : (data.products || data.data || []);
    
    console.log(`[SupplierService] Received ${rawProducts.length} products for ${category}`);

    return rawProducts.map((p: any, idx: number) => {
      // Sayısal değerleri güvenli bir şekilde alalım
      const rawPrice = parseFloat(p.currentPrice || p.Fiyat || "0");
      const rawStock = parseFloat(p.amount || p.StokAdet || "0");

      return {
        supplierSku: String(p.erpCode || p.productId || p.StokKodu || p.sku || `unknown-${category}-${idx}`),
        title: String(p.title || p.StokAdi || "Untitled"),
        brand: p.brandTitle || p.Marka || "",
        model: p.model || p.Model || "",
        category: category as any,
        price: isNaN(rawPrice) ? 0 : rawPrice,
        stock: isNaN(rawStock) ? 0 : Math.floor(rawStock), // Float gelirse aşağı yuvarla
        barcode: p.Barkod || p.barcode || "",
        description: p.description || p.Aciklama || "",
        images: p.image ? [p.image] : (p.Resimler || []),
        metafields: p
      };
    });
  }

  async fetchAndIngest(category: "tire" | "rim" | "battery", jobId?: number) {
    const products = await this.getRealProducts({ category });
    
    if (products.length === 0) {
      return { totalFetched: 0, created: 0, updated: 0, unchanged: 0, failed: 0 };
    }

    console.log(`[SupplierService] Upserting ${products.length} products to database...`);
    
    // Chunking implementation
    const chunkSize = 50;
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalUnchanged = 0;
    let totalFailed = 0;

    for (let i = 0; i < products.length; i += chunkSize) {
      const chunk = products.slice(i, i + chunkSize);
      console.log(`[SupplierService] Processing chunk ${i / chunkSize + 1}/${Math.ceil(products.length / chunkSize)} (${chunk.length} products)...`);
      
      const chunkResult = await supplierProductService.upsertMany(
        chunk, 
        category, 
        jobId
      );

      totalCreated += chunkResult.created;
      totalUpdated += chunkResult.updated;
      totalUnchanged += chunkResult.unchanged;
      totalFailed += chunkResult.failed;
    }

    return {
      totalFetched: products.length,
      created: totalCreated,
      updated: totalUpdated,
      unchanged: totalUnchanged,
      failed: totalFailed
    };
  }
}
