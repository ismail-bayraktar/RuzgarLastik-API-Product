"use client";

import {
  Clock, Database, RefreshCw, AlertTriangle,
  CheckCircle2, XCircle, Loader2, Calendar,
  Settings, TrendingUp
} from "lucide-react";
import Link from "next/link";

interface CacheCategory {
  category: string;
  lastFetchAt: string | null;
  productCount: number;
  status: string;
  isStale: boolean;
}

interface SyncSession {
  id: string;
  status: string;
  mode: string;
  startedAt: string;
  finishedAt?: string;
  stats?: {
    totalProducts?: number;
    created?: number;
    updated?: number;
    failed?: number;
  };
}

interface AutomationInfo {
  enabled: boolean;
  interval: string;
  nextSync: string | null;
  nextSyncLabel: string;
  error?: string;
}

interface StatusWidgetsProps {
  cacheStatus?: {
    categories: CacheCategory[];
    totalProducts: number;
  };
  lastSync?: SyncSession;
  isLoading?: boolean;
  errorCount?: number;
  automation?: AutomationInfo;
}

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return "Hiç";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays} gün önce`;
  if (diffHours > 0) return `${diffHours} saat önce`;
  if (diffMins > 0) return `${diffMins} dk önce`;
  return "Az önce";
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function StatusWidgets({ cacheStatus, lastSync, isLoading, errorCount = 0, automation }: StatusWidgetsProps) {
  const totalProducts = cacheStatus?.totalProducts || 0;
  const oldestFetch = cacheStatus?.categories
    ?.filter(c => c.lastFetchAt)
    ?.sort((a, b) => new Date(a.lastFetchAt!).getTime() - new Date(b.lastFetchAt!).getTime())[0];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Otomasyon Widget */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${automation?.enabled ? "bg-primary/10" : "bg-muted"}`}>
              <Clock className={`h-4 w-4 ${automation?.enabled ? "text-primary" : "text-muted-foreground"}`} />
            </div>
            <span className="text-sm font-medium text-foreground">Otomasyon</span>
          </div>
          <Link
            href="/dashboard/sync/settings"
            className="text-muted-foreground hover:text-foreground transition"
          >
            <Settings className="h-4 w-4" />
          </Link>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded ${
              automation?.enabled
                ? "bg-green-500/10 text-green-600"
                : "bg-muted text-muted-foreground"
            }`}>
              {automation?.enabled ? "Aktif" : "Pasif"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Sonraki: <span className="text-foreground">{automation?.nextSyncLabel || "Yükleniyor..."}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {automation?.interval === "manual" ? "Manuel tetikleme" :
             automation?.interval === "1h" ? "Her 1 saatte bir" :
             automation?.interval === "3h" ? "Her 3 saatte bir" :
             automation?.interval === "6h" ? "Her 6 saatte bir" :
             automation?.interval === "12h" ? "Her 12 saatte bir" :
             automation?.interval === "24h" ? "Günlük" : "Yükleniyor..."}
          </p>
        </div>
      </div>

      {/* Cache Widget */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Database className="h-4 w-4 text-blue-500" />
            </div>
            <span className="text-sm font-medium text-foreground">Cache</span>
          </div>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <div className="space-y-1">
          <p className="text-2xl font-semibold text-foreground">
            {totalProducts.toLocaleString("tr-TR")}
          </p>
          <p className="text-xs text-muted-foreground">ürün cache'de</p>
          {oldestFetch && (
            <p className="text-xs text-muted-foreground">
              <Calendar className="h-3 w-3 inline mr-1" />
              {formatTimeAgo(oldestFetch.lastFetchAt)}
            </p>
          )}
        </div>
      </div>

      {/* Son Sync Widget */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <TrendingUp className="h-4 w-4 text-purple-500" />
            </div>
            <span className="text-sm font-medium text-foreground">Son Sync</span>
          </div>
          {lastSync?.status === "completed" ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : lastSync?.status === "running" ? (
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
          ) : lastSync?.status === "failed" ? (
            <XCircle className="h-4 w-4 text-red-500" />
          ) : (
            <Clock className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <div className="space-y-1">
          {lastSync ? (
            <>
              <p className="text-sm text-foreground">
                {formatDateTime(lastSync.startedAt)}
              </p>
              <div className="flex items-center gap-2 text-xs">
                {lastSync.stats?.created !== undefined && (
                  <span className="text-green-600">+{lastSync.stats.created}</span>
                )}
                {lastSync.stats?.updated !== undefined && (
                  <span className="text-blue-600">~{lastSync.stats.updated}</span>
                )}
                {lastSync.stats?.failed !== undefined && lastSync.stats.failed > 0 && (
                  <span className="text-red-600">!{lastSync.stats.failed}</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {lastSync.mode === "full" ? "Tam" : "Artımlı"} sync
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Henüz sync yok</p>
          )}
        </div>
      </div>

      {/* Hatalar Widget */}
      <div className={`bg-card border rounded-lg p-4 ${
        errorCount > 0 ? "border-red-500/50 bg-red-500/5" : "border-border"
      }`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${
              errorCount > 0 ? "bg-red-500/10" : "bg-muted"
            }`}>
              <AlertTriangle className={`h-4 w-4 ${
                errorCount > 0 ? "text-red-500" : "text-muted-foreground"
              }`} />
            </div>
            <span className="text-sm font-medium text-foreground">Hatalar</span>
          </div>
        </div>
        <div className="space-y-1">
          <p className={`text-2xl font-semibold ${
            errorCount > 0 ? "text-red-600" : "text-foreground"
          }`}>
            {errorCount}
          </p>
          <p className="text-xs text-muted-foreground">
            {errorCount > 0 ? "aktif hata var" : "hata yok"}
          </p>
          {errorCount > 0 && (
            <button className="text-xs text-red-600 hover:text-red-700 underline">
              Detayları gör
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default StatusWidgets;
