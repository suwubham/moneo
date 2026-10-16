"use client";

import { useRouter } from "next/navigation";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney } from "@/lib/core/money";

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const tick = { fill: "var(--ink-soft)", fontSize: 11, fontFamily: "var(--font-jetbrains), monospace" };
const axis = { axisLine: false, tickLine: false, tick } as const;
const grid = <CartesianGrid vertical={false} stroke="var(--line)" />;

type Series = { key: string; label: string; color: string };

// Values lead, names follow, each row keyed by a short stroke of its colour.
type TipProps = {
  active?: boolean;
  payload?: readonly { dataKey?: unknown; value?: unknown; payload?: unknown }[];
  label?: unknown;
  currency: string;
  series: Series[];
};

function Tip({ active, payload, label, currency, series }: TipProps) {
  if (!active || !payload?.length) return null;
  const title = (payload[0].payload as { label?: string }).label ?? String(label ?? "");
  return (
    <div className="rounded-xl border border-line bg-night-2 px-3.5 py-2.5 shadow-[0_18px_40px_-20px_rgba(0,0,0,.6)]">
      <p className="label mb-1.5">{title}</p>
      {series.map((s) => {
        const v = payload.find((p) => p.dataKey === s.key)?.value;
        if (v == null) return null;
        return (
          <p key={s.key} className="flex items-center gap-2 text-[.9rem]">
            <span aria-hidden className="h-0.5 w-3 rounded-full" style={{ background: s.color }} />
            <span className="font-semibold tabular-nums">{formatMoney(Number(v), currency)}</span>
            <span className="text-ink-soft">{s.label}</span>
          </p>
        );
      })}
    </div>
  );
}

