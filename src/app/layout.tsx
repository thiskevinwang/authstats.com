import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
	title: "authstats.com",
	description: "Download stats and trends for auth packages across language ecosystems.",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
				<script
					dangerouslySetInnerHTML={{
						__html: `(() => {
try {
	const saved = localStorage.getItem("authstats-theme");
	const theme = saved === "dark" || saved === "light"
		? saved
		: (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
	document.documentElement.dataset.theme = theme;
} catch {
	document.documentElement.dataset.theme = "light";
}
})();`,
					}}
				/>
			</head>
			<body>
				<SiteHeader />
				{children}
				<SiteFooter />
			</body>
		</html>
	);
}
