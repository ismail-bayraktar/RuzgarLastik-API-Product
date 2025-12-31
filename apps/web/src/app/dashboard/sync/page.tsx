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

interface SyncStep {
  id: string;
  name: string;
  status: "pending" | "running" | "completed" | "error";
  message?: string;
  duration?: number;
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
  // State
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
// ...
  const previewMutation = useMutation({
    ...trpc.sync.preview.mutationOptions(),
    onMutate: () => {
      setStepStatuses({
        ingest: "running",
        parsing: "idle",
        metafields: "idle",
        pricing: "idle",
        shopify: "idle",
      });
      setActiveStep("ingest");
    },
    onSuccess: (data: any) => {
      // Check for rate limit error
      if (data.rateLimitError) {
        const { waitSeconds, message, category } = data.rateLimitError;
        setStepStatuses({
          ingest: "warning",
          parsing: "idle",
          metafields: "idle",
          pricing: "idle",
          shopify: "idle",
        });
        setActiveStep(undefined);
// ...
      } else {
        // Update step statuses based on response
        const hasErrors = data.errors.length > 0;
        setStepStatuses({
          ingest: "completed",
          parsing: hasErrors ? "warning" : "completed",
          metafields: "completed",
          pricing: "completed",
          shopify: "idle",
        });
        setActiveStep(undefined);
      }

      // Transform products (even if rate limited, we still show cached products)
      const transformedProducts: ProductPreview[] = data.products.map((p: any) => ({
        ...p,
        parsingSuccess: p.status !== "error",
        metafieldFill: Math.floor(Math.random() * 40) + 60, // TODO: Calculate from actual data
        shopifyStatus: "new" as const, // TODO: Get from actual Shopify lookup
        rawData: p.rawData || p.metafields || {}, // Include raw data from API
      }));

      setProducts(transformedProducts);
      setIsPreviewLoaded(true);

      queryClient.invalidateQueries({ queryKey: ["sync", "cacheStatus"] });

      // Show appropriate toast (if not rate limited)
      if (!data.rateLimitError) {
        if (data.errors.length > 0) {
          toast.warning(`${data.summary.total} ürün yüklendi, ${data.errors.length} hata var`);
        } else {
          const source = data.fromCache ? "cache'den" : "API'den";
          toast.success(`${data.summary.total} ürün ${source} yüklendi`);
        }
      }
    },
    onError: (error: Error) => {
      setStepStatuses(prev => ({ ...prev, api: "error" }));
      toast.error(`Önizleme hatası: ${error.message}`);
    },
  });

  const startSyncMutation = useMutation({
    ...trpc.sync.start.mutationOptions(),
    onMutate: () => {
      setStepStatuses(prev => ({ ...prev, shopify: "running" }));
      setActiveStep("shopify");
    },
    onSuccess: (data) => {
      setStepStatuses(prev => ({
        ...prev,
        shopify: data.success ? "completed" : "error",
      }));
      setActiveStep(undefined);

      if (data.success) {
        toast.success(data.message || "Sync tamamlandı!");
      } else {
        toast.error(data.message || "Sync başarısız");
      }
      queryClient.invalidateQueries({ queryKey: ["sync", "history"] });
    },
    onError: (error: Error) => {
      setStepStatuses(prev => ({ ...prev, shopify: "error" }));
      toast.error(`Sync hatası: ${error.message}`);
    },
  });

  // Handlers
  const handlePreview = useCallback(() => {
    const limit = syncMode === "test" ? testLimit : syncMode === "all" ? 1000 : 50;
    previewMutation.mutate({
      categories: selectedCategories as ("tire" | "rim" | "battery")[],
      productLimit: limit,
      forceRefresh,
    });
  }, [syncMode, testLimit, selectedCategories, forceRefresh, previewMutation]);

  const handleSync = useCallback((isDryRun?: boolean) => {
    // Use passed value or fall back to state
    const effectiveDryRun = isDryRun !== undefined ? isDryRun : dryRun;

    startSyncMutation.mutate({
      mode: syncMode === "all" ? "full" : "incremental",
      categories: selectedCategories as ("tire" | "rim" | "battery")[],
      dryRun: effectiveDryRun,
      testMode: syncMode === "test",
      productLimit: syncMode === "test" ? testLimit : undefined,
    });
  }, [syncMode, selectedCategories, dryRun, testLimit, startSyncMutation]);

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const toggleProductSelection = (sku: string) => {
    setSelectedProducts(prev => {
      const next = new Set(prev);
      if (next.has(sku)) {
        next.delete(sku);
      } else {
        next.add(sku);
      }
      return next;
    });
  };

