# ReproBuild Lab

A premium interactive research prototype for exploring reproducible development environments, dependency drift, build security, and caching strategies across Nix, Bazel, Docker, and devcontainers.

**Live demo:** https://reprobuild-lab.pages.dev/

## Features

### Reproducibility Lab

- Compare Traditional, Devcontainer, Nix, and Nix + Bazel workflows
- Explore dependency version pinning and provenance
- Simulate “works on my machine” dependency drift
- Inspect configuration differences and reproducibility risks
- Visualize how Nix and Bazel complement each other
- View sample Nix, Bazel, Dockerfile, and devcontainer configurations

### Build Security & Benchmarks

- Compare Nix and Docker supply-chain threat models
- Search and filter an interactive SBOM inventory
- Model build times, cache hits, CI consistency, and source churn
- Compare plain Bazel with Nix + Bazel dependency management
- Explore ThinLTO, dead stripping, and split-debug trade-offs
- Generate a downloadable Markdown research report

## Technology

- React
- TypeScript
- Vite
- Tailwind CSS
- Lucide React
- Recharts
- Cloudflare Pages
- Wrangler

## Important Disclaimer

All benchmark timings, cache rates, risk indices, and performance estimates are deterministic synthetic scenarios. They are intended for research exploration and planning—not as claims of real-world measured performance.

## Run Locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Production Build

```bash
npm run build
