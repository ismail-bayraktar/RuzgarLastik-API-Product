"use client";

import { useState, useEffect, useCallback } from "react";
import {
	Loader2, Play, X, RefreshCw, CheckCircle2,
	XCircle, Clock, AlertTriangle, Package,
	TrendingUp, TrendingDown, Minus
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface FetchJobProgress {
	id: number;
	status: string;
	jobType: string;
	categories: string[];
	totalCategories: number;
	completedCategories: number;
	currentCategory: string | null;
	productsFetched: number;
	productsCreated: number;
	productsUpdated: number;
	productsUnchanged: number;
	progressPercent: number;
	retryCount: number;
	maxRetries: number;
	retryAfter: string | null;
	rateLimitCategory: string | null;
	rateLimitWaitSeconds: number | null;
	secondsUntilRetry: number | null;
	startedAt: string | null;
	finishedAt: string | null;
	triggeredBy: string | null;
	errorMessage: string | null;
	createdAt: string | null;
}

interface FetchJobStatusProps {
	onJobComplete?: () => void;
}

const categoryLabels: Record<string, string> = {
	tire: "Lastik",
	rim: "Jant",
	battery: "Akü",
};

const statusLabels: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
	pending: {
		label: "Bekliyor",
		color: "text-yellow-600",
		icon: <Clock className="h-4 w-4" />,
	},
	running: {
		label: "Çalışıyor",
		color: "text-blue-600",
		icon: <Loader2 className="h-4 w-4 animate-spin" />,
	},
	rate_limited: {
		label: "Rate Limited",
		color: "text-amber-600",
		icon: <AlertTriangle className="h-4 w-4" />,
	},
	completed: {
		label: "Tamamlandı",
		color: "text-green-600",
		icon: <CheckCircle2 className="h-4 w-4" />,
	},
	failed: {
		label: "Başarısız",
		color: "text-red-600",
		icon: <XCircle className="h-4 w-4" />,
	},
	cancelled: {
		label: "İptal Edildi",
		color: "text-gray-600",
		icon: <X className="h-4 w-4" />,
	},
};

