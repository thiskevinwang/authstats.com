import { DownloadStatsWorkflow } from "@/workflows/download-stats";

export { DownloadStatsWorkflow };

export default {
	fetch() {
		return new Response("ok");
	},
} satisfies ExportedHandler<CloudflareEnv>;
