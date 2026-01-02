"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/utils/trpc";
import { toast } from "sonner";
import Link from "next/link";
import {
  ArrowLeft, Clock, Bell, Calendar, Save, Loader2,
  Play, Pause, Settings, CheckCircle2, AlertTriangle,
  Mail, MessageSquare
} from "lucide-react";

type SyncInterval = "1h" | "3h" | "6h" | "12h" | "24h" | "manual";

interface AutomationSettings {
  enabled: boolean;
  interval: SyncInterval;
  preferredHours: number[];
  categories: ("tire" | "rim" | "battery")[];
  notifications: {
    email: boolean;
    emailAddress?: string;
    onSuccess: boolean;
    onError: boolean;
    onWarning: boolean;
  };
  skipErrorProducts: boolean;
  dryRunFirst: boolean;
}

const intervalOptions: { value: SyncInterval; label: string; description: string }[] = [
  { value: "1h", label: "Her 1 saat", description: "Yuksek frekansta guncelleme" },
  { value: "3h", label: "Her 3 saat", description: "Orta frekansta guncelleme" },
  { value: "6h", label: "Her 6 saat", description: "Standart guncelleme (onerilen)" },
  { value: "12h", label: "Her 12 saat", description: "Gunluk 2 kez" },
  { value: "24h", label: "Gunluk", description: "Gunluk tek seferde" },
  { value: "manual", label: "Manuel", description: "Sadece elle tetikleme" },
];

const hourOptions = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: `${i.toString().padStart(2, "0")}:00`,
}));

const defaultSettings: AutomationSettings = {
  enabled: true,
  interval: "6h",
  preferredHours: [2, 8, 14, 20],
  categories: ["tire", "rim", "battery"],
  notifications: {
    email: false,
    emailAddress: "",
    onSuccess: true,
    onError: true,
    onWarning: false,
  },
  skipErrorProducts: false,
  dryRunFirst: true,
};

