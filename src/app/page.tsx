import { DashboardExplorer } from "@/components/dashboard-explorer";
import { getDashboardData } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";

export default async function Home() {
	const data = await getDashboardData();

	return (
		<main className="min-h-screen bg-background text-foreground">
			<div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-8 pt-20 sm:px-6 sm:pt-24 lg:px-8">
				<header className="mx-auto flex min-h-56 w-full max-w-4xl flex-col items-center justify-center gap-4 py-10 text-center sm:min-h-72 sm:py-16">
					<p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">AUTH DOWNLOAD STATS</p>
					<h1 className="text-5xl font-semibold tracking-normal text-foreground sm:text-7xl">authstats.com</h1>
					<p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-xl sm:leading-8">
						Download activity for auth SDKs, protocol libraries, and framework integrations.
					</p>
				</header>

				<DashboardExplorer data={data} />
			</div>
		</main>
	);
}
