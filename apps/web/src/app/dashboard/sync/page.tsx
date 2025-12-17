"use client";
import { useState } from "react";
import { trpc } from "@/utils/trpc";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";

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
			alert(`Sync başlatıldı! Session ID: ${data.sessionId}`);
			syncHistory.refetch();
		},
		onError: (error) => {
			alert(`Hata: ${error.message}`);
		},
	});

	const toggleCategory = (category: string) => {
		if (selectedCategories.includes(category)) {
			setSelectedCategories(selectedCategories.filter((c) => c !== category));
		} else {
			setSelectedCategories([...selectedCategories, category]);
		}
	};

	return (
		<div className="text-white p-8">
			<div className="max-w-7xl mx-auto">
				<div className="mb-8">
					<h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
						Senkronizasyon
					</h1>
					<p className="text-slate-400 mt-1">Tedarikçi ve Shopify senkronizasyonu</p>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
					{/* Sync Config */}
					<div className="bg-slate-800/50 backdrop-blur-sm border border-purple-500/20 rounded-lg p-6 shadow-xl">
						<h2 className="text-2xl font-semibold text-purple-300 mb-6">Yeni Sync Başlat</h2>
						
						<div className="space-y-6">
							{/* Mode Selection */}
							<div>
								<label className="block text-sm font-medium text-slate-300 mb-2">Sync Modu</label>
								<div className="flex gap-4">
									<button
										onClick={() => setMode("incremental")}
										className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
											mode === "incremental"
												? "bg-purple-600 text-white"
												: "bg-slate-700 text-slate-300 hover:bg-slate-600"
										}`}
									>
										Incremental
									</button>
									<button
										onClick={() => setMode("full")}
										className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
											mode === "full"
												? "bg-purple-600 text-white"
												: "bg-slate-700 text-slate-300 hover:bg-slate-600"
										}`}
									>
										Full
									</button>
								</div>
							</div>

							{/* Category Selection */}
							<div>
								<label className="block text-sm font-medium text-slate-300 mb-2">Kategoriler</label>
								<div className="space-y-2">
									{["tire", "rim", "battery"].map((category) => (
										<label key={category} className="flex items-center gap-2 cursor-pointer">
											<input
												type="checkbox"
												checked={selectedCategories.includes(category)}
												onChange={() => toggleCategory(category)}
												className="w-4 h-4 rounded border-purple-500"
											/>
											<span className="text-slate-300 capitalize">
												{category === "tire" ? "Lastik" : category === "rim" ? "Jant" : "Akü"}
											</span>
										</label>
									))}
								</div>
							</div>

							{/* Dry Run Toggle */}
							<div>
								<label className="flex items-center gap-2 cursor-pointer">
									<input
										type="checkbox"
										checked={dryRun}
										onChange={(e) => setDryRun(e.target.checked)}
										className="w-4 h-4 rounded border-purple-500"
									/>
									<span className="text-slate-300">Dry Run (Test Mode)</span>
								</label>
								<p className="text-xs text-slate-500 mt-1">
									Shopify'a veri göndermeden test eder
								</p>
							</div>

							{/* Start Button */}
							<button
								onClick={() => startSyncMutation.mutate()}
								disabled={startSyncMutation.isPending || selectedCategories.length === 0}
								className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-all duration-200"
							>
								{startSyncMutation.isPending ? "Başlatılıyor..." : "Sync Başlat"}
							</button>
						</div>
					</div>

					{/* Sync History */}
					<div className="bg-slate-800/50 backdrop-blur-sm border border-purple-500/20 rounded-lg p-6 shadow-xl">
						<h2 className="text-2xl font-semibold text-purple-300 mb-6">Son Sync İşlemleri</h2>
						
						{syncHistory.isLoading ? (
							<p className="text-slate-400">Yükleniyor...</p>
						) : syncHistory.data?.sessions.length === 0 ? (
							<p className="text-slate-400">Henüz sync işlemi yapılmadı.</p>
						) : (
							<div className="space-y-3">
								{syncHistory.data?.sessions.map((session: any) => (
									<div
										key={session.id}
										className="bg-slate-700/50 rounded-lg p-4 border border-slate-600"
									>
										<div className="flex justify-between items-start mb-2">
											<span className="text-sm font-medium text-white">
												{new Date(session.startedAt).toLocaleString("tr-TR")}
											</span>
											<span
												className={`text-xs px-2 py-1 rounded ${
													session.status === "completed"
														? "bg-green-500/20 text-green-400"
														: session.status === "running"
														? "bg-yellow-500/20 text-yellow-400"
														: "bg-red-500/20 text-red-400"
												}`}
											>
												{session.status}
											</span>
										</div>
										<p className="text-xs text-slate-400">{session.mode} sync</p>
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