export default function SyncSettingsPage() {
  const [settings, setSettings] = useState<AutomationSettings>(defaultSettings);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch settings from backend
  const { data: savedSettings, isLoading: isLoadingSettings, refetch } = trpc.settings.getSyncAutomation.useQuery();

  // Save mutation
  const saveMutation = trpc.settings.updateSyncAutomation.useMutation({
    onSuccess: () => {
      toast.success("Ayarlar kaydedildi");
      setHasChanges(false);
      refetch();
    },
    onError: (error) => {
      toast.error(`Kaydetme hatası: ${error.message}`);
    },
  });

  // Sync local state with fetched settings
  useEffect(() => {
    if (savedSettings?.settings) {
      setSettings(savedSettings.settings as AutomationSettings);
    }
  }, [savedSettings]);

  // Track changes
  const updateSettings = (updater: (prev: AutomationSettings) => AutomationSettings) => {
    setSettings(prev => {
      const next = updater(prev);
      setHasChanges(true);
      return next;
    });
  };

  const handleSave = async () => {
    saveMutation.mutate(settings);
  };

  const isSaving = saveMutation.isPending;

  const toggleCategory = (category: "tire" | "rim" | "battery") => {
    updateSettings(prev => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter(c => c !== category)
        : [...prev.categories, category],
    }));
  };

  const togglePreferredHour = (hour: number) => {
    updateSettings(prev => ({
      ...prev,
      preferredHours: prev.preferredHours.includes(hour)
        ? prev.preferredHours.filter(h => h !== hour)
        : [...prev.preferredHours, hour].sort((a, b) => a - b),
    }));
  };

  const getNextSyncTime = () => {
    if (settings.interval === "manual" || !settings.enabled) {
      return "Manuel tetikleme";
    }

    const now = new Date();
    const currentHour = now.getHours();

    // Find next preferred hour
    const nextHour = settings.preferredHours.find(h => h > currentHour)
      || settings.preferredHours[0];

    const isToday = nextHour !== undefined && nextHour > currentHour;
    const day = isToday ? "Bugun" : "Yarin";

    return `${day} ${nextHour?.toString().padStart(2, "0") || "00"}:00`;
  };

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/sync"
            className="p-2 rounded-lg hover:bg-muted transition"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Otomasyon Ayarlari</h1>
            <p className="text-sm text-muted-foreground">Otomatik senkronizasyon yapilandirmasi</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition disabled:opacity-50"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Kaydet
        </button>
      </div>

      {/* Status Banner */}
      <div className={`p-4 rounded-lg border ${
        settings.enabled
          ? "bg-green-500/10 border-green-500/30"
          : "bg-muted border-border"
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {settings.enabled ? (
              <div className="p-2 rounded-lg bg-green-500/20">
                <Play className="h-5 w-5 text-green-600" />
              </div>
            ) : (
              <div className="p-2 rounded-lg bg-muted">
                <Pause className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div>
              <p className="font-medium text-foreground">
                Otomasyon {settings.enabled ? "Aktif" : "Pasif"}
              </p>
              <p className="text-sm text-muted-foreground">
                Sonraki sync: {getNextSyncTime()}
              </p>
            </div>
          </div>
          <button
            onClick={() => updateSettings(prev => ({ ...prev, enabled: !prev.enabled }))}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
              settings.enabled ? "bg-green-500" : "bg-muted-foreground/30"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                settings.enabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Interval Settings */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-medium text-foreground">Sync Sikliği</h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {intervalOptions.map(option => (
            <button
              key={option.value}
              onClick={() => updateSettings(prev => ({ ...prev, interval: option.value }))}
              className={`p-4 rounded-lg border text-left transition ${
                settings.interval === option.value
                  ? "bg-primary/10 border-primary"
                  : "bg-muted/30 border-border hover:bg-muted/50"
              }`}
            >
              <p className={`font-medium ${
                settings.interval === option.value ? "text-primary" : "text-foreground"
              }`}>
                {option.label}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{option.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Preferred Hours */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-medium text-foreground">Tercih Edilen Saatler</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Sync'in calismasini istediginiz saatleri secin. Sistem bu saatlere en yakin zamanda calistiracak.
        </p>

        <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 gap-2">
          {hourOptions.map(option => (
            <button
              key={option.value}
              onClick={() => togglePreferredHour(option.value)}
              className={`px-2 py-2 text-xs rounded-lg border transition ${
                settings.preferredHours.includes(option.value)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/30 border-border hover:bg-muted/50 text-muted-foreground"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Categories */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-medium text-foreground">Kategoriler</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Otomatik sync'e dahil edilecek kategorileri secin.
        </p>

        <div className="flex flex-wrap gap-3">
          {[
            { id: "tire", label: "Lastik", emoji: "🛞" },
            { id: "rim", label: "Jant", emoji: "⚙️" },
            { id: "battery", label: "Aku", emoji: "🔋" },
          ].map(cat => (
            <button
              key={cat.id}
              onClick={() => toggleCategory(cat.id as "tire" | "rim" | "battery")}
              className={`px-4 py-2 rounded-lg border transition ${
                settings.categories.includes(cat.id as "tire" | "rim" | "battery")
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/30 border-border hover:bg-muted/50"
              }`}
            >
              {cat.emoji} {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-medium text-foreground">Bildirimler</h2>
        </div>

        <div className="space-y-4">
          {/* Email Toggle */}
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium text-foreground">E-posta Bildirimleri</p>
                <p className="text-sm text-muted-foreground">Sync sonuclarini e-posta ile al</p>
              </div>
            </div>
            <button
              onClick={() => updateSettings(prev => ({
                ...prev,
                notifications: { ...prev.notifications, email: !prev.notifications.email }
              }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                settings.notifications.email ? "bg-primary" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                  settings.notifications.email ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Email Address */}
          {settings.notifications.email && (
            <div className="pl-11">
              <input
                type="email"
                value={settings.notifications.emailAddress || ""}
                onChange={(e) => updateSettings(prev => ({
                  ...prev,
                  notifications: { ...prev.notifications, emailAddress: e.target.value }
                }))}
                placeholder="ornek@domain.com"
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary"
              />
            </div>
          )}

          {/* Notification Types */}
          <div className="grid grid-cols-3 gap-3 pt-2">
            <button
              onClick={() => updateSettings(prev => ({
                ...prev,
                notifications: { ...prev.notifications, onSuccess: !prev.notifications.onSuccess }
              }))}
              className={`p-3 rounded-lg border text-center transition ${
                settings.notifications.onSuccess
                  ? "bg-green-500/10 border-green-500/30"
                  : "bg-muted/30 border-border"
              }`}
            >
              <CheckCircle2 className={`h-5 w-5 mx-auto mb-1 ${
                settings.notifications.onSuccess ? "text-green-600" : "text-muted-foreground"
              }`} />
              <p className="text-xs">Basari</p>
            </button>

            <button
              onClick={() => updateSettings(prev => ({
                ...prev,
                notifications: { ...prev.notifications, onError: !prev.notifications.onError }
              }))}
              className={`p-3 rounded-lg border text-center transition ${
                settings.notifications.onError
                  ? "bg-red-500/10 border-red-500/30"
                  : "bg-muted/30 border-border"
              }`}
            >
              <AlertTriangle className={`h-5 w-5 mx-auto mb-1 ${
                settings.notifications.onError ? "text-red-600" : "text-muted-foreground"
              }`} />
              <p className="text-xs">Hata</p>
            </button>

            <button
              onClick={() => updateSettings(prev => ({
                ...prev,
                notifications: { ...prev.notifications, onWarning: !prev.notifications.onWarning }
              }))}
              className={`p-3 rounded-lg border text-center transition ${
                settings.notifications.onWarning
                  ? "bg-amber-500/10 border-amber-500/30"
                  : "bg-muted/30 border-border"
              }`}
            >
              <AlertTriangle className={`h-5 w-5 mx-auto mb-1 ${
                settings.notifications.onWarning ? "text-amber-600" : "text-muted-foreground"
              }`} />
              <p className="text-xs">Uyari</p>
            </button>
          </div>
        </div>
      </div>

      {/* Advanced Options */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-lg font-medium text-foreground mb-4">Gelismis Ayarlar</h2>

        <div className="space-y-4">
          <label className="flex items-center justify-between p-3 bg-muted/30 rounded-lg cursor-pointer">
            <div>
              <p className="font-medium text-foreground">Hatali Urunleri Atla</p>
              <p className="text-sm text-muted-foreground">
                Onceki sync'te hata veren urunleri otomatik atla
              </p>
            </div>
            <button
              onClick={() => updateSettings(prev => ({ ...prev, skipErrorProducts: !prev.skipErrorProducts }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                settings.skipErrorProducts ? "bg-primary" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                  settings.skipErrorProducts ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </label>

          <label className="flex items-center justify-between p-3 bg-muted/30 rounded-lg cursor-pointer">
            <div>
              <p className="font-medium text-foreground">Oncelikle Dry Run</p>
              <p className="text-sm text-muted-foreground">
                Gercek sync oncesi dry run yap (onerilen)
              </p>
            </div>
            <button
              onClick={() => updateSettings(prev => ({ ...prev, dryRunFirst: !prev.dryRunFirst }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                settings.dryRunFirst ? "bg-primary" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                  settings.dryRunFirst ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </label>
        </div>
      </div>

      {/* Save Button (Mobile) */}
      <div className="lg:hidden">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition disabled:opacity-50"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Ayarlari Kaydet
        </button>
      </div>
    </div>
  );
}