function Legend({ series, line = false }: { series: Series[]; line?: boolean }) {
  return (
    <ul className="label flex flex-wrap gap-4">
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span aria-hidden className={line ? "h-0.5 w-3.5 rounded-full" : "size-2.5 rounded-[3px]"} style={{ background: s.color }} />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

// The same numbers as a table, for screen readers.
function TableTwin({ caption, head, rows }: { caption: string; head: string[]; rows: (string | number)[][] }) {
  return (
    // The wrapper hides it: a table will not shrink to sr-only's 1px and would widen the page.
    <div className="sr-only">
      <table>
      <caption>{caption}</caption>
      <thead>
        <tr>
          {head.map((h) => (
            <th key={h}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (
              <td key={j}>{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}

export type FlowPoint = { key: string; label: string; moneyIn: number; moneyOut: number; href: string };

const flowSeries: Series[] = [
  { key: "moneyIn", label: "in", color: "var(--chart-in)" },
  { key: "moneyOut", label: "out", color: "var(--chart-out)" },
];

export function FlowChart({ data, currency, active }: { data: FlowPoint[]; currency: string; active: string }) {
  const router = useRouter();
  return (
    <div className="flex flex-1 flex-col gap-3">
      <Legend series={flowSeries} />
      <div className="h-52 min-h-52 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
            {grid}
            <XAxis dataKey="label" {...axis} />
            <YAxis {...axis} width={44} tickFormatter={(v: number) => compact.format(v)} />
            <Tooltip cursor={{ fill: "color-mix(in srgb, var(--ink) 6%, transparent)" }} content={(p) => <Tip active={p.active} payload={p.payload} label={p.label} currency={currency} series={flowSeries} />} />
            {flowSeries.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                fill={s.color}
                radius={[4, 4, 0, 0]}
                maxBarSize={22}
                cursor="pointer"
                onClick={(_, i) => router.push(data[i].href, { scroll: false })}
              >
                {/* The open month stays full strength; the others step back. */}
                {data.map((d) => (
                  <Cell key={d.key} fillOpacity={d.key === active ? 1 : 0.55} />
                ))}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <TableTwin
        caption="Money in and out per month"
        head={["Month", "In", "Out"]}
        rows={data.map((d) => [d.label, formatMoney(d.moneyIn, currency), formatMoney(d.moneyOut, currency)])}
      />
    </div>
  );
}

export type PacePoint = { day: number; now: number | null; before: number | null };

export function PaceChart({ data, currency, labels }: { data: PacePoint[]; currency: string; labels: { now: string; before: string } }) {
  const series: Series[] = [
    { key: "now", label: labels.now, color: "var(--chart-out)" },
    { key: "before", label: labels.before, color: "var(--ash)" },
  ];
  return (
    <div className="flex flex-1 flex-col gap-3">
      <Legend series={series} line />
      <div className="h-52 min-h-52 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.map((d) => ({ ...d, label: `day ${d.day}` }))} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            {grid}
            <XAxis dataKey="day" {...axis} interval="preserveStartEnd" minTickGap={24} />
            <YAxis {...axis} width={44} tickFormatter={(v: number) => compact.format(v)} />
            <Tooltip cursor={{ stroke: "var(--ash)", strokeWidth: 1 }} content={(p) => <Tip active={p.active} payload={p.payload} label={p.label} currency={currency} series={series} />} />
            <Line dataKey="before" stroke="var(--ash)" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
            <Line
              dataKey="now"
              stroke="var(--chart-out)"
              strokeWidth={2}
              strokeLinecap="round"
              dot={false}
              activeDot={{ r: 4, stroke: "var(--night-2)", strokeWidth: 2 }}
              animationDuration={900}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <TableTwin
        caption="Spending so far, by day of the month"
        head={["Day", labels.now, labels.before]}
        rows={data.map((d) => [d.day, d.now == null ? "" : formatMoney(d.now, currency), d.before == null ? "" : formatMoney(d.before, currency)])}
      />
    </div>
  );
}

export type BalancePoint = { date: string; label: string; balance: number };

export function BalanceChart({ data, currency }: { data: BalancePoint[]; currency: string }) {
  const series: Series[] = [{ key: "balance", label: "balance", color: "var(--chart-in)" }];
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="bal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-in)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--chart-in)" stopOpacity={0} />
            </linearGradient>
          </defs>
          {grid}
          <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={40} />
          <YAxis {...axis} width={48} tickFormatter={(v: number) => compact.format(v)} domain={["auto", "auto"]} />
          <Tooltip cursor={{ stroke: "var(--ash)", strokeWidth: 1 }} content={(p) => <Tip active={p.active} payload={p.payload} label={p.label} currency={currency} series={series} />} />
          <Area dataKey="balance" stroke="var(--chart-in)" strokeWidth={2} fill="url(#bal)" activeDot={{ r: 4, stroke: "var(--night-2)", strokeWidth: 2 }} animationDuration={900} />
        </AreaChart>
      </ResponsiveContainer>
      <TableTwin caption="Balance over time" head={["Date", "Balance"]} rows={data.map((d) => [d.label, formatMoney(d.balance, currency)])} />
    </div>
  );
}

export type HistoryPoint = { key: string; label: string; spent: number };

export function BudgetHistory({ data, limit, currency }: { data: HistoryPoint[]; limit: number; currency: string }) {
  const series: Series[] = [{ key: "spent", label: "spent", color: "var(--chart-in)" }];
  return (
    <div className="flex flex-col gap-2">
      <p className="label flex gap-4">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-[3px] bg-chart-in" /> spent
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-px w-3.5 bg-ink-soft" /> limit
        </span>
      </p>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 12, right: 0, left: 0, bottom: 0 }}>
            {grid}
            <XAxis dataKey="label" {...axis} />
            <YAxis {...axis} width={44} tickFormatter={(v: number) => compact.format(v)} domain={[0, (max: number) => Math.max(max, limit) * 1.1]} />
            <Tooltip cursor={{ fill: "color-mix(in srgb, var(--ink) 6%, transparent)" }} content={(p) => <Tip active={p.active} payload={p.payload} label={p.label} currency={currency} series={series} />} />
            <ReferenceLine y={limit} stroke="var(--ink-soft)" strokeWidth={1} />
            <Bar dataKey="spent" fill="var(--chart-in)" radius={[4, 4, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <TableTwin caption="Spent per month" head={["Month", "Spent"]} rows={data.map((d) => [d.label, formatMoney(d.spent, currency)])} />
    </div>
  );
}

export type MiniPoint = { key: string; label: string; value: number };

// Small columns for a tile: month labels under each bar, the value on hover, the open month at full strength.
export function MiniColumns({
  data,
  active,
  color,
  name,
  currency,
  limit,
  height = 72,
}: {
  data: MiniPoint[];
  active: string;
  color: string;
  name: string;
  currency: string;
  limit?: number;
  height?: number;
}) {
  const series: Series[] = [{ key: "value", label: name, color }];
  const top = Math.max(limit ?? 0, ...data.map((d) => d.value), 1);
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }} barCategoryGap="22%">
          <XAxis dataKey="label" {...axis} tick={{ ...tick, fontSize: 10 }} interval={0} height={16} />
          <YAxis hide domain={[0, top * 1.05]} />
          <Tooltip
            cursor={{ fill: "color-mix(in srgb, var(--ink) 6%, transparent)" }}
            wrapperStyle={{ zIndex: 20 }}
            content={(p) => <Tip active={p.active} payload={p.payload} label={p.label} currency={currency} series={series} />}
          />
          {limit != null && <ReferenceLine y={limit} stroke="var(--ink-soft)" strokeWidth={1} />}
          <Bar dataKey="value" fill={color} radius={[3, 3, 0, 0]} maxBarSize={16} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.key} fillOpacity={d.key === active ? 1 : 0.5} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <TableTwin caption={name} head={["Month", name]} rows={data.map((d) => [d.label, formatMoney(d.value, currency)])} />
    </div>
  );
}

// A small area line for a tile, with the date and amount on hover and the two ends labelled.
export function MiniTrend({
  data,
  name,
  currency,
  height = 64,
  color = "var(--chart-in)",
}: {
  data: MiniPoint[];
  name: string;
  currency: string;
  height?: number;
  color?: string;
}) {
  if (data.length < 2) return null;
  const series: Series[] = [{ key: "value", label: name, color }];
  const gid = `mt-${name.replace(/\W/g, "")}`;
  return (
    <div className="w-full">
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.22} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <YAxis hide domain={["dataMin", "dataMax"]} />
            <XAxis dataKey="label" hide />
            <Tooltip
              cursor={{ stroke: "var(--ash)", strokeWidth: 1 }}
              wrapperStyle={{ zIndex: 20 }}
              content={(p) => <Tip active={p.active} payload={p.payload} label={p.label} currency={currency} series={series} />}
            />
            <Area
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill={`url(#${gid})`}
              activeDot={{ r: 4, stroke: "var(--night-2)", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="label mt-1 flex justify-between text-[.7rem]">
        <span>{data[0].label}</span>
        <span>{data.at(-1)!.label}</span>
      </p>
      <TableTwin caption={name} head={["Date", name]} rows={data.map((d) => [d.label, formatMoney(d.value, currency)])} />
    </div>
  );
}
