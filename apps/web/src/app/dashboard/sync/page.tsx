"use client";
import { useState } from "react";
import { trpc } from "@/utils/trpc";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Play, Loader2, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

export default function SyncPage() {
	const [mode, setMode] = useState<"full" | "incremental">("incremental");
	const [dryRun, setDryRun] = useState(false);
	const [selectedCategories, setSelectedCategories] = useState<string[]>(["tire", "rim", "battery"]);

	const syncHistory = useQuery(trpc.sync.history.queryOptions({ limit: 10 }));
	
	const startSyncMutation = useMutation({
		mutationFn: async () => {
			return trpc.sync.start.mutate({
				mode,
				categories: selectedCategories as any,
				dryRun,
			});
		},
		onSuccess: (data) => {
			toast.success(`Sync baslatildi! Session ID: ${data.sessionId}`);
			syncHistory.refetch();
		},
		onError: (error) => {
			toast.error(`Hata: ${error.message}`);
		},
	});

	const toggleCategory = (category: string) => {
		if (selectedCategories.includes(category)) {
			setSelectedCategories(selectedCategories.filter((c) => c !== category));
		} else {
			setSelectedCategories([...selectedCategories, category]);
		}
	};

	const getStatusIcon = (status: string) => {
		switch (status) {
			case "completed":
				return <CheckCircle2 className="h-4 w-4 text-green-500" />;
			case "running":
				return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
			case "failed":
				return <XCircle className="h-4 w-4 text-red-500" />;
			default:
				return <Clock className="h-4 w-4 text-muted-foreground" />;
		}
	};

	return (
		<div className="p-6 lg:p-8">
			<div className="max-w-7xl mx-auto">
				<div className="mb-8">
					<h1 className="text-2xl font-semibold text-foreground">Senkronizasyon</h1>
					<p className="text-muted-foreground mt-1">Tedarikci ve Shopify senkronizasyonu</p>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
					<div className="bg-card border border-border rounded-lg p-6">
						<h2 className="text-lg font-medium text-foreground mb-6">Yeni Sync Baslat</h2>
						
						<div className="space-y-6">
							<div>
								<label className="block text-sm text-muted-foreground mb-2">Sync Modu</label>
								<div className="flex gap-2">
									<button
										onClick={() => setMode("incremental")}
										className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${
											mode === "incremental"
												? "bg-primary text-primary-foreground"
												: "bg-muted text-muted-foreground hover:bg-muted/80"
										}`}
									>
										Incremental
									</button>
									<button
										onClick={() => setMode("full")}
										className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${
											mode === "full"
												? "bg-primary text-primary-foreground"
												: "bg-muted text-muted-foreground hover:bg-muted/80"
										}`}
									>
										Full
									</button>
								</div>
							</div>

							<div>
								<label className="block text-sm text-muted-foreground mb-2">Kategoriler</label>
								<div className="space-y-2">
									{[
										{ id: "tire", label: "Lastik" },
										{ id: "rim", label: "Jant" },
										{ id: "battery", label: "Aku" },
									].map((category) => (
										<label key={category.id} className="flex items-center gap-3 cursor-pointer">
											<input
												type="checkbox"
												checked={selectedCategories.includes(category.id)}
												onChange={() => toggleCategory(category.id)}
												className="w-4 h-4 rounded border-input bg-background text-primary focus:ring-ring"
											/>
											<span className="text-sm text-foreground">{category.label}</span>
										</label>
									))}
								</div>
							</div>

							<div>
								<label className="flex items-center gap-3 cursor-pointer">
									<input
										type="checkbox"
										checked={dryRun}
										onChange={(e) => setDryRun(e.target.checked)}
										className="w-4 h-4 rounded border-input bg-background text-primary focus:ring-ring"
									/>
									<div>
										<span className="text-sm text-foreground">Dry Run (Test Mode)</span>
										<p className="text-xs text-muted-foreground">Shopify'a veri gondermeden test eder</p>
									</div>
								</label>
							</div>

							<button
								onClick={() => startSyncMutation.mutate()}
								disabled={startSyncMutation.isPending || selectedCategories.length === 0}
								className="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 px-6 rounded-lg font-medium hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
							>
								{startSyncMutation.isPending ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<Play className="h-4 w-4" />
								)}
								{startSyncMutation.isPending ? "Baslatiliyor..." : "Sync Baslat"}
							</button>
						</div>
					</div>

					<div className="bg-card border border-border rounded-lg p-6">
						<h2 className="text-lg font-medium text-foreground mb-6">Son Sync Islemleri</h2>
						
						{syncHistory.isLoading ? (
							<div className="flex items-center justify-center py-8">
								<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
							</div>
						) : syncHistory.data?.sessions.length === 0 ? (
							<div className="text-center py-8">
								<AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
								<p className="text-sm text-muted-foreground">Henuz sync islemi yapilmadi.</p>
							</div>
						) : (
							<div className="space-y-3">
								{syncHistory.data?.sessions.map((session: any) => (
									<div
										key={session.id}
										className="flex items-center gap-3 p-3 rounded-lg border border-border"
									>
										{getStatusIcon(session.status)}
										<div className="flex-1 min-w-0">
											<p className="text-sm font-medium text-foreground">
												{new Date(session.startedAt).toLocaleString("tr-TR")}
											</p>
											<p className="text-xs text-muted-foreground">{session.mode} sync</p>
										</div>
										<span
											className={`text-xs px-2 py-1 rounded ${
												session.status === "completed"
													? "bg-green-500/10 text-green-500"
													: session.status === "running"
													? "bg-blue-500/10 text-blue-500"
													: "bg-red-500/10 text-red-500"
											}`}
										>
											{session.status}
										</span>
									</div>
								))}
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
