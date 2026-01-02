"use client";

import { useState } from "react";
import {
  Code, FileSearch, Tags, DollarSign, GitCompare,
  Copy, Check, AlertTriangle, CheckCircle2, XCircle,
  ChevronRight, ExternalLink, ChevronDown, Info
} from "lucide-react";
import { BottomDrawer, DrawerSize } from "../ui/BottomDrawer";

export type TabId = "raw" | "parsing" | "metafields" | "pricing" | "compare";

// Enhanced parsing field result from backend
interface ParsingFieldResult {
  field: string;
  value: any | null;
  success: boolean;
  reason?: string;
  pattern?: string;
  confidence?: number;
}

// Enhanced parsing result from backend
interface ParsingResult {
  success: boolean;
  rawTitle: string;
  fields: ParsingFieldResult[];
  data: Record<string, any> | null;
}

interface ParsedData {
  brand?: string;
  model?: string;
  width?: number;
  ratio?: number;
  diameter?: number;
  speedIndex?: string;
  loadIndex?: string;
  season?: string;
  runflat?: boolean;
  parseSuccess?: boolean;
  [key: string]: any;
}

interface MetafieldData {
  key: string;
  namespace: string;
  value: any;
  type: string;
  status: "valid" | "warning" | "error";
  message?: string;
}

interface PricingData {
  supplierPrice: number;
  calculatedPrice: number;
  margin: number;
  marginPercent: number;
  rule?: string;
  compareAtPrice?: number;
}

interface ShopifyProduct {
  id: string;
  title: string;
  price: number;
  inventory: number;
  status?: string;
  metafields?: Array<{
    namespace: string;
    key: string;
    value: string;
    type: string;
  }>;
}

// Enhanced change tracking from backend
interface ShopifyChange {
  field: string;
  oldValue: any;
  newValue: any;
  changeType: "update" | "add" | "remove";
}

export interface ProductDrawerData {
  supplierSku: string;
  title: string;
  category: "tire" | "rim" | "battery";
  rawData: Record<string, any>;
  parsedData?: ParsedData;
  parsingResult?: ParsingResult;  // New: detailed parsing result
  metafields?: MetafieldData[];
  pricing?: PricingData;
  shopifyProduct?: ShopifyProduct | null;
  shopifyChanges?: ShopifyChange[];  // New: change tracking
  shopifyLookupError?: string;  // New: error message if lookup failed
  summary?: {
    metafieldValid: number;
    metafieldWarning: number;
    metafieldError: number;
    parseSuccess: boolean;
    parseFieldsSuccess?: number;
    parseFieldsTotal?: number;
    hasShopifyProduct: boolean;
    shopifyChangesCount?: number;
    isNewProduct?: boolean;
  };
}

interface ProductDrawerProps {
  open: boolean;
  onClose: () => void;
  product: ProductDrawerData | null;
  activeTab?: TabId;
  onTabChange?: (tab: TabId) => void;
}

const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "raw", label: "API Ham Veri", icon: Code },
  { id: "parsing", label: "Parsing", icon: FileSearch },
  { id: "metafields", label: "Metafields", icon: Tags },
  { id: "pricing", label: "Fiyatlandırma", icon: DollarSign },
  { id: "compare", label: "Karsilastir", icon: GitCompare },
];

// Simple syntax highlighting for JSON
function highlightJson(json: string): React.ReactNode[] {
  const lines = json.split('\n');
  return lines.map((line, i) => {
    // Highlight keys
    let highlighted = line.replace(
      /"([^"]+)":/g,
      '<span class="text-blue-400">"$1"</span>:'
    );
    // Highlight string values
    highlighted = highlighted.replace(
      /: "([^"]*)"/g,
      ': <span class="text-green-400">"$1"</span>'
    );
    // Highlight numbers
    highlighted = highlighted.replace(
      /: (\d+\.?\d*)/g,
      ': <span class="text-amber-400">$1</span>'
    );
    // Highlight booleans
    highlighted = highlighted.replace(
      /: (true|false)/g,
      ': <span class="text-purple-400">$1</span>'
    );
    // Highlight null
    highlighted = highlighted.replace(
      /: (null)/g,
      ': <span class="text-red-400">$1</span>'
    );

    return (
      <div key={i} className="leading-5" dangerouslySetInnerHTML={{ __html: highlighted }} />
    );
  });
}

