"use client";

import { useState, useCallback } from "react";
import { trpc, queryClient } from "@/utils/trpc";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Play, Loader2, RefreshCw, Eye, Settings2,
  Filter, Columns, ChevronDown, ChevronLeft, ChevronRight, Search,
  CheckSquare, Square, Minus, Check, Upload, TestTube
} from "lucide-react";

import { StatusWidgets } from "@/components/sync/StatusWidgets";
import { SyncPipeline, type PipelineStep, type StepStatus } from "@/components/sync/SyncPipeline";
import { ProductDrawer, type ProductDrawerData, type TabId } from "@/components/sync/ProductDrawer";

// Types
interface ProductPreview {
  supplierSku: string;
  title: string;
  brand: string;
  category: string;
  price: number;
  calculatedPrice?: number;
  stock: number;
  status: "pending" | "success" | "error" | "skipped";
  error?: string;
  parsingSuccess?: boolean;
  metafieldFill?: number;
  shopifyStatus?: "new" | "update" | "same";
  rawData?: Record<string, unknown>;
}

type SyncMode = "test" | "selected" | "category" | "all";

// Column configuration
interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
}

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: "sku", label: "SKU", visible: true },
  { id: "title", label: "Başlık", visible: true },
  { id: "brand", label: "Marka", visible: true },
  { id: "category", label: "Kategori", visible: true },
  { id: "buyPrice", label: "Alış", visible: true },
  { id: "sellPrice", label: "Satış", visible: true },
  { id: "stock", label: "Stok", visible: true },
  { id: "parsing", label: "Parsing", visible: true },
  { id: "metafield", label: "Metafield", visible: true },
  { id: "shopify", label: "Shopify", visible: true },
];

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

// Helper functions
const getCategoryLabel = (cat: string) => {
  switch (cat) {
    case "tire": return "Lastik";
    case "rim": return "Jant";
    case "battery": return "Akü";
    default: return cat;
  }
};

const getCategoryEmoji = (cat: string) => {
  switch (cat) {
    case "tire": return "🛞";
    case "rim": return "⚙️";
    case "battery": return "🔋";
    default: return "📦";
  }
};

