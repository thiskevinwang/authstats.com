"use client";

import { Moon, Sun } from "lucide-react";
import Link from "next/link";

export function SiteHeader() {
	function toggleTheme() {
		const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
		document.documentElement.dataset.theme = nextTheme;
		localStorage.setItem("authstats-theme", nextTheme);
	}

	return (
		<header className="fixed left-0 right-0 top-3 z-50 px-3 sm:top-4">
			<nav className="mx-auto flex h-12 w-full max-w-5xl items-center justify-between rounded-full border bg-card/85 px-3 text-sm shadow-[0_12px_50px_rgba(0,0,0,0.12)] backdrop-blur-xl sm:px-4">
				<Link href="/" className="flex min-w-0 items-center gap-2 font-semibold text-foreground">
					<span className="size-2.5 rounded-full bg-foreground" aria-hidden="true" />
					<span className="truncate">authstats.com</span>
				</Link>

				<div className="flex items-center gap-1.5">
					<Link
						href="/"
						className="hidden rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground sm:inline-flex"
					>
						Dashboard
					</Link>
					<Link
						href="/#packages"
						className="hidden rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground sm:inline-flex"
					>
						Packages
					</Link>
					<button
						type="button"
						onClick={toggleTheme}
						aria-label="Toggle light or dark mode"
						title="Toggle light or dark mode"
						className="inline-flex size-9 items-center justify-center rounded-full border bg-background/75 text-foreground transition hover:bg-muted"
					>
						<Moon className="theme-icon-moon size-4" />
						<Sun className="theme-icon-sun hidden size-4" />
					</button>
				</div>
			</nav>
		</header>
	);
}