function formatCountdown(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = seconds % 60;
	return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function FetchJobStatus({ onJobComplete }: FetchJobStatusProps) {
	const [countdown, setCountdown] = useState<number | null>(null);
	const utils = trpc.useUtils();

	// Active job query
	const activeJobQuery = trpc.supplierProducts.activeJob.useQuery(undefined, {
		refetchInterval: (data) => {
			// Poll faster when job is active
			if (data?.job?.status === "running") return 1000;
			if (data?.job?.status === "rate_limited") return 2000;
			return 10000;
		},
	});

	const job = activeJobQuery.data?.job;

	// Countdown timer effect
	useEffect(() => {
		if (job?.status === "rate_limited" && job.secondsUntilRetry !== null) {
			setCountdown(job.secondsUntilRetry);

			const interval = setInterval(() => {
				setCountdown((prev) => {
					if (prev === null || prev <= 0) {
						clearInterval(interval);
						return 0;
					}
					return prev - 1;
				});
			}, 1000);

			return () => clearInterval(interval);
		} else {
			setCountdown(null);
		}
	}, [job?.status, job?.secondsUntilRetry]);

	// Job completed effect
	useEffect(() => {
		if (job?.status === "completed") {
			toast.success("Ürün çekme tamamlandı!", {
				description: `${job.productsCreated} yeni, ${job.productsUpdated} güncellenen, ${job.productsUnchanged} değişmeyen`,
			});
			onJobComplete?.();
		}
	}, [job?.status, job?.productsCreated, job?.productsUpdated, job?.productsUnchanged, onJobComplete]);

	// Mutations
	const createJobMutation = trpc.supplierProducts.createFetchJob.useMutation({
		onSuccess: () => {
			toast.success("Ürün çekme başlatıldı");
			utils.supplierProducts.activeJob.invalidate();
		},
		onError: (error) => {
			toast.error("Hata", { description: error.message });
		},
	});

	const cancelJobMutation = trpc.supplierProducts.cancelJob.useMutation({
		onSuccess: () => {
			toast.info("Job iptal edildi");
			utils.supplierProducts.activeJob.invalidate();
		},
		onError: (error) => {
			toast.error("İptal edilemedi", { description: error.message });
		},
	});

	const retryJobMutation = trpc.supplierProducts.retryJob.useMutation({
		onSuccess: () => {
			toast.info("Job tekrar başlatıldı");
			utils.supplierProducts.activeJob.invalidate();
		},
		onError: (error) => {
			toast.error("Tekrar başlatılamadı", { description: error.message });
		},
	});

	const handleStartJob = useCallback(() => {
		createJobMutation.mutate({});
	}, [createJobMutation]);

	const handleCancelJob = useCallback(() => {
		if (job) {
			cancelJobMutation.mutate({ jobId: job.id });
		}
	}, [job, cancelJobMutation]);

	const handleRetryNow = useCallback(() => {
		if (job) {
			retryJobMutation.mutate({ jobId: job.id });
		}
	}, [job, retryJobMutation]);

	const statusInfo = job ? statusLabels[job.status] : null;

	// No active job - show start button
	if (!job || job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
		return (
			<div className="bg-card border border-border rounded-lg p-4">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="p-2 rounded-lg bg-primary/10">
							<Package className="h-5 w-5 text-primary" />
						</div>
						<div>
							<h3 className="font-medium text-foreground">Tedarikçi Ürünleri</h3>
							<p className="text-sm text-muted-foreground">
								Ürünleri çekip veritabanına kaydet
							</p>
						</div>
					</div>
					<button
						onClick={handleStartJob}
						disabled={createJobMutation.isPending}
						className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition disabled:opacity-50"
					>
						{createJobMutation.isPending ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<Play className="h-4 w-4" />
						)}
						<span>Ürünleri Çek</span>
					</button>
				</div>

				{/* Last job info if completed/failed/cancelled */}
				{job && (
					<div className="mt-4 pt-4 border-t border-border">
						<div className="flex items-center gap-2 text-sm">
							{statusInfo?.icon}
							<span className={statusInfo?.color}>{statusInfo?.label}</span>
							{job.finishedAt && (
								<span className="text-muted-foreground">
									- {new Date(job.finishedAt).toLocaleString("tr-TR")}
								</span>
							)}
						</div>
						{job.errorMessage && (
							<p className="mt-2 text-sm text-red-600">{job.errorMessage}</p>
						)}
						<div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
							<span className="flex items-center gap-1">
								<TrendingUp className="h-3 w-3 text-green-500" />
								{job.productsCreated} yeni
							</span>
							<span className="flex items-center gap-1">
								<RefreshCw className="h-3 w-3 text-blue-500" />
								{job.productsUpdated} güncellendi
							</span>
							<span className="flex items-center gap-1">
								<Minus className="h-3 w-3 text-gray-500" />
								{job.productsUnchanged} değişmedi
							</span>
						</div>
					</div>
				)}
			</div>
		);
	}

	// Active job - show progress
	return (
		<div className={`bg-card border rounded-lg p-4 ${
			job.status === "rate_limited" ? "border-amber-500/50 bg-amber-500/5" : "border-border"
		}`}>
			{/* Header */}
			<div className="flex items-center justify-between mb-4">
				<div className="flex items-center gap-3">
					<div className={`p-2 rounded-lg ${
						job.status === "running" ? "bg-blue-500/10" :
						job.status === "rate_limited" ? "bg-amber-500/10" : "bg-muted"
					}`}>
						{statusInfo?.icon}
					</div>
					<div>
						<h3 className="font-medium text-foreground flex items-center gap-2">
							{statusInfo?.label}
							{job.status === "rate_limited" && (
								<span className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-700 rounded">
									Deneme {job.retryCount}/{job.maxRetries}
								</span>
							)}
						</h3>
						<p className="text-sm text-muted-foreground">
							{job.currentCategory ? `${categoryLabels[job.currentCategory] || job.currentCategory} işleniyor` : "Hazırlanıyor..."}
						</p>
					</div>
				</div>

				{/* Action Buttons */}
				<div className="flex items-center gap-2">
					{job.status === "rate_limited" && (
						<button
							onClick={handleRetryNow}
							disabled={retryJobMutation.isPending}
							className="flex items-center gap-1 px-3 py-1.5 text-sm bg-amber-500 text-white rounded hover:bg-amber-600 transition disabled:opacity-50"
						>
							{retryJobMutation.isPending ? (
								<Loader2 className="h-3 w-3 animate-spin" />
							) : (
								<RefreshCw className="h-3 w-3" />
							)}
							<span>Şimdi Dene</span>
						</button>
					)}
					<button
						onClick={handleCancelJob}
						disabled={cancelJobMutation.isPending}
						className="flex items-center gap-1 px-3 py-1.5 text-sm bg-muted text-muted-foreground rounded hover:bg-muted/80 transition disabled:opacity-50"
					>
						{cancelJobMutation.isPending ? (
							<Loader2 className="h-3 w-3 animate-spin" />
						) : (
							<X className="h-3 w-3" />
						)}
						<span>İptal</span>
					</button>
				</div>
			</div>

			{/* Countdown Timer (Rate Limited) */}
			{job.status === "rate_limited" && countdown !== null && (
				<div className="mb-4 p-4 bg-amber-500/10 rounded-lg border border-amber-500/20">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<Clock className="h-5 w-5 text-amber-600" />
							<div>
								<p className="text-sm font-medium text-amber-700">
									Otomatik Retry Bekliyor
								</p>
								<p className="text-xs text-amber-600/80">
									{categoryLabels[job.rateLimitCategory || ""] || job.rateLimitCategory} kategorisinde rate limit
								</p>
							</div>
						</div>
						<div className="text-right">
							<div className="text-3xl font-mono font-bold text-amber-600">
								{formatCountdown(countdown)}
							</div>
							<p className="text-xs text-amber-600/80">kaldı</p>
						</div>
					</div>
				</div>
			)}

			{/* Progress Bar */}
			<div className="mb-4">
				<div className="flex items-center justify-between text-sm mb-1">
					<span className="text-muted-foreground">İlerleme</span>
					<span className="font-medium">
						{job.completedCategories}/{job.totalCategories} kategori • %{job.progressPercent}
					</span>
				</div>
				<div className="h-2 bg-muted rounded-full overflow-hidden">
					<div
						className={`h-full transition-all duration-300 ${
							job.status === "running" ? "bg-blue-500" :
							job.status === "rate_limited" ? "bg-amber-500" : "bg-primary"
						}`}
						style={{ width: `${job.progressPercent}%` }}
					/>
				</div>
			</div>

			{/* Stats */}
			<div className="grid grid-cols-4 gap-4">
				<div className="text-center">
					<div className="text-2xl font-semibold text-foreground">
						{job.productsFetched.toLocaleString("tr-TR")}
					</div>
					<div className="text-xs text-muted-foreground">Çekilen</div>
				</div>
				<div className="text-center">
					<div className="text-2xl font-semibold text-green-600">
						{job.productsCreated.toLocaleString("tr-TR")}
					</div>
					<div className="text-xs text-muted-foreground">Yeni</div>
				</div>
				<div className="text-center">
					<div className="text-2xl font-semibold text-blue-600">
						{job.productsUpdated.toLocaleString("tr-TR")}
					</div>
					<div className="text-xs text-muted-foreground">Güncellenen</div>
				</div>
				<div className="text-center">
					<div className="text-2xl font-semibold text-gray-500">
						{job.productsUnchanged.toLocaleString("tr-TR")}
					</div>
					<div className="text-xs text-muted-foreground">Değişmeyen</div>
				</div>
			</div>

			{/* Categories Progress */}
			<div className="mt-4 pt-4 border-t border-border">
				<div className="flex items-center gap-2">
					{job.categories.map((cat, idx) => {
						const isCompleted = idx < job.completedCategories;
						const isCurrent = cat === job.currentCategory;
						const isRateLimited = job.status === "rate_limited" && cat === job.rateLimitCategory;

						return (
							<div
								key={cat}
								className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
									isCompleted
										? "bg-green-500/10 text-green-600"
										: isRateLimited
										? "bg-amber-500/10 text-amber-600"
										: isCurrent
										? "bg-blue-500/10 text-blue-600"
										: "bg-muted text-muted-foreground"
								}`}
							>
								{isCompleted && <CheckCircle2 className="h-3 w-3" />}
								{isCurrent && !isRateLimited && <Loader2 className="h-3 w-3 animate-spin" />}
								{isRateLimited && <AlertTriangle className="h-3 w-3" />}
								{categoryLabels[cat] || cat}
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}

export default FetchJobStatus;