export default function SyncPage() {
  // --- States ---
  const [syncMode, setSyncMode] = useState<SyncMode>("test");
  const [testLimit, setTestLimit] = useState(5);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(["tire", "rim", "battery"]);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [activeStep, setActiveStep] = useState<PipelineStep | undefined>();
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>({
    ingest: "idle",
    parsing: "idle",
    metafields: "idle",
    pricing: "idle",
    shopify: "idle",
  });
  const [products, setProducts] = useState<ProductPreview[]>([]);
  const [isPreviewLoaded, setIsPreviewLoaded] = useState(false);
  const [forceRefresh, setForceRefresh] = useState(false);
  const [dryRun, setDryRun] = useState(true);

  // Drawer States
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductDrawerData | null>(null);
  const [drawerTab, setDrawerTab] = useState<TabId>("raw");

  // Filters
  const [brandFilter, setBrandFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Column Toggle
  const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);
  const [showColumnMenu, setShowColumnMenu] = useState(false);

  // --- Queries ---
  const cacheStatusQuery = useQuery({
    ...trpc.sync.cacheStatus.queryOptions(),
    refetchInterval: 30000,
  });

  const syncHistory = useQuery(trpc.sync.history.queryOptions({ limit: 5 }));
  const automationQuery = useQuery(trpc.settings.getNextSyncTime.queryOptions());

  // --- Mutations ---
  const refreshCacheMutation = useMutation({
    ...(trpc.sync.refreshCache.mutationOptions() as any),
    onSuccess: (data: any) => {
      if (data.rateLimitError) {
        toast.error(`API Rate Limit: ${data.rateLimitError.message}`);
      } else {
        toast.success("Cache yenilendi!");
      }
      queryClient.invalidateQueries({ queryKey: ["sync", "cacheStatus"] });
    },
  });

  const previewMutation = useMutation({
    ...(trpc.sync.preview.mutationOptions() as any),
    onMutate: () => {
      setStepStatuses({ ingest: "running", parsing: "idle", metafields: "idle", pricing: "idle", shopify: "idle" });
      setActiveStep("ingest");
    },
    onSuccess: (data: any) => {
      setStepStatuses({ ingest: "completed", parsing: "completed", metafields: "completed", pricing: "completed", shopify: "idle" });
      setActiveStep(undefined);
      
      const transformedProducts: ProductPreview[] = data.products.map((p: any) => ({
        ...p,
        parsingSuccess: p.status !== "error",
        metafieldFill: 85,
        shopifyStatus: "new",
        rawData: p.rawData || p.metafields || {},
      }));

      setProducts(transformedProducts);
      setIsPreviewLoaded(true);
    },
    onError: (error: Error) => {
      setStepStatuses(prev => ({ ...prev, ingest: "error" }));
      toast.error(`Önizleme hatası: ${error.message}`);
    },
  });

  const startSyncMutation = useMutation({
    ...(trpc.sync.start.mutationOptions() as any),
    onMutate: () => {
      setStepStatuses(prev => ({ ...prev, shopify: "running" }));
      setActiveStep("shopify");
    },
    onSuccess: (data: any) => {
      setStepStatuses(prev => ({ ...prev, shopify: data.success ? "completed" : "error" }));
      setActiveStep(undefined);
      toast.success(data.message || "Sync tamamlandı!");
      queryClient.invalidateQueries({ queryKey: ["sync", "history"] });
    },
  });

  // --- Handlers ---
  const handlePreview = useCallback(() => {
    (previewMutation.mutate as any)({
      categories: selectedCategories as any,
      productLimit: syncMode === "test" ? testLimit : 50,
      forceRefresh,
    });
  }, [syncMode, testLimit, selectedCategories, forceRefresh, previewMutation]);

  const handleSync = useCallback((isDryRun?: boolean) => {
    (startSyncMutation.mutate as any)({
      mode: syncMode === "all" ? "full" : "incremental",
      categories: selectedCategories as any,
      dryRun: isDryRun !== undefined ? isDryRun : dryRun,
    });
  }, [syncMode, selectedCategories, dryRun, startSyncMutation]);

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev =>
      prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
    );
  };

  // Product detail query
  const productDetailQuery = useQuery({
    ...trpc.sync.productDetail.queryOptions({
      supplierSku: selectedProduct?.supplierSku || "",
      category: selectedProduct?.category,
    }),
    enabled: drawerOpen && !!selectedProduct?.supplierSku,
  });

  const openProductDrawer = useCallback((product: ProductPreview) => {
    const drawerData: ProductDrawerData = {
      supplierSku: product.supplierSku,
      title: product.title,
      category: product.category as any,
      rawData: product.rawData || {},
      parsedData: { brand: product.brand },
      metafields: [],
      shopifyProduct: null,
    };
    setSelectedProduct(drawerData);
    setDrawerTab("raw");
    setDrawerOpen(true);
  }, []);

  const enrichedProduct = useCallback((): ProductDrawerData | null => {
    if (!selectedProduct) return null;
    const detail = productDetailQuery.data as any;
    if (!detail || !detail.success) return selectedProduct;

    return {
      ...selectedProduct,
      title: detail.title || selectedProduct.title,
      rawData: detail.rawData || selectedProduct.rawData,
      parsedData: detail.parsedData,
      parsingResult: detail.parsingResult,
      metafields: detail.metafields as any,
      pricing: detail.pricing as any,
      shopifyProduct: detail.shopifyProduct as any,
    };
  }, [selectedProduct, productDetailQuery.data]);

  const filteredProducts = products.filter(p => {
    if (searchQuery && !p.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !p.supplierSku.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (brandFilter.length > 0 && !brandFilter.includes(p.brand)) return false;
    return true;
  });

  const paginatedProducts = filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const isRunning = previewMutation.isPending || startSyncMutation.isPending || refreshCacheMutation.isPending;

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Senkronizasyon</h1>
          <p className="text-sm text-muted-foreground">Tedarikçi → Shopify ürün senkronizasyonu</p>
        </div>
        <button
          onClick={() => (refreshCacheMutation.mutate as any)({ categories: selectedCategories as any })}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-muted rounded-lg"
        >
          <RefreshCw className={`h-4 w-4 ${refreshCacheMutation.isPending ? "animate-spin" : ""}`} />
          Cache Yenile
        </button>
      </div>

      <StatusWidgets
        cacheStatus={cacheStatusQuery.data}
        lastSync={syncHistory.data?.sessions?.[0] as any}
        isLoading={cacheStatusQuery.isLoading}
        automation={automationQuery.data}
      />

      <SyncPipeline
        activeStep={activeStep}
        stepStatuses={stepStatuses as any}
        isRunning={isRunning}
      />

      <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-6">
            {/* Categories */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Kategoriler:</span>
              <div className="flex gap-1">
                {["tire", "rim", "battery"].map(cat => (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md border transition ${
                      selectedCategories.includes(cat) 
                        ? "bg-primary/10 border-primary/50 text-primary" 
                        : "bg-muted/50 border-transparent text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {getCategoryEmoji(cat)} {getCategoryLabel(cat)}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-8 w-px bg-border hidden sm:block" />

            {/* Mode Selection */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Mod:</span>
              <select 
                value={syncMode} 
                onChange={(e) => setSyncMode(e.target.value as any)}
                className="h-8 text-sm bg-background border border-border rounded-md px-2 focus:ring-1 focus:ring-primary outline-none"
              >
                <option value="incremental">Incremental (Sadece Değişenler)</option>
                <option value="all">Full (Hepsini Zorla)</option>
              </select>
            </div>

            {/* Limit Input */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Limit:</span>
              <input 
                type="number" 
                value={testLimit}
                onChange={(e) => setTestLimit(parseInt(e.target.value) || 5)}
                className="h-8 w-20 text-sm bg-background border border-border rounded-md px-2 focus:ring-1 focus:ring-primary outline-none"
                min={1}
                max={500}
              />
            </div>

            {/* Dry Run Toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <div className={`w-4 h-4 rounded border flex items-center justify-center transition ${
                dryRun ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground"
              }`}>
                {dryRun && <Check className="w-3 h-3" />}
              </div>
              <input 
                type="checkbox" 
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                className="hidden"
              />
              <span className="text-sm font-medium text-muted-foreground">Dry Run (Test Modu)</span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
             <button 
              onClick={handlePreview} 
              disabled={isRunning} 
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted rounded-lg transition"
            >
              <Eye className="h-4 w-4" /> 
              Önizle
            </button>

            <button 
              onClick={() => handleSync(undefined)} // Use state values
              disabled={isRunning || (!isPreviewLoaded && syncMode !== "all")} 
              className={`inline-flex items-center gap-2 px-6 py-2 text-sm font-medium rounded-lg transition shadow-sm ${
                dryRun 
                  ? "bg-amber-500/10 text-amber-600 border border-amber-500/20 hover:bg-amber-500/20" 
                  : "bg-green-600 text-white hover:bg-green-700"
              }`}
            >
              {dryRun ? <TestTube className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
              {dryRun ? "Simülasyon Başlat" : "Shopify'a Gönder"}
            </button>
          </div>
      </div>

      {isPreviewLoaded && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-medium">Ürünler ({filteredProducts.length})</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ara..."
                className="pl-9 pr-4 py-2 text-sm bg-muted border-0 rounded-lg w-64"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Başlık</th>
                  <th className="px-4 py-3">Kategori</th>
                  <th className="px-4 py-3 text-right">Alış</th>
                  <th className="px-4 py-3 text-right">Stok</th>
                  <th className="px-4 py-3 text-center">Parsing</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProducts.map((p) => (
                  <tr key={p.supplierSku} onClick={() => openProductDrawer(p)} className="border-b border-border/50 hover:bg-muted/30 cursor-pointer">
                    <td className="px-4 py-3 font-mono text-xs">{p.supplierSku}</td>
                    <td className="px-4 py-3 line-clamp-1">{p.title}</td>
                    <td className="px-4 py-3">{getCategoryLabel(p.category)}</td>
                    <td className="px-4 py-3 text-right">{p.price.toLocaleString("tr-TR")} ₺</td>
                    <td className="px-4 py-3 text-right">{p.stock}</td>
                    <td className="px-4 py-3 text-center">{p.parsingSuccess ? "✅" : "❌"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ProductDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        product={enrichedProduct()}
        activeTab={drawerTab}
        onTabChange={setDrawerTab}
      />
    </div>
  );
}