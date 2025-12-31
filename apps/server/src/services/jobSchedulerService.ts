import { fetchJobService } from "./fetchJobService";

const CHECK_INTERVAL_MS = 30000; // 30 saniye

class JobSchedulerService {
	private intervalId: NodeJS.Timeout | null = null;
	private isRunning: boolean = false;

	/**
	 * Scheduler'ı başlat
	 */
	start(): void {
		if (this.isRunning) {
			console.log("[JobScheduler] Already running");
			return;
		}

		console.log("[JobScheduler] Starting with interval:", CHECK_INTERVAL_MS / 1000, "seconds");
		this.isRunning = true;

		// İlk kontrol hemen yapılsın
		this.checkAndProcessJobs();

		// Periyodik kontrol
		this.intervalId = setInterval(() => {
			this.checkAndProcessJobs();
		}, CHECK_INTERVAL_MS);
	}

	/**
	 * Scheduler'ı durdur
	 */
	stop(): void {
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}
		this.isRunning = false;
		console.log("[JobScheduler] Stopped");
	}

	/**
	 * Rate limited job'ları kontrol et ve hazır olanları işle
	 */
	private async checkAndProcessJobs(): Promise<void> {
		try {
			// Retry zamanı gelmiş job'ları bul
			const readyJobIds = await fetchJobService.checkRetryJobs();

			if (readyJobIds.length > 0) {
				console.log(`[JobScheduler] Found ${readyJobIds.length} jobs ready for retry:`, readyJobIds);

				// Her job'ı sırayla işle
				for (const jobId of readyJobIds) {
					try {
						console.log(`[JobScheduler] Retrying job ${jobId}`);
						await fetchJobService.retryJob(jobId);
					} catch (error: any) {
						console.error(`[JobScheduler] Error retrying job ${jobId}:`, error.message);
					}
				}
			}
		} catch (error: any) {
			console.error("[JobScheduler] Error checking jobs:", error.message);
		}
	}

	/**
	 * Scheduler durumu
	 */
	getStatus(): { isRunning: boolean; checkIntervalMs: number } {
		return {
			isRunning: this.isRunning,
			checkIntervalMs: CHECK_INTERVAL_MS,
		};
	}
}

// Singleton instance
export const jobSchedulerService = new JobSchedulerService();
