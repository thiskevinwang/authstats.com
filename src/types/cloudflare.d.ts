import type { DownloadStatsWorkflowParams } from "@/workflows/download-stats";

declare global {
	interface CloudflareEnv {
		DB: D1Database;
		DOWNLOAD_STATS_WORKFLOW: Workflow<DownloadStatsWorkflowParams>;
	}
}

export {};
