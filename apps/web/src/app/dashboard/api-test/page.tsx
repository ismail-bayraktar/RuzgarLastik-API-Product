"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
	Plug,
	Play,
	Loader2,
	CheckCircle2,
	XCircle,
	Save,
	Trash2,
	Copy,
} from "lucide-react";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetDescription,
} from "@/components/ui/sheet";

interface ApiConfig {
	apiUrl: string;
	apiKey: string;
	username: string;
	password: string;
}

interface TestResult {
	success: boolean;
	status?: number;
	message: string;
	data?: any;
	responseTime?: number;
}

export default function ApiTestPage() {
	const [config, setConfig] = useState<ApiConfig>({
		apiUrl: "",
		apiKey: "",
		username: "",
		password: "",
	});
	const [testing, setTesting] = useState(false);
	const [result, setResult] = useState<TestResult | null>(null);
	const [sheetOpen, setSheetOpen] = useState(false);
	const [savedConfigs, setSavedConfigs] = useState<{ name: string; config: ApiConfig }[]>([]);

	const testConnection = async () => {
		if (!config.apiUrl) {
			toast.error("API URL gerekli");
			return;
		}

		setTesting(true);
		setResult(null);

		const startTime = Date.now();

		try {
			const headers: Record<string, string> = {
				"Content-Type": "application/json",
			};

			if (config.apiKey) {
				headers["Authorization"] = `Bearer ${config.apiKey}`;
			}

			if (config.username && config.password) {
				headers["Authorization"] = `Basic ${btoa(`${config.username}:${config.password}`)}`;
			}

			const response = await fetch(config.apiUrl, {
				method: "GET",
				headers,
			});

			const responseTime = Date.now() - startTime;
			let data = null;
			
			try {
				data = await response.json();
			} catch {
				data = await response.text();
			}

			setResult({
				success: response.ok,
				status: response.status,
				message: response.ok ? "Baglanti basarili!" : `HTTP ${response.status}: ${response.statusText}`,
				data,
				responseTime,
			});

			if (response.ok) {
				toast.success("API baglantisi basarili!");
			} else {
				toast.error(`API hatasi: ${response.status}`);
			}
		} catch (error: any) {
			const responseTime = Date.now() - startTime;
			setResult({
				success: false,
				message: error.message || "Baglanti hatasi",
				responseTime,
			});
			toast.error("Baglanti basarisiz: " + error.message);
		} finally {
			setTesting(false);
		}
	};

	const saveConfig = () => {
		const name = prompt("Konfigurasyon adi:");
		if (!name) return;

		setSavedConfigs([...savedConfigs, { name, config: { ...config } }]);
		toast.success("Konfigurasyon kaydedildi");
	};

	const loadConfig = (savedConfig: ApiConfig) => {
		setConfig(savedConfig);
		setSheetOpen(false);
		toast.success("Konfigurasyon yuklendi");
	};

	const deleteConfig = (index: number) => {
		setSavedConfigs(savedConfigs.filter((_, i) => i !== index));
		toast.success("Konfigurasyon silindi");
	};

	const copyToClipboard = (text: string) => {
		navigator.clipboard.writeText(text);
		toast.success("Panoya kopyalandi");
	};

	return (
		<div className="p-6 lg:p-8">
			<div className="max-w-4xl mx-auto">
				<div className="mb-8">
					<h1 className="text-2xl font-semibold text-foreground">API Test</h1>
					<p className="text-muted-foreground mt-1">Tedarikci API baglantisini test edin</p>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
					<div className="lg:col-span-2 space-y-6">
						<div className="bg-card border border-border rounded-lg p-6">
							<div className="flex items-center justify-between mb-6">
								<h2 className="text-lg font-medium text-foreground">Baglanti Ayarlari</h2>
								<div className="flex gap-2">
									<button
										onClick={() => setSheetOpen(true)}
										className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground"
										title="Kayitli konfigurasyonlar"
									>
										<Plug className="h-4 w-4" />
									</button>
									<button
										onClick={saveConfig}
										className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground"
										title="Konfigurasyonu kaydet"
									>
										<Save className="h-4 w-4" />
									</button>
								</div>
							</div>

							<div className="space-y-4">
								<div>
									<label className="block text-sm text-muted-foreground mb-2">API URL *</label>
									<input
										type="url"
										value={config.apiUrl}
										onChange={(e) => setConfig({ ...config, apiUrl: e.target.value })}
										placeholder="https://api.supplier.com/v1/products"
										className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground placeholder:text-muted-foreground"
									/>
								</div>

								<div>
									<label className="block text-sm text-muted-foreground mb-2">API Key (Bearer Token)</label>
									<input
										type="password"
										value={config.apiKey}
										onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
										placeholder="API anahtarinizi girin"
										className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground placeholder:text-muted-foreground"
									/>
								</div>

								<div className="grid grid-cols-2 gap-4">
									<div>
										<label className="block text-sm text-muted-foreground mb-2">Kullanici Adi (Basic Auth)</label>
										<input
											type="text"
											value={config.username}
											onChange={(e) => setConfig({ ...config, username: e.target.value })}
											placeholder="Kullanici adi"
											className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground placeholder:text-muted-foreground"
										/>
									</div>
									<div>
										<label className="block text-sm text-muted-foreground mb-2">Sifre (Basic Auth)</label>
										<input
											type="password"
											value={config.password}
											onChange={(e) => setConfig({ ...config, password: e.target.value })}
											placeholder="Sifre"
											className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground placeholder:text-muted-foreground"
										/>
									</div>
								</div>

								<button
									onClick={testConnection}
									disabled={testing || !config.apiUrl}
									className="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-lg font-medium hover:bg-primary/90 transition disabled:opacity-50"
								>
									{testing ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										<Play className="h-4 w-4" />
									)}
									{testing ? "Test Ediliyor..." : "Baglantiyi Test Et"}
								</button>
							</div>
						</div>

						{result && (
							<div className="bg-card border border-border rounded-lg p-6">
								<div className="flex items-center justify-between mb-4">
									<div className="flex items-center gap-2">
										{result.success ? (
											<CheckCircle2 className="h-5 w-5 text-green-500" />
										) : (
											<XCircle className="h-5 w-5 text-red-500" />
										)}
										<h2 className="text-lg font-medium text-foreground">Test Sonucu</h2>
									</div>
									{result.responseTime && (
										<span className="text-sm text-muted-foreground">
											{result.responseTime}ms
										</span>
									)}
								</div>

								<div className="space-y-3">
									<div className="flex items-center gap-2">
										<span className={`px-2 py-1 rounded text-xs font-medium ${
											result.success ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
										}`}>
											{result.status || "Error"}
										</span>
										<span className="text-sm text-foreground">{result.message}</span>
									</div>

									{result.data && (
										<div className="relative">
											<button
												onClick={() => copyToClipboard(JSON.stringify(result.data, null, 2))}
												className="absolute top-2 right-2 p-1 hover:bg-muted rounded transition-colors"
											>
												<Copy className="h-4 w-4 text-muted-foreground" />
											</button>
											<pre className="p-4 bg-muted rounded-lg text-xs text-foreground overflow-auto max-h-64">
												{typeof result.data === "string" ? result.data : JSON.stringify(result.data, null, 2)}
											</pre>
										</div>
									)}
								</div>
							</div>
						)}
					</div>

					<div className="space-y-6">
						<div className="bg-card border border-border rounded-lg p-6">
							<h3 className="text-sm font-medium text-foreground mb-4">Hizli Testler</h3>
							<div className="space-y-2">
								<button
									onClick={() => {
										setConfig({
											apiUrl: "https://jsonplaceholder.typicode.com/posts/1",
											apiKey: "",
											username: "",
											password: "",
										});
									}}
									className="w-full text-left px-3 py-2 rounded-lg border border-border hover:bg-muted transition-colors text-sm"
								>
									<span className="text-foreground">Test API (JSONPlaceholder)</span>
									<p className="text-xs text-muted-foreground mt-0.5">Ornek REST API</p>
								</button>
								<button
									onClick={() => {
										setConfig({
											apiUrl: "https://api.github.com",
											apiKey: "",
											username: "",
											password: "",
										});
									}}
									className="w-full text-left px-3 py-2 rounded-lg border border-border hover:bg-muted transition-colors text-sm"
								>
									<span className="text-foreground">GitHub API</span>
									<p className="text-xs text-muted-foreground mt-0.5">Public API test</p>
								</button>
							</div>
						</div>

						<div className="bg-card border border-border rounded-lg p-6">
							<h3 className="text-sm font-medium text-foreground mb-4">Ipuclari</h3>
							<ul className="space-y-2 text-xs text-muted-foreground">
								<li>API Key veya Basic Auth'dan birini kullanin</li>
								<li>CORS hatasi aliyorsaniz, server-side proxy gerekebilir</li>
								<li>Basarili test sonrasi Ayarlar'dan kaydedin</li>
							</ul>
						</div>
					</div>
				</div>
			</div>

			<Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
				<SheetContent>
					<SheetHeader>
						<SheetTitle>Kayitli Konfigurasyonlar</SheetTitle>
						<SheetDescription>Daha once kaydedilen API konfigurasyonlari</SheetDescription>
					</SheetHeader>

					<div className="mt-6 space-y-3">
						{savedConfigs.length === 0 ? (
							<p className="text-sm text-muted-foreground text-center py-8">
								Henuz kayitli konfigurasyon yok
							</p>
						) : (
							savedConfigs.map((saved, index) => (
								<div
									key={index}
									className="flex items-center justify-between p-3 rounded-lg border border-border"
								>
									<button
										onClick={() => loadConfig(saved.config)}
										className="flex-1 text-left"
									>
										<span className="text-sm font-medium text-foreground">{saved.name}</span>
										<p className="text-xs text-muted-foreground truncate">{saved.config.apiUrl}</p>
									</button>
									<button
										onClick={() => deleteConfig(index)}
										className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-destructive transition-colors"
									>
										<Trash2 className="h-4 w-4" />
									</button>
								</div>
							))
						)}
					</div>
				</SheetContent>
			</Sheet>
		</div>
	);
}