  const selectAllProducts = () => {
    if (selectedProducts.size === filteredProducts.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(filteredProducts.map(p => p.supplierSku)));
    }
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
    // Set initial data from preview (will be enriched by productDetail query)
    const drawerData: ProductDrawerData = {
      supplierSku: product.supplierSku,
      title: product.title,
      category: product.category as "tire" | "rim" | "battery",
      rawData: product.rawData || {},
      parsedData: {
        brand: product.brand,
      },
      metafields: [],
      pricing: product.calculatedPrice ? {
        supplierPrice: product.price,
        calculatedPrice: product.calculatedPrice,
        margin: product.calculatedPrice - product.price,
        marginPercent: ((product.calculatedPrice - product.price) / product.price) * 100,
      } : undefined,
      shopifyProduct: null,
    };
    setSelectedProduct(drawerData);
    setDrawerTab("raw");
    setDrawerOpen(true);
  }, []);

  // Update drawer data when productDetail query completes
  const enrichedProduct = useCallback((): ProductDrawerData | null => {
    if (!selectedProduct) return null;

    const detail = productDetailQuery.data;
    if (!detail || !detail.success) return selectedProduct;

    return {
      supplierSku: selectedProduct.supplierSku,
      title: detail.title || selectedProduct.title,
      category: detail.category as "tire" | "rim" | "battery",
      rawData: detail.rawData || selectedProduct.rawData,
      parsedData: detail.parsedData,
      metafields: detail.metafields?.map(mf => ({
        key: mf.key,
        namespace: mf.namespace,
        value: mf.value,
        type: mf.type,
        status: mf.status as "valid" | "warning" | "error",
        message: mf.message,
      })),
      pricing: detail.pricing,
      shopifyProduct: detail.shopifyProduct,
    };
  }, [selectedProduct, productDetailQuery.data]);

  // Filter products
  const filteredProducts = products.filter(p => {
    if (searchQuery && !p.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !p.supplierSku.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (brandFilter.length > 0 && !brandFilter.includes(p.brand)) {
      return false;
    }
    if (statusFilter.length > 0 && !statusFilter.includes(p.status)) {
      return false;
    }
    return true;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredProducts.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

  // Reset to page 1 when filter changes
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  }, []);

  const handleBrandFilter = useCallback((brands: string[]) => {
    setBrandFilter(brands);
    setCurrentPage(1);
  }, []);

  const handleStatusFilter = useCallback((statuses: string[]) => {
    setStatusFilter(statuses);
    setCurrentPage(1);
  }, []);

  // Column toggle handler
  const toggleColumn = useCallback((columnId: string) => {
    setColumns(prev => prev.map(col =>
      col.id === columnId ? { ...col, visible: !col.visible } : col
    ));
  }, []);

  const isColumnVisible = useCallback((columnId: string) => {
    return columns.find(c => c.id === columnId)?.visible ?? true;
  }, [columns]);

  // Get unique brands for filter
  const uniqueBrands = [...new Set(products.map(p => p.brand).filter(Boolean))];

  const lastSync = syncHistory.data?.sessions?.[0];
  const isRunning = previewMutation.isPending || startSyncMutation.isPending || refreshCacheMutation.isPending;

  return (
    <div className="p-4 lg:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Senkronizasyon</h1>
          <p className="text-sm text-muted-foreground">Tedarikçi → Shopify ürün senkronizasyonu</p>
        </div>
        <button
          onClick={() => refreshCacheMutation.mutate({ categories: selectedCategories as ("tire" | "rim" | "battery")[] })}
          disabled={refreshCacheMutation.isPending}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-muted hover:bg-muted/80 rounded-lg transition disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshCacheMutation.isPending ? "animate-spin" : ""}`} />
          Cache Yenile
        </button>
      </div>

      {/* Status Widgets */}
      <StatusWidgets
        cacheStatus={cacheStatusQuery.data}
        lastSync={lastSync}
        isLoading={cacheStatusQuery.isLoading}
        errorCount={products.filter(p => p.status === "error").length}
        automation={automationQuery.data}
      />

      {/* Rate Limit Warning Banner */}
      {cacheStatusQuery.data?.rateLimitInfo && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center">
              <span className="text-xl">⏳</span>
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-amber-600 dark:text-amber-400">
                Tedarikçi API Rate Limit Aktif
              </h4>
              <p className="text-sm text-amber-600/80 dark:text-amber-400/80">
                {cacheStatusQuery.data.rateLimitInfo.message}
                {" • "}
                {getCategoryEmoji(cacheStatusQuery.data.rateLimitInfo.category)} {getCategoryLabel(cacheStatusQuery.data.rateLimitInfo.category)} kategorisi etkilendi.
                Cache'deki veriler gösteriliyor.
              </p>
            </div>
            <button
              onClick={() => queryClient.invalidateQueries({ queryKey: ["sync", "cacheStatus"] })}
              className="px-3 py-1.5 text-sm bg-amber-500/20 hover:bg-amber-500/30 text-amber-600 dark:text-amber-400 rounded-lg transition"
            >
              Durumu Kontrol Et
            </button>
          </div>
        </div>
      )}

      {/* Pipeline */}
      <SyncPipeline
        activeStep={activeStep}
        stepStatuses={stepStatuses}
        onStepClick={setActiveStep}
        isRunning={isRunning}
      />

      {/* Controls */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Categories */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Kategoriler:</span>
            {["tire", "rim", "battery"].map(cat => (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                className={`px-3 py-1.5 text-sm rounded-lg transition ${
                  selectedCategories.includes(cat)
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {getCategoryEmoji(cat)} {getCategoryLabel(cat)}
              </button>
            ))}
          </div>

          <div className="h-6 w-px bg-border" />

          {/* Sync Mode */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Mod:</span>
            <select
              value={syncMode}
              onChange={(e) => setSyncMode(e.target.value as SyncMode)}
              className="px-3 py-1.5 text-sm bg-muted border-0 rounded-lg focus:ring-2 focus:ring-primary"
            >
              <option value="test">Test ({testLimit} ürün)</option>
              <option value="selected">Seçili ({selectedProducts.size})</option>
              <option value="category">Kategori</option>
              <option value="all">Tümü</option>
            </select>

            {syncMode === "test" && (
              <input
                type="number"
                value={testLimit}
                onChange={(e) => setTestLimit(Math.max(1, Math.min(100, Number(e.target.value))))}
                className="w-16 px-2 py-1.5 text-sm bg-muted border-0 rounded-lg"
                min={1}
                max={100}
              />
            )}
          </div>

          <div className="h-6 w-px bg-border" />

          {/* Options */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={forceRefresh}
              onChange={(e) => setForceRefresh(e.target.checked)}
              className="w-4 h-4 rounded border-input"
            />
            <span className="text-sm text-muted-foreground">Zorla Yenile</span>
          </label>

          <div className="flex-1" />

          {/* Action Buttons */}
          <button
            onClick={handlePreview}
            disabled={previewMutation.isPending || selectedCategories.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-muted hover:bg-muted/80 rounded-lg transition disabled:opacity-50"
          >
            {previewMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
            Önizle
          </button>

          {/* Dry Run Button - Test without sending to Shopify */}
          <button
            onClick={() => handleSync(true)}
            disabled={startSyncMutation.isPending || !isPreviewLoaded || selectedCategories.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg transition disabled:opacity-50"
            title="Shopify'a göndermeden test et"
          >
            {startSyncMutation.isPending && dryRun ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <TestTube className="h-4 w-4" />
            )}
            Test Et
          </button>

          {/* Real Sync Button - Send to Shopify */}
          <button
            onClick={() => handleSync(false)}
            disabled={startSyncMutation.isPending || !isPreviewLoaded || selectedCategories.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white hover:bg-green-700 rounded-lg transition disabled:opacity-50"
            title="Ürünleri Shopify'a gönder"
          >
            {startSyncMutation.isPending && !dryRun ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Shopify'a Gönder
          </button>
        </div>
      </div>

      {/* Products Table */}
      {isPreviewLoaded && (
        <div className="bg-card border border-border rounded-lg">
          {/* Table Header */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h3 className="text-sm font-medium text-foreground">
                  Ürünler ({filteredProducts.length})
                </h3>
                {selectedProducts.size > 0 && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                    {selectedProducts.size} seçili
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder="SKU veya başlık ara..."
                    className="pl-9 pr-4 py-2 text-sm bg-muted border-0 rounded-lg w-64 focus:ring-2 focus:ring-primary"
                  />
                </div>

                {/* Filter Toggle */}
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`p-2 rounded-lg transition ${
                    showFilters || brandFilter.length > 0 || statusFilter.length > 0
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80"
                  }`}
                >
                  <Filter className="h-4 w-4" />
                </button>

                {/* Columns Menu */}
                <div className="relative">
                  <button
                    onClick={() => setShowColumnMenu(!showColumnMenu)}
                    className={`p-2 rounded-lg transition ${
                      showColumnMenu ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
                    }`}
                  >
                    <Columns className="h-4 w-4" />
                  </button>
                  {showColumnMenu && (
                    <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg z-50 py-2 min-w-[160px]">
                      <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground border-b border-border mb-1">
                        Görünür Kolonlar
                      </div>
                      {columns.map(col => (
                        <button
                          key={col.id}
                          onClick={() => toggleColumn(col.id)}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted transition text-left"
                        >
                          <span className={`w-4 h-4 rounded border flex items-center justify-center ${
                            col.visible
                              ? "bg-primary border-primary"
                              : "border-input"
                          }`}>
                            {col.visible && <Check className="h-3 w-3 text-primary-foreground" />}
                          </span>
                          {col.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Filters Panel */}
            {showFilters && (
              <div className="mt-4 pt-4 border-t border-border flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Marka:</span>
                  <select
                    value={brandFilter[0] || ""}
                    onChange={(e) => handleBrandFilter(e.target.value ? [e.target.value] : [])}
                    className="px-2 py-1 text-xs bg-muted border-0 rounded"
                  >
                    <option value="">Tümü</option>
                    {uniqueBrands.map(brand => (
                      <option key={brand} value={brand}>{brand}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Durum:</span>
                  <select
                    value={statusFilter[0] || ""}
                    onChange={(e) => handleStatusFilter(e.target.value ? [e.target.value] : [])}
                    className="px-2 py-1 text-xs bg-muted border-0 rounded"
                  >
                    <option value="">Tümü</option>
                    <option value="success">Başarılı</option>
                    <option value="error">Hatalı</option>
                    <option value="pending">Bekliyor</option>
                  </select>
                </div>

                {(brandFilter.length > 0 || statusFilter.length > 0) && (
                  <button
                    onClick={() => { handleBrandFilter([]); handleStatusFilter([]); }}
                    className="text-xs text-red-600 hover:text-red-700"
                  >
                    Temizle
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="w-12 px-4 py-3">
                    <button onClick={selectAllProducts} className="text-muted-foreground hover:text-foreground">
                      {selectedProducts.size === paginatedProducts.length && paginatedProducts.length > 0 ? (
                        <CheckSquare className="h-4 w-4" />
                      ) : selectedProducts.size > 0 ? (
                        <Minus className="h-4 w-4" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                  </th>
                  {isColumnVisible("sku") && <th className="text-left px-4 py-3 font-medium text-muted-foreground">SKU</th>}
                  {isColumnVisible("title") && <th className="text-left px-4 py-3 font-medium text-muted-foreground">Başlık</th>}
                  {isColumnVisible("brand") && <th className="text-left px-4 py-3 font-medium text-muted-foreground">Marka</th>}
                  {isColumnVisible("category") && <th className="text-left px-4 py-3 font-medium text-muted-foreground">Kategori</th>}
                  {isColumnVisible("buyPrice") && <th className="text-right px-4 py-3 font-medium text-muted-foreground">Alış</th>}
                  {isColumnVisible("sellPrice") && <th className="text-right px-4 py-3 font-medium text-muted-foreground">Satış</th>}
                  {isColumnVisible("stock") && <th className="text-right px-4 py-3 font-medium text-muted-foreground">Stok</th>}
                  {isColumnVisible("parsing") && <th className="text-center px-4 py-3 font-medium text-muted-foreground">Parsing</th>}
                  {isColumnVisible("metafield") && <th className="text-center px-4 py-3 font-medium text-muted-foreground">Metafield</th>}
                  {isColumnVisible("shopify") && <th className="text-center px-4 py-3 font-medium text-muted-foreground">Shopify</th>}
                </tr>
              </thead>
              <tbody>
                {paginatedProducts.map((product) => (
                  <tr
                    key={product.supplierSku}
                    className={`border-b border-border/50 hover:bg-muted/30 cursor-pointer ${
                      selectedProducts.has(product.supplierSku) ? "bg-primary/5" : ""
                    }`}
                    onClick={() => openProductDrawer(product)}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => toggleProductSelection(product.supplierSku)}>
                        {selectedProducts.has(product.supplierSku) ? (
                          <CheckSquare className="h-4 w-4 text-primary" />
                        ) : (
                          <Square className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                    </td>
                    {isColumnVisible("sku") && (
                      <td className="px-4 py-3 font-mono text-xs">{product.supplierSku}</td>
                    )}
                    {isColumnVisible("title") && (
                      <td className="px-4 py-3">
                        <span className="line-clamp-1" title={product.title}>
                          {product.title.length > 35 ? product.title.slice(0, 35) + "..." : product.title}
                        </span>
                      </td>
                    )}
                    {isColumnVisible("brand") && (
                      <td className="px-4 py-3">{product.brand || "-"}</td>
                    )}
                    {isColumnVisible("category") && (
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded ${
                          product.category === "tire" ? "bg-blue-500/10 text-blue-600" :
                          product.category === "rim" ? "bg-purple-500/10 text-purple-600" :
                          "bg-green-500/10 text-green-600"
                        }`}>
                          {getCategoryEmoji(product.category)} {getCategoryLabel(product.category)}
                        </span>
                      </td>
                    )}
                    {isColumnVisible("buyPrice") && (
                      <td className="px-4 py-3 text-right font-mono">
                        {product.price.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺
                      </td>
                    )}
                    {isColumnVisible("sellPrice") && (
                      <td className="px-4 py-3 text-right font-mono text-green-600">
                        {product.calculatedPrice?.toLocaleString("tr-TR", { minimumFractionDigits: 2 }) || "-"} ₺
                      </td>
                    )}
                    {isColumnVisible("stock") && (
                      <td className="px-4 py-3 text-right">{product.stock}</td>
                    )}
                    {isColumnVisible("parsing") && (
                      <td className="px-4 py-3 text-center">
                        {product.parsingSuccess !== false ? (
                          <span className="text-green-600">✓</span>
                        ) : (
                          <span className="text-red-600">✗</span>
                        )}
                      </td>
                    )}
                    {isColumnVisible("metafield") && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500"
                              style={{ width: `${product.metafieldFill || 0}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">{product.metafieldFill || 0}%</span>
                        </div>
                      </td>
                    )}
                    {isColumnVisible("shopify") && (
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs px-2 py-1 rounded ${
                          product.shopifyStatus === "new" ? "bg-green-500/10 text-green-600" :
                          product.shopifyStatus === "update" ? "bg-blue-500/10 text-blue-600" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {product.shopifyStatus === "new" ? "Yeni" :
                           product.shopifyStatus === "update" ? "Güncelle" : "Aynı"}
                        </span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table Footer with Pagination */}
          <div className="p-4 border-t border-border flex items-center justify-between text-sm">
            <div className="flex items-center gap-4 text-muted-foreground">
              <span>
                Toplam: {filteredProducts.length} ürün
                {selectedProducts.size > 0 && ` • ${selectedProducts.size} seçili`}
              </span>
              <span>•</span>
              <span>
                Gösterilen: {startIndex + 1}-{Math.min(endIndex, filteredProducts.length)}
              </span>
            </div>

            <div className="flex items-center gap-4">
              {/* Page Size Selector */}
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Sayfa başına:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 text-sm bg-muted border-0 rounded"
                >
                  {PAGE_SIZE_OPTIONS.map(size => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </div>

              {/* Page Navigation */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                  title="İlk sayfa"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <ChevronLeft className="h-4 w-4 -ml-2" />
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Önceki sayfa"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <div className="flex items-center gap-1 px-2">
                  <input
                    type="number"
                    value={currentPage}
                    onChange={(e) => {
                      const page = Math.max(1, Math.min(totalPages, Number(e.target.value)));
                      setCurrentPage(page);
                    }}
                    min={1}
                    max={totalPages}
                    className="w-12 px-2 py-1 text-center text-sm bg-muted border-0 rounded"
                  />
                  <span className="text-muted-foreground">/ {totalPages || 1}</span>
                </div>

                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="p-1.5 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Sonraki sayfa"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage >= totalPages}
                  className="p-1.5 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Son sayfa"
                >
                  <ChevronRight className="h-4 w-4" />
                  <ChevronRight className="h-4 w-4 -ml-2" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isPreviewLoaded && !previewMutation.isPending && (
        <div className="bg-card border border-border rounded-lg p-12 text-center">
          <Eye className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">Önizleme Yok</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Sync işlemine başlamadan önce "Önizle" butonuna tıklayarak ürünleri görüntüleyin.
          </p>
          <button
            onClick={handlePreview}
            disabled={selectedCategories.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition disabled:opacity-50"
          >
            <Eye className="h-4 w-4" />
            Önizlemeyi Başlat
          </button>
        </div>
      )}

      {/* Product Detail Drawer */}
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
