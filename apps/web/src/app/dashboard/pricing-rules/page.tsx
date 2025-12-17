"use client";
import { useState } from "react";
import { trpc } from "@/utils/trpc";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Loader2, Sparkles, X } from "lucide-react";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetDescription,
} from "@/components/ui/sheet";

export default function PricingRulesPage() {
	const [sheetOpen, setSheetOpen] = useState(false);
	const [formData, setFormData] = useState({
		category: "tire" as "tire" | "rim" | "battery",
		brand: "",
		segment: "" as "premium" | "mid" | "economy" | "",
		marginPercent: 20,
		fixedMarkup: 0,
		priority: 10,
	});

	const priceRules = useQuery(trpc.priceRules.list.queryOptions());
	
	const createRuleMutation = useMutation(trpc.priceRules.create.mutationOptions({
		onSuccess: () => {
			toast.success("Fiyat kuralı oluşturuldu!");
			setSheetOpen(false);
			resetForm();
			priceRules.refetch();
		},
		onError: (error) => {
			toast.error(`Hata: ${error.message}`);
		},
	}));

	const seedDefaultsMutation = useMutation(trpc.priceRules.seedDefaults.mutationOptions({
		onSuccess: () => {
			toast.success("Varsayılan kurallar oluşturuldu!");
			priceRules.refetch();
		},
		onError: (error) => {
			toast.error(`Hata: ${error.message}`);
		},
	}));

	const resetForm = () => {
		setFormData({
			category: "tire",
			brand: "",
			segment: "",
			marginPercent: 20,
			fixedMarkup: 0,
			priority: 10,
		});
	};

	const getCategoryLabel = (category: string) => {
		switch (category) {
			case "tire": return "Lastik";
			case "rim": return "Jant";
			case "battery": return "Aku";
			default: return category;
		}
	};

	return (
		<div className="p-6 lg:p-8">
			<div className="max-w-7xl mx-auto">
				<div className="mb-8">
					<h1 className="text-2xl font-semibold text-foreground">Fiyat Kurallari</h1>
					<p className="text-muted-foreground mt-1">Kategori ve marka bazli fiyatlandirma</p>
				</div>

				<div className="flex gap-3 mb-6">
					<button
						onClick={() => setSheetOpen(true)}
						className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition"
					>
						<Plus className="h-4 w-4" />
						Yeni Kural Ekle
					</button>
					<button
						onClick={() => seedDefaultsMutation.mutate()}
						disabled={seedDefaultsMutation.isPending}
						className="inline-flex items-center gap-2 px-4 py-2 bg-muted text-foreground rounded-lg text-sm font-medium hover:bg-muted/80 transition disabled:opacity-50"
					>
						{seedDefaultsMutation.isPending ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<Sparkles className="h-4 w-4" />
						)}
						Varsayilan Kurallar
					</button>
				</div>

				<div className="bg-card border border-border rounded-lg overflow-hidden">
					<div className="p-4 border-b border-border">
						<h2 className="text-sm font-medium text-foreground">Mevcut Kurallar</h2>
					</div>
					
					{priceRules.isLoading ? (
						<div className="flex items-center justify-center py-12">
							<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
						</div>
					) : priceRules.data?.rules.length === 0 ? (
						<div className="text-center py-12">
							<p className="text-muted-foreground">Henuz kural yok. Varsayilan kurallari olusturun veya yeni kural ekleyin.</p>
						</div>
					) : (
						<div className="divide-y divide-border">
							{priceRules.data?.rules.map((rule: any) => (
								<div key={rule.id} className="p-4 hover:bg-muted/30 transition-colors">
									<div className="flex items-start justify-between">
										<div>
											<h3 className="text-sm font-medium text-foreground">
												{getCategoryLabel(rule.category)}
												{rule.brand && ` - ${rule.brand}`}
												{rule.segment && ` (${rule.segment})`}
											</h3>
											<p className="text-xs text-muted-foreground mt-1">
												Marj: %{rule.marginPercent}
												{rule.fixedMarkup && ` + ${rule.fixedMarkup} TL`}
												{" | "}Oncelik: {rule.priority}
											</p>
										</div>
										<span className={`text-xs px-2 py-1 rounded ${rule.active ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}>
											{rule.active ? "Aktif" : "Pasif"}
										</span>
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			</div>

			<Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
				<SheetContent>
					<SheetHeader>
						<SheetTitle>Yeni Fiyat Kurali</SheetTitle>
						<SheetDescription>Kategori ve marka bazli fiyatlandirma kurali olusturun</SheetDescription>
					</SheetHeader>

					<div className="space-y-4 mt-6">
						<div>
							<label className="block text-sm text-muted-foreground mb-2">Kategori</label>
							<select
								value={formData.category}
								onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
								className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground"
							>
								<option value="tire">Lastik</option>
								<option value="rim">Jant</option>
								<option value="battery">Aku</option>
							</select>
						</div>

						<div>
							<label className="block text-sm text-muted-foreground mb-2">Marka (opsiyonel)</label>
							<input
								type="text"
								value={formData.brand}
								onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
								placeholder="orn: Michelin"
								className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground"
							/>
						</div>

						<div>
							<label className="block text-sm text-muted-foreground mb-2">Segment (opsiyonel)</label>
							<select
								value={formData.segment}
								onChange={(e) => setFormData({ ...formData, segment: e.target.value as any })}
								className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground"
							>
								<option value="">Seciniz</option>
								<option value="premium">Premium</option>
								<option value="mid">Orta</option>
								<option value="economy">Ekonomi</option>
							</select>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div>
								<label className="block text-sm text-muted-foreground mb-2">Marj %</label>
								<input
									type="number"
									value={formData.marginPercent}
									onChange={(e) => setFormData({ ...formData, marginPercent: Number(e.target.value) })}
									className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground"
								/>
							</div>
							<div>
								<label className="block text-sm text-muted-foreground mb-2">Sabit Ekleme (TL)</label>
								<input
									type="number"
									value={formData.fixedMarkup}
									onChange={(e) => setFormData({ ...formData, fixedMarkup: Number(e.target.value) })}
									className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground"
								/>
							</div>
						</div>

						<div>
							<label className="block text-sm text-muted-foreground mb-2">Oncelik (dusuk = once)</label>
							<input
								type="number"
								value={formData.priority}
								onChange={(e) => setFormData({ ...formData, priority: Number(e.target.value) })}
								className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground"
							/>
						</div>

						<button
							onClick={() => createRuleMutation.mutate({
								...formData,
								brand: formData.brand || undefined,
								segment: formData.segment || undefined,
								fixedMarkup: formData.fixedMarkup || undefined,
							})}
							disabled={createRuleMutation.isPending}
							className="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-lg font-medium hover:bg-primary/90 transition disabled:opacity-50"
						>
							{createRuleMutation.isPending ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<Plus className="h-4 w-4" />
							)}
							{createRuleMutation.isPending ? "Olusturuluyor..." : "Kural Olustur"}
						</button>
					</div>
				</SheetContent>
			</Sheet>
		</div>
	);
}
