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
  private apiUrl?: string;
  private apiKey?: string;

  constructor(config?: { useMock?: boolean; apiUrl?: string; apiKey?: string }) {
    this.useMock = config?.useMock ?? true;
    this.apiUrl = config?.apiUrl;
    this.apiKey = config?.apiKey;
  }

  async getProducts(options?: {
    category?: "tire" | "rim" | "battery";
    page?: number;
    limit?: number;
  }): Promise<SupplierApiResponse> {
    if (this.useMock) {
      return this.getMockProducts(options);
    }

    // Real API implementation (to be implemented later)
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
    page?: number;
    limit?: number;
  }): Promise<SupplierApiResponse> {
    const { category, page = 1, limit = 50 } = options || {};

    let url = process.env.SUPPLIER_API_ALL;

    if (category === "tire") url = process.env.SUPPLIER_API_LASTIK;
    if (category === "rim") url = process.env.SUPPLIER_API_JANT;
    if (category === "battery") url = process.env.SUPPLIER_API_AKU;
    if (category === "katalog") url = process.env.SUPPLIER_API_KATALOG;
    if (category === "jant_on_siparis") url = process.env.SUPPLIER_API_JANT_ON_SIPARIS;

    if (!url) {
      throw new Error(`Supplier API URL not found for category: ${category || 'all'}`);
    }

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Supplier API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as Record<string, any>;

    const rawProducts = Array.isArray(data) ? data : (data.products || data.data || []);
    
    const products: SupplierProduct[] = rawProducts.map((p: any, idx: number) => ({
      supplierSku: String(p.StokKodu || p.sku || p.id || p.SKU || p.stockCode || `unknown-${category}-${idx}`),
      title: String(p.StokAdi || p.name || p.title || p.UrunAdi || "Untitled"),
      brand: p.Marka || p.brand || p.Brand || "",
      model: p.Model || p.model || "",
      category: this.mapCategory(p, category),
      price: parseFloat(p.Fiyat || p.price || p.Price || p.SatisFiyati || "0"),
      stock: parseInt(p.StokAdet || p.stock || p.Stock || p.Adet || "0"),
      barcode: p.Barkod || p.barcode || "",
      description: p.Aciklama || p.description || "",
      images: p.Resimler || p.images || [],
      metafields: p
    }));

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedProducts = products.slice(startIndex, endIndex);

    return {
      products: paginatedProducts,
      total: products.length,
      page,
      hasMore: endIndex < products.length,
    };
  }

  private mapCategory(p: any, requestedCategory?: string): "tire" | "rim" | "battery" {
    if (requestedCategory === "tire") return "tire";
    if (requestedCategory === "rim") return "rim";
    if (requestedCategory === "battery") return "battery";
    
    const name = (p.StokAdi || "").toLowerCase();
    if (name.includes("lastik")) return "tire";
    if (name.includes("jant")) return "rim";
    if (name.includes("aku") || name.includes("akü")) return "battery";
    
    return "tire";
  }

  async getProductBySku(sku: string): Promise<SupplierProduct | null> {
    if (this.useMock) {
      const allProducts = [
        ...(mockProducts.tires as SupplierProduct[]),
        ...(mockProducts.rims as SupplierProduct[]),
        ...(mockProducts.batteries as SupplierProduct[]),
      ];
      return allProducts.find((p) => p.supplierSku === sku) || null;
    }

    if (!this.apiUrl || !this.apiKey) {
      throw new Error("Supplier API URL and API Key are required");
    }

    const response = await fetch(`${this.apiUrl}/products/${sku}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Supplier API error: ${response.status}`);
    }

    return response.json() as Promise<SupplierProduct>;
  }

  /**
   * API'den tüm ürünleri çeker ve veritabanına kaydeder (Ingestion).
   * TooManyConnections hatasını önlemek için veriyi yerel havuza toplar.
   */
  async fetchAndIngest(category: "tire" | "rim" | "battery", jobId?: number) {
    console.log(`Starting ingestion for category: ${category}`);
    
    let page = 1;
    let hasMore = true;
    const stats = {
      totalFetched: 0,
      created: 0,
      updated: 0,
      unchanged: 0,
      failed: 0
    };

    while (hasMore) {
      console.log(`Fetching page ${page} for ${category}...`);
      const response = await this.getProducts({ category, page, limit: 100 });
      
      if (response.products.length === 0) break;

      const upsertResult = await supplierProductService.upsertMany(
        response.products, 
        category, 
        jobId
      );

      stats.totalFetched += response.products.length;
      stats.created += upsertResult.created;
      stats.updated += upsertResult.updated;
      stats.unchanged += upsertResult.unchanged;
      stats.failed += upsertResult.failed;

      hasMore = response.hasMore;
      page++;

      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    console.log(`Ingestion completed for ${category}:`, stats);
    return stats;
  }
}