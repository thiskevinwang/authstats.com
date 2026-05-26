import Link from "next/link";

export function SiteFooter() {
	return (
		<footer className="border-t bg-background/85 px-4 py-8 text-sm text-muted-foreground sm:px-6 lg:px-8">
			<div className="mx-auto flex w-full max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<div className="font-semibold text-foreground">authstats.com</div>
					<p className="mt-1 max-w-xl">
						A package activity explorer for auth SDKs, protocol libraries, and framework integrations.
					</p>
				</div>
				<nav className="flex flex-wrap gap-4">
					<Link href="/" className="transition hover:text-foreground">
						Dashboard
					</Link>
					<Link href="/#packages" className="transition hover:text-foreground">
						Packages
					</Link>
				</nav>
			</div>
		</footer>
	);
}
