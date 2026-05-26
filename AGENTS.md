# Project Summary

This repo has two core components:

1. ETL: A scheduled or manually triggered ingestion process keeps the package catalog and registry-derived download/version activity up to date. It fetches supported registry data asynchronously, validates/parses external responses, records ingestion run status, and persists normalized rows for the web app to read.

2. Web App: A read-focused user interface for exploring package activity. It renders the home dashboard and per-package views from persisted data, including package search/regex filtering, registry filters, package trend comparison, top-package and ecosystem charts, and per-package download/version views. Viewer-facing routes must treat persisted data as the source of truth for registry-derived metrics.

# Repository Rules

## Package manager

Use `bun`.

## Linting and formating

Use `oxlint` and `oxfmt`.

## Testing

Use `vitest` as the test runner, and prefer integration-style tests. Example: https://github.com/cloudflare/workers-sdk/tree/main/fixtures/vitest-pool-workers-examples/workflows

## Package Registry Data

The web app must not make direct request-time API calls to npm, package registries, or other external package-data services from pages, route handlers, server components, client components, or UI data loaders.

Registry stats and version activity must be fetched asynchronously by ingestion code, such as Cloudflare Workflows, cron-triggered jobs, or explicit ingestion modules. UI-facing code may read registry-derived data only from our own database.

Local static package catalog metadata can be used as a package list fallback, but registry-derived stats must not be synthesized or fetched directly by the web app.

Registry API clients belong in ingestion modules, not in request-time web app code.
