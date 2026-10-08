import { type ButtonHTMLAttributes, type CSSProperties, type ReactNode, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Boxes,
  Check,
  CircleDotDashed,
  Clock3,
  Code2,
  Container,
  Cpu,
  FileDown,
  FileSearch,
  Fingerprint,
  Gauge,
  GitBranch,
  Hexagon,
  Link2,
  LockKeyhole,
  Search,
  PackageCheck,
  Play,
  RefreshCcw,
  ShieldAlert,
  Menu,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TerminalSquare,
  TriangleAlert,
  Waypoints,
  Zap,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";

type Page = "lab" | "security";
type SystemKey = "Traditional" | "Devcontainer" | "Nix" | "Nix + Bazel";
type WebMcpModelContext = {
  registerTool: (tool: {
    name: string;
    title: string;
    description: string;
    inputSchema: Record<string, unknown>;
    annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
    execute: (input: unknown) => unknown;
  }, options?: { signal?: AbortSignal }) => void | Promise<void>;
};

function webMcpContext() {
  return (document as Document & { modelContext?: WebMcpModelContext }).modelContext;
}

const systems: Record<
  SystemKey,
  { icon: typeof TerminalSquare; score: number; pinning: string; isolation: string; accent: string; risk: number }
> = {
  Traditional: { icon: TerminalSquare, score: 42, pinning: "Partial", isolation: "Host", accent: "#f97316", risk: 78 },
  Devcontainer: { icon: Container, score: 68, pinning: "Image tag", isolation: "Container", accent: "#38bdf8", risk: 52 },
  Nix: { icon: Hexagon, score: 91, pinning: "Full graph", isolation: "Store", accent: "#2dd4bf", risk: 19 },
  "Nix + Bazel": { icon: Boxes, score: 96, pinning: "Source + action", isolation: "Hermetic", accent: "#a3e635", risk: 11 },
};

const baseDeps = [
  { name: "app", version: "workspace", x: 50, y: 10, type: "root" },
  { name: "nodejs", version: "20.15.1", x: 22, y: 38, type: "runtime" },
  { name: "openssl", version: "3.3.1", x: 50, y: 38, type: "system" },
  { name: "protobuf", version: "27.2", x: 78, y: 38, type: "tool" },
  { name: "glibc", version: "2.39-52", x: 34, y: 70, type: "system" },
  { name: "zlib", version: "1.3.1", x: 66, y: 70, type: "system" },
];

const chartData = [
  { name: "Setup", traditional: 31, devcontainer: 18, nix: 9, hybrid: 8 },
  { name: "CI drift", traditional: 38, devcontainer: 24, nix: 7, hybrid: 4 },
  { name: "Onboard", traditional: 29, devcontainer: 15, nix: 10, hybrid: 7 },
  { name: "Upgrade", traditional: 34, devcontainer: 22, nix: 12, hybrid: 8 },
];

const sbomPackages = [
  { name: "nodejs", version: "20.15.1", scope: "Runtime", origin: "nixpkgs", license: "MIT", pin: "sha256:c8a2", risk: "low", path: "flake.lock → nixpkgs → nodejs_20" },
  { name: "openssl", version: "3.3.1", scope: "Runtime", origin: "nixpkgs", license: "Apache-2.0", pin: "sha256:bb18", risk: "review", path: "flake.lock → stdenv → openssl" },
  { name: "rules_js", version: "2.0.0", scope: "Build", origin: "BCR", license: "Apache-2.0", pin: "integrity:792d", risk: "low", path: "MODULE.bazel → BCR → rules_js" },
  { name: "protobuf", version: "27.2", scope: "Build", origin: "nixpkgs", license: "BSD-3", pin: "sha256:51cf", risk: "low", path: "flake.lock → nixpkgs → protobuf" },
  { name: "zlib", version: "1.3.1", scope: "Runtime", origin: "nixpkgs", license: "Zlib", pin: "sha256:73d4", risk: "low", path: "nixpkgs → openssl → zlib" },
  { name: "esbuild", version: "0.23.1", scope: "Build", origin: "npm", license: "MIT", pin: "sha512:1df7", risk: "review", path: "pnpm-lock.yaml → esbuild" },
];

const snippets = {
  Nix: `{
  description = "Pinned ReproBuild shell";
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.05";
  outputs = { self, nixpkgs }: {
    devShells.x86_64-linux.default =
      nixpkgs.legacyPackages.x86_64-linux.mkShell {
        packages = with nixpkgs.legacyPackages.x86_64-linux;
          [ nodejs_20 bazel_7 protobuf ];
      };
  };
}`,
  Bazel: `module(name = "reprobuild_lab", version = "0.1.0")
bazel_dep(name = "rules_js", version = "2.0.0")
bazel_dep(name = "rules_proto", version = "7.1.0")

# Nix supplies the pinned toolchain;
# Bazel isolates and caches each action.`,
  Dockerfile: `FROM node:20.15.1-bookworm@sha256:94a6…
WORKDIR /workspace
COPY package-lock.json package.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build`,
  devcontainer: `{
  "name": "ReproBuild Lab",
  "image": "mcr.microsoft.com/devcontainers/base:bookworm",
  "features": { "ghcr.io/devcontainers/features/node:1": { "version": "20" } },
  "postCreateCommand": "npm ci"
}`,
};

function BrandMark() {
  return (
    <div className="brand-mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  );
}

function Button({ children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 font-medium transition ${className}`} {...props}>{children}</button>;
}

function AppShell({ page, children }: { page: Page; children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="app-shell">
      <aside className={`app-sidebar ${mobileOpen ? "is-mobile-open" : ""}`}>
        <div className="px-5 pb-4 pt-6">
          <div className="flex items-center gap-3">
            <BrandMark />
            <div>
              <div className="font-semibold tracking-tight text-white">ReproBuild Lab</div>
              <div className="mt-0.5 text-[12px] text-slate-500">research prototype / 01</div>
            </div>
          </div>
        </div>
        <nav className="px-3" aria-label="Primary navigation">
          <a href="/" className={`side-link ${page === "lab" ? "is-active" : ""}`}><CircleDotDashed /><span>Reproducibility Lab</span></a>
          <a href="/security" className={`side-link ${page === "security" ? "is-active" : ""}`}><ShieldCheck /><span>Security & Benchmarks</span></a>

          <div className="mx-3 mt-5 rounded-2xl border border-white/8 bg-white/[0.035] p-4">
            <div className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.14em] text-slate-500">
              <Activity className="size-3.5 text-teal-400" /> Study scope
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between"><span className="text-slate-400">Scenarios</span><span className="font-mono text-white">04</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-400">Dependencies</span><span className="font-mono text-white">18</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-400">Mode</span><span className="rounded-md bg-teal-400/10 px-2 py-1 text-xs text-teal-300">Synthetic</span></div>
            </div>
          </div>
        </nav>
        <div className="mt-auto p-5">
          <div className="rounded-xl border border-amber-400/15 bg-amber-400/5 p-3 text-xs leading-relaxed text-slate-400">
            <span className="font-medium text-amber-300">Research note</span><br />All metrics are deterministic estimates, not measured benchmarks.
          </div>
        </div>
      </aside>
      {mobileOpen && <button className="sidebar-scrim" aria-label="Close menu" onClick={() => setMobileOpen(false)} />}
      <div className="min-w-0 flex-1 bg-[#f4f7fa]">
        <div className="min-h-svh">
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/85 px-4 backdrop-blur-xl sm:px-7">
            <div className="flex items-center gap-3">
              <button onClick={() => setMobileOpen(true)} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 md:hidden" aria-label="Open navigation"><Menu className="size-4" /></button>
              <div>
                <div className="text-[12px] font-semibold uppercase tracking-[0.15em] text-teal-700">ReproBuild / {page === "lab" ? "Lab" : "Security"}</div>
                <div className="text-sm text-slate-500">Deterministic scenario · seed RB-2405</div>
              </div>
            </div>
            <div className="hidden items-center gap-2 sm:flex">
              <span className="h-2 w-2 rounded-full bg-teal-500 shadow-[0_0_0_4px_rgba(20,184,166,.12)]" />
              <span className="text-sm font-medium text-slate-600">Simulation ready</span>
            </div>
          </header>
          {children}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, delta, icon: Icon }: { label: string; value: string; delta: string; icon: typeof Clock3 }) {
  return (
    <div className="metric-card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
        </div>
        <div className="rounded-xl border border-teal-100 bg-teal-50 p-2.5 text-teal-700"><Icon className="size-4" /></div>
      </div>
      <p className="mt-3 text-xs font-medium text-teal-700">{delta}</p>
    </div>
  );
}

function DependencyGraph({ drift }: { drift: number }) {
  const deps = useMemo(() => baseDeps.map((dep, index) => {
    const changed = drift > 0 && ((index + drift) % 3 === 0 || (drift > 1 && index === 4));
    return { ...dep, changed, display: changed ? `${dep.version.split("-")[0]}+host.${drift}` : dep.version };
  }), [drift]);

  return (
    <div className="graph-canvas" role="img" aria-label="Interactive dependency provenance graph">
      <div className="graph-grid" />
      <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id="edge" x1="0" x2="1"><stop stopColor="#5eead4" stopOpacity=".75" /><stop offset="1" stopColor="#94a3b8" stopOpacity=".2" /></linearGradient>
        </defs>
        <line x1="50%" y1="21%" x2="22%" y2="48%" stroke="url(#edge)" />
        <line x1="50%" y1="21%" x2="50%" y2="48%" stroke="url(#edge)" />
        <line x1="50%" y1="21%" x2="78%" y2="48%" stroke="url(#edge)" />
        <line x1="22%" y1="49%" x2="34%" y2="80%" stroke="url(#edge)" />
        <line x1="50%" y1="49%" x2="34%" y2="80%" stroke="url(#edge)" />
        <line x1="50%" y1="49%" x2="66%" y2="80%" stroke="url(#edge)" />
        <line x1="78%" y1="49%" x2="66%" y2="80%" stroke="url(#edge)" />
      </svg>
      {deps.map((dep) => (
        <div key={dep.name} className={`graph-node ${dep.changed ? "is-drifted" : ""} ${dep.type === "root" ? "is-root" : ""}`} style={{ left: `${dep.x}%`, top: `${dep.y}%` }}>
          <div className="flex items-center gap-2">
            {dep.changed ? <TriangleAlert className="size-3.5 text-amber-600" /> : <Fingerprint className="size-3.5 text-teal-600" />}
            <span className="font-semibold text-slate-800">{dep.name}</span>
          </div>
          <span className="mt-1 block font-mono text-[11px] text-slate-500">{dep.display}</span>
        </div>
      ))}
    </div>
  );
}

function LabPage() {
  const [system, setSystem] = useState<SystemKey>("Nix + Bazel");
  const [os, setOs] = useState("Linux x86_64");
  const [runtime, setRuntime] = useState("Node 20 LTS");
  const [drift, setDrift] = useState(0);
  const [snippet, setSnippet] = useState<keyof typeof snippets>("Nix");
  const current = systems[system];

  useEffect(() => {
    const context = webMcpContext();
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: "run_dependency_drift",
      title: "Run dependency drift",
      description: "Run a deterministic host-dependency drift scenario and update the visible provenance graph.",
      inputSchema: { type: "object", properties: { intensity: { type: "integer", minimum: 1, maximum: 2 } }, required: ["intensity"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        const intensity = (input as { intensity?: unknown })?.intensity;
        if (intensity !== 1 && intensity !== 2) throw new Error("intensity must be 1 or 2");
        setDrift(intensity);
        return { scenario: "RB-2405", intensity, status: "visible" };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);

  return (
    <main className="page-wrap">
      <section className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="eyebrow"><Sparkles className="size-3.5" /> Reproducibility explorer</div>
          <h1 className="page-title">Model the environment.<br /><span>Expose the drift.</span></h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-500">Compare environment strategies across pinning depth, isolation, provenance, and CI parity using the same deterministic application graph.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={os} onChange={(event) => setOs(event.target.value)} className="select-control" aria-label="Target operating system">
            <option>Linux x86_64</option><option>macOS arm64</option><option>CI runner</option>
          </select>
          <select value={runtime} onChange={(event) => setRuntime(event.target.value)} className="select-control" aria-label="Target runtime">
            <option>Node 20 LTS</option><option>Node 22</option><option>JDK 21</option>
          </select>
        </div>
      </section>

      <section className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {(Object.keys(systems) as SystemKey[]).map((key) => {
          const item = systems[key];
          const Icon = item.icon;
          return (
            <button key={key} className={`system-card ${system === key ? "is-selected" : ""}`} onClick={() => setSystem(key)} style={{ "--system-accent": item.accent } as CSSProperties}>
              <div className="flex items-center justify-between">
                <span className="system-icon"><Icon className="size-4" /></span>
                <span className="font-mono text-xs text-slate-400">{item.score}/100</span>
              </div>
              <div className="mt-5 text-left">
                <div className="font-semibold text-slate-900">{key}</div>
                <div className="mt-1 text-xs text-slate-500">{item.pinning} · {item.isolation}</div>
              </div>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${item.score}%`, background: item.accent }} /></div>
            </button>
          );
        })}
      </section>

      <section className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Metric label="Reproducibility index" value={`${current.score}%`} delta={`+${Math.max(current.score - 42, 0)} pts vs host setup`} icon={PackageCheck} />
        <Metric label="Configuration drift risk" value={`${current.risk}%`} delta={current.risk < 25 ? "Low residual risk" : "Attention recommended"} icon={TriangleAlert} />
        <Metric label="Environment fingerprint" value="sha256:5d92" delta={`${os} · ${runtime}`} icon={Fingerprint} />
      </section>

      <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.45fr_.85fr]">
        <div className="panel overflow-hidden">
          <div className="panel-head">
            <div><h2>Dependency provenance</h2><p>Resolved graph for {system}</p></div>
            <Button onClick={() => setDrift((drift + 1) % 3)} className="h-9 bg-slate-950 text-white hover:bg-slate-800">
              {drift === 0 ? <Play className="size-4" /> : <RefreshCcw className="size-4" />} {drift === 0 ? "Simulate drift" : "Run again"}
            </Button>
          </div>
          <DependencyGraph drift={drift} />
          <div className={`drift-strip ${drift ? "is-active" : ""}`}>
            <div className="flex items-center gap-2">
              {drift ? <TriangleAlert className="size-4" /> : <Check className="size-4" />}
              <strong>{drift ? `${drift + 1} host-resolved versions diverged` : "All dependency inputs match the lock graph"}</strong>
            </div>
            <span>{drift ? "A host-level transitive update can alter the output." : "Run the deterministic drift scenario to inspect failure points."}</span>
          </div>
        </div>

        <div className="panel p-5 sm:p-6">
          <div className="flex items-start justify-between"><div><h2 className="panel-title">Configuration diff</h2><p className="panel-subtitle">Host vs locked target</p></div><GitBranch className="size-5 text-teal-600" /></div>
          <div className="mt-6 space-y-4">
            {[
              ["Runtime", runtime, system === "Traditional" ? "PATH lookup" : "content-addressed"],
              ["System libs", "openssl / zlib", system === "Nix + Bazel" ? "pinned closure" : "base layer"],
              ["Build actions", "12 steps", system.includes("Bazel") ? "sandboxed" : "shared shell"],
              ["Network", "dependency fetch", system === "Nix + Bazel" ? "evaluation only" : "build-time"],
            ].map(([label, value, state]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                <div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</span><span className="rounded-md bg-white px-2 py-1 font-mono text-[11px] text-slate-600 shadow-sm">{state}</span></div>
                <div className="mt-2 text-sm font-medium text-slate-800">{value}</div>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-xl border border-teal-100 bg-teal-50/70 p-4 text-sm leading-relaxed text-teal-900">
            <strong>Nix + Bazel split:</strong> Nix pins the toolchain and native libraries; Bazel hermetically executes and caches the build graph.
          </div>
        </div>
      </section>

      <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_.9fr]">
        <div className="panel p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="panel-title">Friction by workflow</h2><p className="panel-subtitle">Synthetic effort index · lower is better</p></div><span className="simulation-pill">modeled data</span></div>
          <div className="mt-5 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barGap={2}>
                <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <ChartTooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 12px 30px rgba(15,23,42,.1)" }} />
                <Bar dataKey="traditional" name="Traditional" fill="#f97316" radius={[3, 3, 0, 0]} />
                <Bar dataKey="devcontainer" name="Devcontainer" fill="#38bdf8" radius={[3, 3, 0, 0]} />
                <Bar dataKey="nix" name="Nix" fill="#2dd4bf" radius={[3, 3, 0, 0]} />
                <Bar dataKey="hybrid" name="Nix + Bazel" fill="#84cc16" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="panel p-5 sm:p-6">
          <div className="flex items-center justify-between"><div><h2 className="panel-title">Configuration samples</h2><p className="panel-subtitle">Minimal, illustrative baselines</p></div><Code2 className="size-5 text-teal-600" /></div>
          <div className="mt-5">
            <div className="flex w-full gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1" role="tablist" aria-label="Configuration samples">
              {(Object.keys(snippets) as Array<keyof typeof snippets>).map((name) => <button key={name} onClick={() => setSnippet(name)} className={`code-tab ${snippet === name ? "is-active" : ""}`} role="tab" aria-selected={snippet === name}>{name}</button>)}
            </div>
            <pre className="code-block"><code>{snippets[snippet]}</code></pre>
          </div>
        </div>
      </section>
    </main>
  );
}

