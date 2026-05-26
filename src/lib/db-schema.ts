import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const packages = sqliteTable("packages", {
	id: text("id").primaryKey(),
	ecosystem: text("ecosystem").notNull(),
	name: text("name").notNull(),
	target: text("target").notNull(),
	category: text("category").notNull(),
	provider: text("provider").notNull(),
	registry: text("registry").notNull(),
	sourceUrl: text("source_url").notNull(),
});

export const downloadSnapshots = sqliteTable(
	"download_snapshots",
	{
		packageId: text("package_id").notNull(),
		metric: text("metric").notNull(),
		date: text("date").notNull(),
		downloads: integer("downloads").notNull(),
		source: text("source").notNull(),
		fetchedAt: text("fetched_at").notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.packageId, table.metric, table.date] }),
		index("idx_download_snapshots_date").on(table.date),
		index("idx_download_snapshots_package_date").on(table.packageId, table.date),
	],
);

export const etlRuns = sqliteTable(
	"etl_runs",
	{
		id: text("id").primaryKey(),
		startedAt: text("started_at").notNull(),
		completedAt: text("completed_at"),
		status: text("status").notNull(),
		packagesTotal: integer("packages_total").notNull(),
		packagesUpdated: integer("packages_updated").notNull(),
		errorsJson: text("errors_json"),
	},
	(table) => [index("idx_etl_runs_started_at").on(table.startedAt)],
);

export const packageVersions = sqliteTable(
	"package_versions",
	{
		packageId: text("package_id").notNull(),
		version: text("version").notNull(),
		publishedAt: text("published_at"),
		distTag: text("dist_tag"),
		source: text("source").notNull(),
		fetchedAt: text("fetched_at").notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.packageId, table.version] }),
		index("idx_package_versions_package_published").on(table.packageId, table.publishedAt),
	],
);

export const versionDownloadSnapshots = sqliteTable(
	"version_download_snapshots",
	{
		packageId: text("package_id").notNull(),
		version: text("version").notNull(),
		metric: text("metric").notNull(),
		date: text("date").notNull(),
		downloads: integer("downloads").notNull(),
		source: text("source").notNull(),
		fetchedAt: text("fetched_at").notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.packageId, table.version, table.metric, table.date] }),
		index("idx_version_download_snapshots_package_date").on(table.packageId, table.date),
		index("idx_version_download_snapshots_package_downloads").on(table.packageId, table.downloads),
	],
);
