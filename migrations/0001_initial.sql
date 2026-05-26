CREATE TABLE IF NOT EXISTS packages (
	id TEXT PRIMARY KEY,
	ecosystem TEXT NOT NULL,
	name TEXT NOT NULL,
	target TEXT NOT NULL,
	category TEXT NOT NULL,
	provider TEXT NOT NULL,
	registry TEXT NOT NULL,
	source_url TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS download_snapshots (
	package_id TEXT NOT NULL,
	metric TEXT NOT NULL,
	date TEXT NOT NULL,
	downloads INTEGER NOT NULL,
	source TEXT NOT NULL,
	fetched_at TEXT NOT NULL,
	PRIMARY KEY (package_id, metric, date),
	FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_download_snapshots_date ON download_snapshots (date);
CREATE INDEX IF NOT EXISTS idx_download_snapshots_package_date ON download_snapshots (package_id, date DESC);

CREATE TABLE IF NOT EXISTS etl_runs (
	id TEXT PRIMARY KEY,
	started_at TEXT NOT NULL,
	completed_at TEXT,
	status TEXT NOT NULL,
	packages_total INTEGER NOT NULL,
	packages_updated INTEGER NOT NULL,
	errors_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_etl_runs_started_at ON etl_runs (started_at DESC);