function ThreatCard({
  title,
  icon: Icon,
  tone,
  summary,
  scores,
}: {
  title: string;
  icon: typeof ShieldCheck;
  tone: "teal" | "blue";
  summary: string;
  scores: Array<[string, number]>;
}) {
  return (
    <div className={`threat-card threat-${tone}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3"><span className="threat-icon"><Icon className="size-5" /></span><div><h3>{title}</h3><p>{summary}</p></div></div>
        <span className="rounded-full border border-current/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wider">modeled</span>
      </div>
      <div className="mt-6 space-y-4">
        {scores.map(([label, score]) => (
          <div key={label}>
            <div className="mb-1.5 flex items-center justify-between text-xs"><span className="text-slate-500">{label}</span><span className="font-mono font-semibold text-slate-700">{score}/100</span></div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-current" style={{ width: `${score}%` }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ToggleChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" onClick={onClick} className={`toggle-chip ${active ? "is-active" : ""}`} aria-pressed={active}>{active && <Check className="size-3.5" />}{children}</button>;
}

function SecurityPage() {
  const [scope, setScope] = useState("All");
  const [query, setQuery] = useState("");
  const [selectedPackage, setSelectedPackage] = useState(sbomPackages[0]);
  const [workload, setWorkload] = useState("Mixed monorepo");
  const [modules, setModules] = useState(72);
  const [churn, setChurn] = useState(18);
  const [remoteCache, setRemoteCache] = useState(true);
  const [thinLto, setThinLto] = useState(true);
  const [deadStrip, setDeadStrip] = useState(true);
  const [splitDebug, setSplitDebug] = useState(false);
  const [reportReady, setReportReady] = useState(false);

  const visiblePackages = sbomPackages.filter((item) => (scope === "All" || item.scope === scope) && item.name.includes(query.toLowerCase()));
  const workloadFactor = workload === "Native services" ? 1.55 : workload === "TypeScript apps" ? 0.72 : 1;
  const coldBase = Math.round((42 + modules * .82) * workloadFactor);
  const cacheBoost = remoteCache ? .34 : .62;
  const incremental = Math.max(5, Math.round(coldBase * cacheBoost * (.55 + churn / 100)));
  const benchmarkData = [
    { scenario: "Cold", bazel: coldBase, hybrid: Math.round(coldBase * .86) },
    { scenario: "Warm", bazel: incremental, hybrid: Math.round(incremental * .72) },
    { scenario: "CI replay", bazel: Math.round(coldBase * .61), hybrid: Math.round(coldBase * (remoteCache ? .26 : .48)) },
  ];
  const cacheHit = Math.max(38, Math.min(96, Math.round(91 - churn * .7 + (remoteCache ? 9 : 0))));
  const linkTime = Math.round(84 * (thinLto ? .82 : 1) * (deadStrip ? 1.08 : 1) * (splitDebug ? .9 : 1));
  const binarySize = Math.round(118 * (thinLto ? .89 : 1) * (deadStrip ? .72 : 1) * (splitDebug ? .76 : 1));

  useEffect(() => {
    const context = webMcpContext();
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: "configure_build_scenario",
      title: "Configure build scenario",
      description: "Configure the visible deterministic build and cache scenario using workload, module count, churn, and remote-cache settings.",
      inputSchema: {
        type: "object",
        properties: {
          workload: { type: "string", enum: ["Mixed monorepo", "TypeScript apps", "Native services"] },
          modules: { type: "integer", minimum: 24, maximum: 120 },
          churn: { type: "integer", minimum: 5, maximum: 45 },
          remoteCache: { type: "boolean" },
        },
        required: ["workload", "modules", "churn", "remoteCache"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        const next = input as { workload?: unknown; modules?: unknown; churn?: unknown; remoteCache?: unknown };
        if (!["Mixed monorepo", "TypeScript apps", "Native services"].includes(String(next.workload))) throw new Error("unsupported workload");
        if (!Number.isInteger(next.modules) || Number(next.modules) < 24 || Number(next.modules) > 120) throw new Error("modules must be an integer from 24 to 120");
        if (!Number.isInteger(next.churn) || Number(next.churn) < 5 || Number(next.churn) > 45) throw new Error("churn must be an integer from 5 to 45");
        if (typeof next.remoteCache !== "boolean") throw new Error("remoteCache must be boolean");
        setWorkload(String(next.workload)); setModules(Number(next.modules)); setChurn(Number(next.churn)); setRemoteCache(next.remoteCache);
        return { scenario: "RB-2405", workload: next.workload, modules: next.modules, churn: next.churn, remoteCache: next.remoteCache, status: "visible" };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);

  function downloadReport() {
    const report = `# ReproBuild Lab — Research Comparison\n\nGenerated from deterministic scenario RB-2405. These values are simulated estimates, not measured benchmarks.\n\n## Scenario\n- Workload: ${workload}\n- Modules: ${modules}\n- Source churn: ${churn}%\n- Remote cache: ${remoteCache ? "enabled" : "disabled"}\n- Estimated cache hit: ${cacheHit}%\n\n## Dependency management\nNix pins system inputs and toolchains by content-addressed store paths. Bazel models isolated build actions and cache keys. The hybrid scenario assigns each layer to the system with the narrower responsibility.\n\n## Supply-chain comparison\n- Nix modeled exposure: registry 18, build phase 14, runtime 9.\n- Docker modeled exposure: registry 52, build phase 62, runtime 47.\n- SBOM inventory: ${sbomPackages.length} representative packages, ${sbomPackages.filter((item) => item.risk === "review").length} marked for review.\n\n## Build scenario\n- Nix+Bazel cold estimate: ${benchmarkData[0].hybrid}s\n- Nix+Bazel warm estimate: ${benchmarkData[1].hybrid}s\n- Nix+Bazel CI replay estimate: ${benchmarkData[2].hybrid}s\n\n## Linking model\n- ThinLTO: ${thinLto ? "on" : "off"}\n- Dead stripping: ${deadStrip ? "on" : "off"}\n- Split debug info: ${splitDebug ? "on" : "off"}\n- Estimated link time: ${linkTime}s\n- Estimated binary size: ${binarySize} MB\n\n## Interpretation\nThe hybrid model offers the strongest consistency when Nix owns external toolchain closure and Bazel owns action-level execution and caching. Added configuration complexity should be justified by repository scale, native dependencies, and cache reuse.\n`;
    const url = URL.createObjectURL(new Blob([report], { type: "text/markdown" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "reprobuild-research-comparison.md";
    link.click();
    URL.revokeObjectURL(url);
    setReportReady(true);
  }

  return (
    <main className="page-wrap">
      <section className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="eyebrow"><LockKeyhole className="size-3.5" /> Build security & benchmarks</div>
          <h1 className="page-title">Trace every input.<br /><span>Trust the output.</span></h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-500">Inspect supply-chain boundaries, dependency inventory, cache behavior, and linking trade-offs using transparent synthetic scenarios.</p>
        </div>
        <Button onClick={downloadReport} className="h-11 bg-slate-950 px-4 text-sm text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800">
          <FileDown className="size-4" /> {reportReady ? "Report generated" : "Generate research report"}
        </Button>
      </section>

      <div className="mt-7 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
        <strong>Simulation boundary:</strong> timings, risk indices, and cache rates below are deterministic planning estimates. They are not empirical measurements.
      </div>

      <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr_.72fr]">
        <ThreatCard title="Nix closure model" icon={Hexagon} tone="teal" summary="Source + derivation trust" scores={[["Registry exposure",18],["Build phase",14],["Runtime surface",9]]} />
        <ThreatCard title="Docker image model" icon={Container} tone="blue" summary="Layer + registry trust" scores={[["Registry exposure",52],["Build phase",62],["Runtime surface",47]]} />
        <div className="panel p-5">
          <div className="flex items-center justify-between"><div><h2 className="panel-title">Isolation ledger</h2><p className="panel-subtitle">Control boundary coverage</p></div><ShieldAlert className="size-5 text-amber-500" /></div>
          <div className="mt-5 space-y-3">
            {[["Immutable inputs","Nix","strong"],["Build sandbox","Bazel","strong"],["Runtime boundary","Docker","strong"],["Secret handling","CI","external"]].map(([control, owner, level]) => (
              <div key={control} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5"><div><div className="text-sm font-medium text-slate-800">{control}</div><div className="text-xs text-slate-400">{owner} responsibility</div></div><span className={`status-badge ${level === "strong" ? "is-strong" : ""}`}>{level}</span></div>
            ))}
          </div>
        </div>
      </section>

      <section className="panel mt-4 overflow-hidden">
        <div className="panel-head flex-wrap">
          <div><h2>SBOM & dependency inventory</h2><p>Representative locked inputs with provenance paths</p></div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="search-field"><Search className="size-4" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter packages" aria-label="Filter packages" /></label>
            {(["All","Runtime","Build"] as const).map((item) => <ToggleChip key={item} active={scope === item} onClick={() => setScope(item)}>{item}</ToggleChip>)}
          </div>
        </div>
        <div className="grid min-h-[360px] grid-cols-1 lg:grid-cols-[1.4fr_.6fr]">
          <div className="overflow-x-auto border-b border-slate-200 lg:border-b-0 lg:border-r">
            <table className="tech-table">
              <thead><tr><th>Package</th><th>Scope</th><th>Origin</th><th>License</th><th>Integrity</th><th>Status</th></tr></thead>
              <tbody>
                {visiblePackages.map((item) => (
                  <tr key={item.name} onClick={() => setSelectedPackage(item)} className={selectedPackage.name === item.name ? "is-selected" : ""}>
                    <td><strong>{item.name}</strong><span>{item.version}</span></td><td>{item.scope}</td><td>{item.origin}</td><td>{item.license}</td><td><code>{item.pin}</code></td><td><span className={`risk-dot risk-${item.risk}`} />{item.risk}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <aside className="bg-slate-50/70 p-5 sm:p-6">
            <div className="flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-[.12em] text-slate-400">Provenance detail</span><FileSearch className="size-4 text-teal-600" /></div>
            <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4"><div className="text-lg font-semibold text-slate-900">{selectedPackage.name}</div><div className="mt-1 font-mono text-xs text-slate-500">{selectedPackage.version}</div></div>
            <div className="mt-5 text-xs font-semibold uppercase tracking-wider text-slate-400">Resolution path</div>
            <div className="mt-3 rounded-xl border border-teal-100 bg-teal-50 p-4 font-mono text-xs leading-relaxed text-teal-900">{selectedPackage.path}</div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm"><div className="rounded-lg bg-white p-3"><span className="block text-xs text-slate-400">License</span>{selectedPackage.license}</div><div className="rounded-lg bg-white p-3"><span className="block text-xs text-slate-400">Review</span>{selectedPackage.risk}</div></div>
          </aside>
        </div>
      </section>

      <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_.8fr]">
        <div className="panel p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="panel-title">Build & cache scenario</h2><p className="panel-subtitle">Estimated seconds · lower is better</p></div><span className="simulation-pill">synthetic scenario</span></div>
          <div className="mt-5 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3">
            <label className="scenario-control"><span>Workload</span><select value={workload} onChange={(event) => setWorkload(event.target.value)}><option>Mixed monorepo</option><option>TypeScript apps</option><option>Native services</option></select></label>
            <label className="scenario-control"><span>Modules <b>{modules}</b></span><input type="range" min="24" max="120" step="8" value={modules} onChange={(event) => setModules(Number(event.target.value))} /></label>
            <label className="scenario-control"><span>Source churn <b>{churn}%</b></span><input type="range" min="5" max="45" step="1" value={churn} onChange={(event) => setChurn(Number(event.target.value))} /></label>
          </div>
          <div className="mt-6 h-[285px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={benchmarkData} barGap={4}>
                <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="scenario" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                <YAxis unit="s" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <ChartTooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }} />
                <Bar dataKey="bazel" name="Plain Bazel" fill="#94a3b8" radius={[5,5,0,0]} />
                <Bar dataKey="hybrid" name="Nix + Bazel" fill="#14b8a6" radius={[5,5,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel p-5 sm:p-6">
          <div className="flex items-center justify-between"><div><h2 className="panel-title">Cache behavior</h2><p className="panel-subtitle">Scenario-derived indicators</p></div><Gauge className="size-5 text-teal-600" /></div>
          <button onClick={() => setRemoteCache(!remoteCache)} className={`cache-toggle ${remoteCache ? "is-active" : ""}`} aria-pressed={remoteCache}>
            <span><strong>Remote cache</strong><small>Shared CI artifacts</small></span><span className="switch-track"><span /></span>
          </button>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="cache-stat"><span>Hit rate</span><strong>{cacheHit}%</strong><div><i style={{ width: `${cacheHit}%` }} /></div></div>
            <div className="cache-stat"><span>CI replay</span><strong>{benchmarkData[2].hybrid}s</strong><small>estimated</small></div>
            <div className="cache-stat"><span>Action keys</span><strong>{modules * 14}</strong><small>modeled</small></div>
            <div className="cache-stat"><span>Consistency</span><strong>{remoteCache ? "High" : "Medium"}</strong><small>across runners</small></div>
          </div>
          <div className="mt-5 rounded-xl border border-slate-200 p-4 text-sm leading-relaxed text-slate-600"><strong className="text-slate-900">Interpretation:</strong> cache reuse rises when toolchain identity is stable and source churn stays narrow. Remote storage changes transfer costs, not action correctness.</div>
        </div>
      </section>

      <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_.78fr]">
        <div className="panel overflow-hidden">
          <div className="panel-head"><div><h2>Plain Bazel vs Nix + Bazel</h2><p>Dependency ownership and build responsibility</p></div><Waypoints className="size-5 text-teal-600" /></div>
          <div className="overflow-x-auto"><table className="compare-table"><thead><tr><th>Concern</th><th>Plain Bazel</th><th>Nix + Bazel</th></tr></thead><tbody>
            {[
              ["System toolchain","Repository rules or host setup","Nix closure"],
              ["Language deps","Bazel module / ruleset","Bazel module / ruleset"],
              ["Native libraries","Custom fetch/build logic","nixpkgs derivations"],
              ["Action cache","Bazel CAS","Bazel CAS + stable toolchain key"],
              ["CI parity","Runner image + Bazel","Same flake + Bazel graph"],
              ["Complexity cost","One build language","Two layers, clearer boundary"],
            ].map((row) => <tr key={row[0]}>{row.map((cell, index) => <td key={cell} className={index === 2 ? "hybrid-cell" : ""}>{index === 0 ? <strong>{cell}</strong> : cell}</td>)}</tr>)}
          </tbody></table></div>
        </div>

        <div className="panel p-5 sm:p-6">
          <div className="flex items-center justify-between"><div><h2 className="panel-title">Linking optimizer</h2><p className="panel-subtitle">Opportunity and trade-off model</p></div><Link2 className="size-5 text-teal-600" /></div>
          <div className="mt-5 space-y-2">
            <button className={`optimization-row ${thinLto ? "is-active" : ""}`} onClick={() => setThinLto(!thinLto)}><span><Cpu />ThinLTO<small>Parallel cross-module optimization</small></span><b>{thinLto ? "On" : "Off"}</b></button>
            <button className={`optimization-row ${deadStrip ? "is-active" : ""}`} onClick={() => setDeadStrip(!deadStrip)}><span><Zap />Dead stripping<small>Smaller binary, extra link work</small></span><b>{deadStrip ? "On" : "Off"}</b></button>
            <button className={`optimization-row ${splitDebug ? "is-active" : ""}`} onClick={() => setSplitDebug(!splitDebug)}><span><SlidersHorizontal />Split debug info<small>Faster distribution, extra artifacts</small></span><b>{splitDebug ? "On" : "Off"}</b></button>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-xl bg-slate-950 p-4 text-white"><span className="text-xs text-slate-400">Link estimate</span><strong className="mt-2 block text-2xl">{linkTime}s</strong></div><div className="rounded-xl bg-teal-50 p-4 text-teal-950"><span className="text-xs text-teal-700">Binary estimate</span><strong className="mt-2 block text-2xl">{binarySize} MB</strong></div></div>
          <p className="mt-4 text-xs leading-relaxed text-slate-500">ThinLTO and stripping can reduce artifact size; debug splitting improves distribution but adds artifact coordination. Validate against real workloads before adoption.</p>
        </div>
      </section>
    </main>
  );
}

export function ReproBuildApp({ page }: { page: Page }) {
  return <AppShell page={page}>{page === "lab" ? <LabPage /> : <SecurityPage />}</AppShell>;
}
