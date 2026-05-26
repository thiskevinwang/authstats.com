import nextHandler from "../.open-next/worker.js";
import { DownloadStatsWorkflow } from "@/workflows/download-stats";

export { DownloadStatsWorkflow };

export default {
	fetch: nextHandler.fetch,

	async scheduled(event, env, ctx) {
		const scheduledAt = new Date(event.scheduledTime);
		const id = `download-stats-${scheduledAt.toISOString().slice(0, 16).replace(/[-:T]/g, "")}`;

		ctx.waitUntil(
			env.DOWNLOAD_STATS_WORKFLOW.create({
				id,
				params: {
					trigger: "cron",
					cron: event.cron,
					scheduledTime: event.scheduledTime,
				},
			}).catch((error) => {
				console.error("Failed to create download stats workflow", error);
			}),
		);
	},
} satisfies ExportedHandler<CloudflareEnv>;
