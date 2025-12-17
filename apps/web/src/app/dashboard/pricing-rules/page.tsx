"use client";
import { useState } from "react";
import { trpc } from "@/utils/trpc";
import { useQuery, useMutation } from "@tanstack/react-query";
import Link from "next/link";

export default function PricingRulesPage() {
	const [showForm, setShowForm] = useState(false);
	const [formData, setFormData] = useState({
		category: "tire" as "tire" | "rim" | "battery",
		brand: "",
		segment: "" as "premium" | "mid" | "economy" | "",
		marginPercent: 20,
		fixedMarkup: 0,
		priority: 10,
	});

	const priceRules = useQuery(trpc.priceRules.list.queryOptions());
	
	const createRuleMutation = useMutation({
		mutationFn: async () => {
			return trpc.priceRules.create.mutate({
				...formData,
				brand: formData.brand || undefined,
				segment: formData.segment || undefined,
				fixedMarkup: formData.fixedMarkup || undefined,
			});
		},
		onSuccess: () => {
			alert("Fiyat kuralı oluşturuldu!");
			setShowForm(false);
			priceRules.refetch();
		},
	});

	const seedDefaultsMutation = useMutation({
		mutationFn: async () => trpc.priceRules.seedDefaults.mutate(),
		onSuccess: () => {
			alert("Varsayılan kurallar oluşturuldu!");
			priceRules.refetch();
		},
	});

	return (
		<div className="text-white p-8">
			<div className="max-w-7xl mx-auto">
				<div className="mb-8">
					<h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-600 bg-clip-text text-transparent">
						Fiyat Kuralları
					</h1>
					<p className="text-slate-400 mt-1">Kategori ve marka bazlı fiyatlandırma</p>
				</div>

				<div className="mb-6 flex gap-4">
					<button
						onClick={() => setShowForm(!showForm)}
						className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-medium py-2 px-6 rounded-lg transition-all"
					>
						{showForm ? "İptal" : "Yeni Kural Ekle"}
					</button>
					<button
						onClick={() => seedDefaultsMutation.mutate()}
						disabled={seedDefaultsMutation.isPending}
						className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 text-white font-medium py-2 px-6 rounded-lg transition-all"
					>
						Varsayılan Kuralları Oluştur
					</button>
				</div>

				{showForm && (
					<div className="bg-slate-800/50 backdrop-blur-sm border border-blue-500/20 rounded-lg p-6 shadow-xl mb-6">
						<h2 className="text-2xl font-semibold text-blue-300 mb-6">Yeni Fiyat Kuralı</h2>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<label className="block text-sm font-medium text-slate-300 mb-2">Kategori</label>
								<select
									value={formData.category}
									onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
									className="w-full bg-slate-700 text-white rounded-lg px-4 py-2 border border-slate-600"
								>
									<option value="tire">Lastik</option>
									<option value="rim">Jant</option>
									<option value="battery">Akü</option>
								</select>
							</div>

							<div>
								<label className="block text-sm font-medium text-slate-300 mb-2">Marka (opsiyonel)</label>
								<input
									type="text"
									value={formData.brand}
									onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
									placeholder="örn: Michelin"
									className="w-full bg-slate-700 text-white rounded-lg px-4 py-2 border border-slate-600"
								/>
							</div>

							<div>
								<label className="block text-sm font-medium text-slate-300 mb-2">Segment (opsiyonel)</label>
								<select
									value={formData.segment}
									onChange={(e) => setFormData({ ...formData, segment: e.target.value as any })}
									className="w-full bg-slate-700 text-white rounded-lg px-4 py-2 border border-slate-600"
								>
									<option value="">Seçiniz</option>
									<option value="premium">Premium</option>
									<option value="mid">Orta</option>
									<option value="economy">Ekonomi</option>
								</select>
							</div>

							<div>
								<label className="block text-sm font-medium text-slate-300 mb-2">Marj % (Zorunlu)</label>
								<input
									type="number"
									value={formData.marginPercent}
									onChange={(e) => setFormData({ ...formData, marginPercent: Number(e.target.value) })}
									className="w-full bg-slate-700 text-white rounded-lg px-4 py-2 border border-slate-600"
								/>
							</div>

							<div>
								<label className="block text-sm font-medium text-slate-300 mb-2">Sabit Ekleme (TL)</label>
								<input
									type="number"
									value={formData.fixedMarkup}
									onChange={(e) => setFormData({ ...formData, fixedMarkup: Number(e.target.value) })}
									className="w-full bg-slate-700 text-white rounded-lg px-4 py-2 border border-slate-600"
								/>
							</div>

							<div>
								<label className="block text-sm font-medium text-slate-300 mb-2">Öncelik (düşük = önce)</label>
								<input
									type="number"
									value={formData.priority}
									onChange={(e) => setFormData({ ...formData, priority: Number(e.target.value) })}
									className="w-full bg-slate-700 text-white rounded-lg px-4 py-2 border border-slate-600"
								/>
							</div>
						</div>

						<button
							onClick={() => createRuleMutation.mutate()}
							disabled={createRuleMutation.isPending}
							className="mt-6 w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:opacity-50 text-white font-bold py-3 rounded-lg"
						>
							{createRuleMutation.isPending ? "Oluşturuluyor..." : "Kural Oluştur"}
						</button>
					</div>
				)}

				<div className="bg-slate-800/50 backdrop-blur-sm border border-blue-500/20 rounded-lg p-6 shadow-xl">
					<h2 className="text-2xl font-semibold text-blue-300 mb-6">Mevcut Kurallar</h2>
					
					{priceRules.isLoading ? (
						<p className="text-slate-400">Yükleniyor...</p>
					) : priceRules.data?.rules.length === 0 ? (
						<p className="text-slate-400">Henüz kural yok. Varsayılan kuralları oluşturun veya yeni kural ekleyin.</p>
					) : (
						<div className="space-y-3">
							{priceRules.data?.rules.map((rule: any) => (
								<div key={rule.id} className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
									<div className="flex justify-between items-start">
										<div>
											<h3 className="font-semibold text-white">
												{rule.category === "tire" ? "Lastik" : rule.category === "rim" ? "Jant" : "Akü"}
												{rule.brand && ` - ${rule.brand}`}
												{rule.segment && ` (${rule.segment})`}
											</h3>
											<p className="text-sm text-slate-400 mt-1">
												Marj: %{rule.marginPercent}
												{rule.fixedMarkup && ` + ${rule.fixedMarkup} TL`}
											</p>
											<p className="text-xs text-slate-500 mt-1">Öncelik: {rule.priority}</p>
										</div>
										<span className={`px-2 py-1 rounded text-xs ${rule.active ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
											{rule.active ? "Aktif" : "Pasif"}
										</span>
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