function JsonViewer({ data, title, highlightKeys }: { data: any; title?: string; highlightKeys?: string[] }) {
  const [copied, setCopied] = useState(false);
  const [useHighlighting, setUseHighlighting] = useState(true);

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const jsonString = JSON.stringify(data, null, 2);

  return (
    <div className="relative">
      {title && (
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-foreground">{title}</h4>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setUseHighlighting(!useHighlighting)}
              className="text-xs text-muted-foreground hover:text-foreground transition"
            >
              {useHighlighting ? "Raw" : "Highlight"}
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 text-green-500" />
                  <span className="text-green-500">Kopyalandi</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  <span>Kopyala</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
      <pre className="bg-zinc-900 border border-border rounded-lg p-4 overflow-auto text-xs font-mono max-h-96">
        {useHighlighting ? highlightJson(jsonString) : jsonString}
      </pre>
    </div>
  );
}

function RawDataTab({ data }: { data: Record<string, any> }) {
  return (
    <div className="p-4 space-y-4">
      <JsonViewer data={data} title="Supplier API Response" />
    </div>
  );
}

// Field label mapping for display
const FIELD_LABELS: Record<string, string> = {
  width: "Genişlik",
  aspectRatio: "Kesit Oranı",
  ratio: "Kesit Oranı",
  rimDiameter: "Jant Çapı",
  diameter: "Çap",
  loadIndex: "Yük İndeksi",
  speedIndex: "Hız İndeksi",
  season: "Mevsim",
  pcd: "PCD",
  offset: "ET (Offset)",
  capacity: "Kapasite",
  cca: "CCA",
  voltage: "Voltaj",
  brand: "Marka",
};

function ParsingTab({
  rawData,
  parsedData,
  parsingResult,
  category
}: {
  rawData: Record<string, any>;
  parsedData?: ParsedData;
  parsingResult?: ParsingResult;
  category: "tire" | "rim" | "battery";
}) {
  const [showTechnical, setShowTechnical] = useState(false);

  // Use parsingResult fields if available, otherwise fallback to old behavior
  const hasDetailedResult = parsingResult && parsingResult.fields.length > 0;

  // Fallback fields for old data format
  const fallbackFields = category === "tire"
    ? ["brand", "width", "aspectRatio", "rimDiameter", "loadIndex", "speedIndex", "season"]
    : category === "rim"
    ? ["brand", "width", "diameter", "pcd", "offset"]
    : ["brand", "capacity", "cca", "voltage"];

  const sourceTitle = parsingResult?.rawTitle || rawData.StokAdi || rawData.title || rawData.name || "-";

  // Calculate stats
  const successCount = parsingResult?.fields.filter(f => f.success).length ?? 0;
  const totalCount = parsingResult?.fields.length ?? 0;

  return (
    <div className="p-4 space-y-6">
      {/* Source Title with highlighting indicator */}
      <div className="bg-muted/30 border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-muted-foreground">📝 Kaynak Başlık</h4>
          {hasDetailedResult && (
            <span className={`text-xs px-2 py-0.5 rounded ${
              parsingResult.success
                ? "bg-green-500/10 text-green-600"
                : "bg-red-500/10 text-red-600"
            }`}>
              {successCount}/{totalCount} alan başarılı
            </span>
          )}
        </div>
        <p className="text-foreground font-mono text-sm break-all">
          {sourceTitle}
        </p>
      </div>

      {/* Detailed Field Results - New Format */}
      {hasDetailedResult ? (
        <div>
          <h4 className="text-sm font-medium text-foreground mb-3">Çıkarılan Veriler</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {parsingResult.fields.map((field) => {
              const label = FIELD_LABELS[field.field] || field.field;
              const confidencePercent = field.confidence ? Math.round(field.confidence * 100) : null;

              return (
                <div
                  key={field.field}
                  className={`p-3 rounded-lg border transition-all ${
                    field.success
                      ? "bg-green-500/5 border-green-500/30 hover:border-green-500/50"
                      : "bg-red-500/5 border-red-500/30 hover:border-red-500/50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      {field.success ? (
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                      ) : (
                        <XCircle className="h-3 w-3 text-red-500" />
                      )}
                      <span className="text-xs text-muted-foreground">
                        {label}
                      </span>
                    </div>
                    {confidencePercent !== null && field.success && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        confidencePercent >= 80
                          ? "bg-green-500/20 text-green-600"
                          : confidencePercent >= 50
                          ? "bg-amber-500/20 text-amber-600"
                          : "bg-red-500/20 text-red-600"
                      }`}>
                        {confidencePercent}%
                      </span>
                    )}
                  </div>
                  <p className={`text-sm font-medium ${
                    field.success ? "text-foreground" : "text-red-500"
                  }`}>
                    {field.value !== null && field.value !== undefined
                      ? String(field.value)
                      : "—"}
                  </p>
                  {!field.success && field.reason && (
                    <p className="text-[10px] text-red-400 mt-1 line-clamp-2">
                      {field.reason}
                    </p>
                  )}
                  {field.success && field.reason && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {field.reason}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        // Fallback to old display format
        <div>
          <h4 className="text-sm font-medium text-foreground mb-3">Çıkarılan Veriler</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {fallbackFields.map((field) => {
              const value = parsedData?.[field];
              const hasValue = value !== undefined && value !== null && value !== "";
              const label = FIELD_LABELS[field] || field;

              return (
                <div
                  key={field}
                  className={`p-3 rounded-lg border ${
                    hasValue
                      ? "bg-green-500/5 border-green-500/30"
                      : "bg-muted/30 border-border"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {hasValue ? (
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                    ) : (
                      <XCircle className="h-3 w-3 text-muted-foreground" />
                    )}
                    <span className="text-xs text-muted-foreground">
                      {label}
                    </span>
                  </div>
                  <p className={`text-sm font-medium ${
                    hasValue ? "text-foreground" : "text-muted-foreground"
                  }`}>
                    {hasValue ? String(value) : "Bulunamadı"}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Technical Details - Collapsible */}
      {hasDetailedResult && (
        <div className="border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => setShowTechnical(!showTechnical)}
            className="w-full flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 transition"
          >
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Teknik Detaylar</span>
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${
              showTechnical ? "rotate-180" : ""
            }`} />
          </button>
          {showTechnical && (
            <div className="p-3 bg-zinc-900 text-xs font-mono space-y-2">
              {parsingResult.fields.filter(f => f.pattern).map((field) => (
                <div key={field.field} className="flex items-start gap-2">
                  <span className="text-blue-400 min-w-24">{field.field}:</span>
                  <span className="text-amber-400 break-all">{field.pattern}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Full Parsed Data */}
      {(parsedData || parsingResult?.data) && (
        <JsonViewer
          data={parsingResult?.data || parsedData}
          title="Tam Parsing Sonucu"
        />
      )}
    </div>
  );
}

function MetafieldsTab({ metafields }: { metafields?: MetafieldData[] }) {
  if (!metafields || metafields.length === 0) {
    return (
      <div className="p-4">
        <div className="text-center py-8 text-muted-foreground">
          Metafield verisi yok
        </div>
      </div>
    );
  }

  const validCount = metafields.filter(m => m.status === "valid").length;
  const warningCount = metafields.filter(m => m.status === "warning").length;
  const errorCount = metafields.filter(m => m.status === "error").length;

  return (
    <div className="p-4 space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg">
        <span className="text-sm text-muted-foreground">Toplam: {metafields.length}</span>
        <span className="text-sm text-green-600 flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" /> {validCount} Gecerli
        </span>
        {warningCount > 0 && (
          <span className="text-sm text-amber-600 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> {warningCount} Uyari
          </span>
        )}
        {errorCount > 0 && (
          <span className="text-sm text-red-600 flex items-center gap-1">
            <XCircle className="h-3 w-3" /> {errorCount} Hata
          </span>
        )}
      </div>

      {/* Metafields Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Key</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Tip</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Deger</th>
              <th className="text-center px-3 py-2 font-medium text-muted-foreground">Durum</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {metafields.map((mf, idx) => (
              <tr key={idx} className="hover:bg-muted/30">
                <td className="px-3 py-2">
                  <span className="font-mono text-xs">
                    {mf.namespace}.{mf.key}
                  </span>
                </td>
                <td className="px-3 py-2 text-muted-foreground text-xs">
                  {mf.type}
                </td>
                <td className="px-3 py-2">
                  <span className="font-mono text-xs truncate block max-w-48">
                    {typeof mf.value === "object"
                      ? JSON.stringify(mf.value)
                      : String(mf.value)}
                  </span>
                </td>
                <td className="px-3 py-2 text-center">
                  {mf.status === "valid" && (
                    <CheckCircle2 className="h-4 w-4 text-green-500 inline" />
                  )}
                  {mf.status === "warning" && (
                    <AlertTriangle className="h-4 w-4 text-amber-500 inline" />
                  )}
                  {mf.status === "error" && (
                    <XCircle className="h-4 w-4 text-red-500 inline" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PricingTab({ pricing }: { pricing?: PricingData }) {
  if (!pricing) {
    return (
      <div className="p-4">
        <div className="text-center py-8 text-muted-foreground">
          Fiyatlandirma verisi yok
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* Price Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-muted/30 border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground mb-1">Tedarikci Fiyati</p>
          <p className="text-xl font-semibold text-foreground">
            {pricing.supplierPrice.toLocaleString("tr-TR")} TL
          </p>
        </div>
        <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
          <p className="text-xs text-primary mb-1">Satis Fiyati</p>
          <p className="text-xl font-semibold text-primary">
            {pricing.calculatedPrice.toLocaleString("tr-TR")} TL
          </p>
        </div>
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
          <p className="text-xs text-green-600 mb-1">Kar Marji</p>
          <p className="text-xl font-semibold text-green-600">
            {pricing.margin.toLocaleString("tr-TR")} TL
          </p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <p className="text-xs text-blue-600 mb-1">Kar Orani</p>
          <p className="text-xl font-semibold text-blue-600">
            %{pricing.marginPercent.toFixed(1)}
          </p>
        </div>
      </div>

      {/* Pricing Rule */}
      {pricing.rule && (
        <div className="bg-muted/30 border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Tags className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Uygulanan Kural</span>
          </div>
          <p className="text-sm text-muted-foreground">{pricing.rule}</p>
        </div>
      )}

      {/* Price Breakdown */}
      <div className="border border-border rounded-lg p-4">
        <h4 className="text-sm font-medium text-foreground mb-3">Fiyat Hesaplama</h4>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tedarikci Fiyati</span>
            <span className="font-mono">{pricing.supplierPrice.toLocaleString("tr-TR")} TL</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">+ Kar Marji ({pricing.marginPercent.toFixed(1)}%)</span>
            <span className="font-mono text-green-600">+{pricing.margin.toLocaleString("tr-TR")} TL</span>
          </div>
          <div className="border-t border-border pt-2 mt-2">
            <div className="flex justify-between text-sm font-medium">
              <span className="text-foreground">Satis Fiyati</span>
              <span className="font-mono text-primary">{pricing.calculatedPrice.toLocaleString("tr-TR")} TL</span>
            </div>
          </div>
          {pricing.compareAtPrice && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Karsilastirma Fiyati</span>
              <span className="font-mono line-through text-muted-foreground">
                {pricing.compareAtPrice.toLocaleString("tr-TR")} TL
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CompareTab({
  supplierData,
  shopifyProduct,
  shopifyChanges,
  shopifyLookupError
}: {
  supplierData: ProductDrawerData;
  shopifyProduct?: ShopifyProduct | null;
  shopifyChanges?: ShopifyChange[];
  shopifyLookupError?: string;
}) {
  // Show error if Shopify lookup failed
  if (shopifyLookupError) {
    return (
      <div className="p-4">
        <div className="text-center py-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 mb-3">
            <AlertTriangle className="h-6 w-6 text-red-500" />
          </div>
          <h3 className="text-sm font-medium text-foreground mb-1">Shopify Sorgu Hatasi</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            {shopifyLookupError}
          </p>
        </div>
      </div>
    );
  }

  // Show new product message
  if (!shopifyProduct) {
    return (
      <div className="p-4">
        <div className="text-center py-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-500/10 mb-3">
            <GitCompare className="h-6 w-6 text-blue-500" />
          </div>
          <h3 className="text-sm font-medium text-foreground mb-1">Yeni Urun</h3>
          <p className="text-sm text-muted-foreground">
            Bu urun Shopify'da mevcut degil. Sync isleminde olusturulacak.
          </p>
        </div>
      </div>
    );
  }

  // Use backend shopifyChanges if available, otherwise fallback to local comparison
  const hasBackendChanges = shopifyChanges && shopifyChanges.length > 0;

  // Fallback comparisons for backward compatibility
  const fallbackComparisons = [
    {
      label: "Baslik",
      supplier: supplierData.title,
      shopify: shopifyProduct.title,
      isDifferent: supplierData.title !== shopifyProduct.title
    },
    {
      label: "Fiyat",
      supplier: `${supplierData.pricing?.calculatedPrice?.toLocaleString("tr-TR")} TL`,
      shopify: `${shopifyProduct.price?.toLocaleString("tr-TR")} TL`,
      isDifferent: supplierData.pricing?.calculatedPrice !== shopifyProduct.price
    },
    {
      label: "Stok",
      supplier: String(supplierData.rawData.StokAdet || supplierData.rawData.stock || 0),
      shopify: String(shopifyProduct.inventory),
      isDifferent: (supplierData.rawData.StokAdet || supplierData.rawData.stock || 0) !== shopifyProduct.inventory
    },
  ];

  // Count changes
  const changeCount = hasBackendChanges
    ? shopifyChanges.length
    : fallbackComparisons.filter(c => c.isDifferent).length;

  const updateCount = hasBackendChanges
    ? shopifyChanges.filter(c => c.changeType === "update").length
    : changeCount;
  const addCount = hasBackendChanges
    ? shopifyChanges.filter(c => c.changeType === "add").length
    : 0;

  return (
    <div className="p-4 space-y-6">
      {/* Shopify Link */}
      <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
        <div>
          <p className="text-sm text-muted-foreground">Shopify Product ID</p>
          <p className="font-mono text-sm">{shopifyProduct.id}</p>
        </div>
        <a
          href={`https://admin.shopify.com/products/${shopifyProduct.id.replace("gid://shopify/Product/", "")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-sm text-primary hover:underline"
        >
          Shopify'da Ac <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {/* Status Badge */}
      <div className="flex items-center gap-3">
        {changeCount === 0 ? (
          <span className="text-sm px-3 py-1 rounded-full bg-green-500/10 text-green-600 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Guncel
          </span>
        ) : (
          <>
            {updateCount > 0 && (
              <span className="text-sm px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 flex items-center gap-1">
                <ChevronRight className="h-3 w-3" />
                {updateCount} Guncelleme
              </span>
            )}
            {addCount > 0 && (
              <span className="text-sm px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 flex items-center gap-1">
                + {addCount} Yeni Alan
              </span>
            )}
          </>
        )}
      </div>

      {/* Changes Table - Backend Format */}
      {hasBackendChanges && (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Alan</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Mevcut (Shopify)</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground w-10"></th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Yeni (Tedarikci)</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Tip</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shopifyChanges.map((change, idx) => (
                <tr key={idx} className={
                  change.changeType === "add"
                    ? "bg-blue-500/5"
                    : change.changeType === "update"
                    ? "bg-amber-500/5"
                    : "bg-red-500/5"
                }>
                  <td className="px-4 py-3 font-medium">{change.field}</td>
                  <td className="px-4 py-3">
                    <span className="text-muted-foreground font-mono text-xs">
                      {change.oldValue !== null && change.oldValue !== undefined
                        ? typeof change.oldValue === "object"
                          ? JSON.stringify(change.oldValue)
                          : String(change.oldValue)
                        : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <ChevronRight className={`h-4 w-4 inline ${
                      change.changeType === "add" ? "text-blue-500" :
                      change.changeType === "update" ? "text-amber-500" :
                      "text-red-500"
                    }`} />
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-mono text-xs ${
                      change.changeType === "add" ? "text-blue-600" :
                      change.changeType === "update" ? "text-amber-600" :
                      "text-red-600"
                    }`}>
                      {change.newValue !== null && change.newValue !== undefined
                        ? typeof change.newValue === "object"
                          ? JSON.stringify(change.newValue)
                          : String(change.newValue)
                        : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-[10px] uppercase px-2 py-0.5 rounded ${
                      change.changeType === "add"
                        ? "bg-blue-500/20 text-blue-600"
                        : change.changeType === "update"
                        ? "bg-amber-500/20 text-amber-600"
                        : "bg-red-500/20 text-red-600"
                    }`}>
                      {change.changeType === "add" ? "Yeni" :
                       change.changeType === "update" ? "Guncelle" : "Sil"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Fallback Comparison Table */}
      {!hasBackendChanges && (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Alan</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tedarikci</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground w-10"></th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Shopify</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {fallbackComparisons.map((comp, idx) => (
                <tr key={idx} className={comp.isDifferent ? "bg-amber-500/5" : ""}>
                  <td className="px-4 py-3 font-medium">{comp.label}</td>
                  <td className="px-4 py-3">
                    <span className={comp.isDifferent ? "text-amber-600" : ""}>
                      {comp.supplier}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {comp.isDifferent ? (
                      <ChevronRight className="h-4 w-4 text-amber-500 inline" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-green-500 inline" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={comp.isDifferent ? "text-muted-foreground" : ""}>
                      {comp.shopify}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Changes Summary */}
      {changeCount > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium text-amber-600">Degisiklik Tespit Edildi</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {changeCount} alan sync isleminde guncellenecek.
          </p>
        </div>
      )}
    </div>
  );
}

export function ProductDrawer({
  open,
  onClose,
  product,
  activeTab = "raw",
  onTabChange,
}: ProductDrawerProps) {
  const [internalTab, setInternalTab] = useState<TabId>(activeTab);
  const [drawerSize, setDrawerSize] = useState<DrawerSize>("half");

  const currentTab = onTabChange ? activeTab : internalTab;
  const handleTabChange = onTabChange || setInternalTab;

  if (!product) return null;

  return (
    <BottomDrawer
      open={open}
      onClose={onClose}
      title={product.title}
      subtitle={`SKU: ${product.supplierSku} | Kategori: ${product.category}`}
      size={drawerSize}
      onSizeChange={setDrawerSize}
    >
      <div className="flex flex-col h-full">
        {/* Tabs */}
        <div className="flex border-b border-border overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition ${
                  isActive
                    ? "text-primary border-b-2 border-primary bg-primary/5"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-auto">
          {currentTab === "raw" && <RawDataTab data={product.rawData} />}
          {currentTab === "parsing" && (
            <ParsingTab
              rawData={product.rawData}
              parsedData={product.parsedData}
              parsingResult={product.parsingResult}
              category={product.category}
            />
          )}
          {currentTab === "metafields" && (
            <MetafieldsTab metafields={product.metafields} />
          )}
          {currentTab === "pricing" && (
            <PricingTab pricing={product.pricing} />
          )}
          {currentTab === "compare" && (
            <CompareTab
              supplierData={product}
              shopifyProduct={product.shopifyProduct}
              shopifyChanges={product.shopifyChanges}
              shopifyLookupError={product.shopifyLookupError}
            />
          )}
        </div>
      </div>
    </BottomDrawer>
  );
}

export default ProductDrawer;
