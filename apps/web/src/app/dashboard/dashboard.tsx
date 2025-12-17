"use client";
import { authClient } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import Link from "next/link";
import {
	Package,
	CheckCircle2,
	Clock,
	AlertCircle,
	Circle,
	Disc3,
	Battery,
	RefreshCw,
	DollarSign,
	ArrowRight,
	Settings,
} from "lucide-react";

export default function Dashboard({
	session,
}: {
	session: typeof authClient.$Infer.Session;
}) {
	const syncStats = useQuery(trpc.products.syncStats.queryOptions());
	const settingsData = useQuery(trpc.settings.get.queryOptions());
	const shopifyConfig = useQuery(trpc.settings.shopifyConfig.queryOptions());
	const supplierConfig = useQuery(trpc.settings.supplierConfig.queryOptions());

	return (
		<div className="space-y-6">
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				<StatCard
					label="Toplam Urun"
					value={syncStats.data?.totalProducts || 0}
					icon={Package}
				/>
				<StatCard
					label="Senkronize"
					value={syncStats.data?.bySyncStatus.synced || 0}
					icon={CheckCircle2}
					variant="success"
				/>
				<StatCard
					label="Bekliyor"
					value={syncStats.data?.bySyncStatus.pending || 0}
					icon={Clock}
					variant="warning"
				/>
				<StatCard
					label="Hatali"
					value={syncStats.data?.bySyncStatus.failed || 0}
					icon={AlertCircle}
					variant="error"
				/>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				<div className="bg-card border border-border rounded-lg p-6">
					<h3 className="text-sm font-medium text-muted-foreground mb-4">Kategoriye Gore</h3>
					<div className="space-y-4">
						<CategoryRow
							icon={Circle}
							label="Lastik"
							value={syncStats.data?.byCategory.tire || 0}
						/>
						<CategoryRow
							icon={Disc3}
							label="Jant"
							value={syncStats.data?.byCategory.rim || 0}
						/>
						<CategoryRow
							icon={Battery}
							label="Aku"
							value={syncStats.data?.byCategory.battery || 0}
						/>
					</div>
				</div>

				<div className="bg-card border border-border rounded-lg p-6">
					<h3 className="text-sm font-medium text-muted-foreground mb-4">Hizli Islemler</h3>
					<div className="space-y-2">
						<QuickAction
							href="/dashboard/sync"
							icon={RefreshCw}
							label="Senkronizasyon Baslat"
						/>
						<QuickAction
							href="/dashboard/pricing-rules"
							icon={DollarSign}
							label="Fiyat Kurallari"
						/>
						<QuickAction
							href="/dashboard/products"
							icon={Package}
							label="Urunler"
						/>
					</div>
				</div>

				<div className="bg-card border border-border rounded-lg p-6">
					<h3 className="text-sm font-medium text-muted-foreground mb-4">Baglanti Durumu</h3>
					<div className="space-y-4">
						<ConnectionStatus
							label="Shopify"
							connected={shopifyConfig.data?.configured || false}
							detail={shopifyConfig.data?.shopDomain}
						/>
						<ConnectionStatus
							label="Tedarikci API"
							connected={supplierConfig.data?.configured || false}
							detail={supplierConfig.data?.useMock ? "Mock Mod" : supplierConfig.data?.apiUrl}
							warning={supplierConfig.data?.useMock}
						/>
					</div>
				</div>
			</div>

			<div className="bg-card border border-border rounded-lg p-6">
				<div className="flex items-center justify-between mb-4">
					<h3 className="text-sm font-medium text-muted-foreground">Ayarlar Ozeti</h3>
					<Link
						href="/dashboard/settings"
						className="text-sm text-primary hover:underline flex items-center gap-1"
					>
						Duzenle
						<ArrowRight className="h-3 w-3" />
					</Link>
				</div>
				<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
					<SettingItem label="Sync Mod" value={settingsData.data?.settings.syncMode || "N/A"} />
					<SettingItem label="Batch Size" value={settingsData.data?.settings.batchSize || 0} />
					<SettingItem label="Max Retries" value={settingsData.data?.settings.maxRetries || 0} />
					<SettingItem label="Concurrency" value={settingsData.data?.settings.syncConcurrency || 0} />
				</div>
			</div>
		</div>
	);
}

function StatCard({
	label,
	value,
	icon: Icon,
	variant = "default",
}: {
	label: string;
	value: number;
	icon: React.ComponentType<{ className?: string }>;
	variant?: "default" | "success" | "warning" | "error";
}) {
	const colors = {
		default: "text-foreground",
		success: "text-green-500",
		warning: "text-yellow-500",
		error: "text-red-500",
	};

	return (
		<div className="bg-card border border-border rounded-lg p-4">
			<div className="flex items-center justify-between">
				<Icon className={`h-5 w-5 ${colors[variant]}`} />
				<span className={`text-2xl font-semibold ${colors[variant]}`}>{value}</span>
			</div>
			<p className="text-sm text-muted-foreground mt-2">{label}</p>
		</div>
	);
}

function CategoryRow({
	icon: Icon,
	label,
	value,
}: {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	value: number;
}) {
	return (
		<div className="flex items-center justify-between">
			<div className="flex items-center gap-2">
				<Icon className="h-4 w-4 text-muted-foreground" />
				<span className="text-sm text-foreground">{label}</span>
			</div>
			<span className="text-sm font-medium text-foreground">{value}</span>
		</div>
	);
}

function QuickAction({
	href,
	icon: Icon,
	label,
}: {
	href: string;
	icon: React.ComponentType<{ className?: string }>;
	label: string;
}) {
	return (
		<Link
			href={href}
			className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted transition-colors"
		>
			<Icon className="h-4 w-4 text-muted-foreground" />
			<span className="text-sm text-foreground">{label}</span>
			<ArrowRight className="h-4 w-4 text-muted-foreground ml-auto" />
		</Link>
	);
}

function ConnectionStatus({
	label,
	connected,
	detail,
	warning,
}: {
	label: string;
	connected: boolean;
	detail?: string;
	warning?: boolean;
}) {
	return (
		<div className="flex items-start gap-3">
			<div
				className={`w-2 h-2 rounded-full mt-1.5 ${
					warning ? "bg-yellow-500" : connected ? "bg-green-500" : "bg-red-500"
				}`}
			/>
			<div className="flex-1 min-w-0">
				<p className="text-sm font-medium text-foreground">{label}</p>
				{detail && (
					<p className="text-xs text-muted-foreground truncate">{detail}</p>
				)}
			</div>
		</div>
	);
}

function SettingItem({ label, value }: { label: string; value: string | number }) {
	return (
		<div>
			<p className="text-xs text-muted-foreground">{label}</p>
			<p className="text-sm font-medium text-foreground">{value}</p>
		</div>
	);
}
