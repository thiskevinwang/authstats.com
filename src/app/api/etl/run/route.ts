import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function POST() {
	const { env } = await getCloudflareContext({ async: true });

	if (!env.DOWNLOAD_STATS_WORKFLOW) {
		return Response.json({ error: "Data refresh is unavailable right now." }, { status: 503 });
	}

	const instance = await env.DOWNLOAD_STATS_WORKFLOW.create({
		id: `manual-${Date.now()}`,
		params: {
			trigger: "manual",
			requestedAt: new Date().toISOString(),
		},
	});

	return Response.json({ instanceId: instance.id });
}
