import mockProducts from "../data/mock-products.json";

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
      allProducts = allProducts.concat(mockProducts.tires);
    }
    if (!category || category === "rim") {
      allProducts = allProducts.concat(mockProducts.rims);
    }
    if (!category || category === "battery") {
      allProducts = allProducts.concat(mockProducts.batteries);
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
    category?: "tire" | "rim" | "battery";
    page?: number;
    limit?: number;
  }): Promise<SupplierApiResponse> {
    if (!this.apiUrl || !this.apiKey) {
      throw new Error("Supplier API URL and API Key are required for real API calls");
    }

    const { category, page = 1, limit = 50 } = options || {};

    const url = new URL(`${this.apiUrl}/products`);
    if (category) url.searchParams.append("category", category);
    url.searchParams.append("page", page.toString());
    url.searchParams.append("limit", limit.toString());

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Supplier API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      products: data.products || [],
      total: data.total || 0,
      page: data.page || page,
      hasMore: data.hasMore || false,
    };
  }

  async getProductBySku(sku: string): Promise<SupplierProduct | null> {
    if (this.useMock) {
      const allProducts = [
        ...mockProducts.tires,
        ...mockProducts.rims,
        ...mockProducts.batteries,
      ];
      return allProducts.find((p) => p.supplierSku === sku) || null;
    }

    // Real API implementation
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

    return response.json();
  }
}
