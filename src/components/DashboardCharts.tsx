import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

export type MonthlyPoint = { period: string; label: string; count: number };
export type DailyPoint = { date: string; count: number };
export type ProjectSeries = {
  id: number;
  name: string;
  color: string;
  values: number[];
};

const seriesPalette = [
  "#6c8f58",
  "#547da1",
  "#a76b51",
  "#80649a",
  "#b18b37",
  "#4d8c83",
];
function smoothPath(points: { x: number; y: number }[]) {
  if (!points.length) return "";
  return points.reduce((path, point, index) => {
    if (!index) return `M ${point.x} ${point.y}`;
    const previous = points[index - 1],
      midpoint = (point.x - previous.x) / 2;
    return `${path} C ${previous.x + midpoint} ${previous.y}, ${point.x - midpoint} ${point.y}, ${point.x} ${point.y}`;
  }, "");
}
function donutSlicePath(
  startAngle: number,
  endAngle: number,
  innerRadius: number,
  outerRadius: number,
) {
  const point = (radius: number, angle: number) => [
    100 + radius * Math.cos(angle),
    100 + radius * Math.sin(angle),
  ];
  const [outerStartX, outerStartY] = point(outerRadius, startAngle);
  const [outerEndX, outerEndY] = point(outerRadius, endAngle);
  const [innerEndX, innerEndY] = point(innerRadius, endAngle);
  const [innerStartX, innerStartY] = point(innerRadius, startAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${outerStartX} ${outerStartY} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEndX} ${outerEndY} L ${innerEndX} ${innerEndY} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStartX} ${innerStartY} Z`;
}
export function AreaChart({
  data,
  projects,
}: {
  data: MonthlyPoint[];
  projects: ProjectSeries[];
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const width = 900,
    height = 250,
    padX = 38,
    padTop = 18,
    padBottom = 42;
  const resolved = useMemo(
    () =>
      projects.map((project, index) => ({
        ...project,
        color: project.color || seriesPalette[index % seriesPalette.length],
      })),
    [projects],
  );
  const max = Math.max(...resolved.flatMap((project) => project.values), 1);
  const chartHeight = height - padTop - padBottom;
  const xAt = (index: number) =>
    padX + (index * (width - padX * 2)) / Math.max(data.length - 1, 1);
  const yAt = (count: number) =>
    padTop + chartHeight - (count / max) * chartHeight;
  const hoveredX = hovered === null ? 0 : xAt(hovered);
  return (
    <div className="relative w-full">
      <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2">
        {resolved.map((project) => (
          <div
            key={project.id}
            className="flex items-center gap-2 text-xs font-medium text-[#687067]"
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: project.color }}
            />
            {project.name}
          </div>
        ))}
      </div>
      <div className="overflow-x-auto">
        <div className="relative min-w-[700px]">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-auto w-full"
            role="img"
            aria-label="Tren laporan per project selama 12 bulan"
            onMouseLeave={() => setHovered(null)}
          >
            <defs>
              {resolved.map((project) => (
                <linearGradient
                  key={project.id}
                  id={`area-${project.id}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor={project.color}
                    stopOpacity=".16"
                  />
                  <stop
                    offset="100%"
                    stopColor={project.color}
                    stopOpacity=".015"
                  />
                </linearGradient>
              ))}
            </defs>
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = padTop + chartHeight * ratio;
              return (
                <g key={ratio}>
                  <line
                    x1={padX}
                    x2={width - padX}
                    y1={y}
                    y2={y}
                    stroke="#e8ebe4"
                    strokeDasharray="4 5"
                  />
                  <text
                    x={padX - 10}
                    y={y + 4}
                    textAnchor="end"
                    fontSize="10"
                    fill="#99a097"
                  >
                    {Math.round(max * (1 - ratio))}
                  </text>
                </g>
              );
            })}
            {resolved.map((project) => {
              const points = project.values.map((count, index) => ({
                x: xAt(index),
                y: yAt(count),
              }));
              const line = smoothPath(points);
              const baseline = height - padBottom;
              const area = `${line} L ${points.at(-1)?.x || padX} ${baseline} L ${padX} ${baseline} Z`;
              return (
                <motion.path
                  key={project.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.82 }}
                  transition={{ duration: 0.55 }}
                  d={area}
                  fill={`url(#area-${project.id})`}
                />
              );
            })}
            {resolved.map((project) => {
              const points = project.values.map((count, index) => ({
                x: xAt(index),
                y: yAt(count),
              }));
              const line = smoothPath(points);
              return (
                <motion.path
                  key={`line-${project.id}`}
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.9, ease: "easeOut" }}
                  d={line}
                  fill="none"
                  stroke={project.color}
                  strokeWidth="1.1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              );
            })}
            {hovered !== null && (
              <line
                x1={hoveredX}
                x2={hoveredX}
                y1={padTop}
                y2={height - padBottom}
                stroke="#858d83"
                strokeWidth="1"
                strokeDasharray="3 4"
              />
            )}
            {data.map((item, index) => (
              <g key={item.period}>
                <rect
                  x={xAt(index) - (width - padX * 2) / data.length / 2}
                  y={padTop}
                  width={(width - padX * 2) / data.length}
                  height={chartHeight}
                  fill="transparent"
                  onMouseEnter={() => setHovered(index)}
                />
                <text
                  x={xAt(index)}
                  y={height - 17}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="600"
                  fill="#848b82"
                >
                  {item.label}
                </text>
              </g>
            ))}
          </svg>
          {hovered !== null && (
            <div
              className="pointer-events-none absolute top-5 z-10 min-w-44 rounded-xl border border-[#dfe3da] bg-white/95 p-3 shadow-xl backdrop-blur"
              style={{
                left: `${(hoveredX / width) * 100}%`,
                transform: `translateX(${hovered > data.length - 4 ? "-100%" : hovered < 2 ? "0" : "-50%"})`,
              }}
            >
              <p className="mb-2 text-xs font-medium text-[#343a32]">
                {new Intl.DateTimeFormat("id-ID", {
                  month: "long",
                  year: "numeric",
                }).format(new Date(`${data[hovered].period}-01T00:00:00`))}
              </p>
              <div className="space-y-1.5">
                {resolved.map((project) => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between gap-5 text-[11px]"
                  >
                    <span className="flex items-center gap-2 text-[#70776e]">
                      <i
                        className="h-2 w-2 rounded-full"
                        style={{ background: project.color }}
                      />
                      {project.name}
                    </span>
                    <strong>{project.values[hovered] || 0}</strong>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex justify-between border-t border-[#eceee8] pt-2 text-[11px] font-medium">
                <span>Total</span>
                <span>
                  {resolved.reduce(
                    (sum, project) => sum + (project.values[hovered] || 0),
                    0,
                  )}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const levels = ["#eef0eb", "#d8ebcd", "#aad293", "#79ae60", "#47783a"];
export function ContributionChart({ data }: { data: DailyPoint[] }) {
  const [hovered, setHovered] = useState<DailyPoint | null>(null);
  const [scroll, setScroll] = useState({ left: 0, width: 0, content: 0 });
  const scrollRef = useRef<HTMLDivElement>(null);
  const startDay = data.length
    ? new Date(`${data[0].date}T00:00:00`).getDay()
    : 0;
  const cell = 15,
    gap = 4,
    step = cell + gap,
    weeks = Math.ceil((startDay + data.length) / 7);
  const max = Math.max(...data.map((item) => item.count), 1);
  const level = (count: number) =>
    count === 0 ? 0 : Math.min(4, Math.max(1, Math.ceil((count / max) * 4)));
  const monthLabels: { label: string; x: number }[] = [];
  data.forEach((item, index) => {
    const date = new Date(`${item.date}T00:00:00`);
    if (date.getDate() <= 7) {
      const x = Math.floor((startDay + index) / 7) * step;
      if (!monthLabels.some((label) => Math.abs(label.x - x) < 25))
        monthLabels.push({
          label: new Intl.DateTimeFormat("id-ID", { month: "short" }).format(
            date,
          ),
          x,
        });
    }
  });
  const svgWidth = weeks * step + 30;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const todayIndex = data.findIndex((item) => item.date === today);
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const update = () =>
      setScroll({
        left: container.scrollLeft,
        width: container.clientWidth,
        content: container.scrollWidth,
      });
    const todayX =
      todayIndex >= 0 ? 25 + Math.floor((startDay + todayIndex) / 7) * step : 0;
    container.scrollLeft = Math.max(
      0,
      Math.min(
        todayX - container.clientWidth / 2,
        container.scrollWidth - container.clientWidth,
      ),
    );
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, [data, startDay, step, todayIndex]);
  if (!data.length) return null;
  const thumbWidth = scroll.content
    ? Math.max(44, (scroll.width / scroll.content) * 100)
    : 100;
  const thumbLeft =
    scroll.content > scroll.width
      ? (scroll.left / (scroll.content - scroll.width)) * (100 - thumbWidth)
      : 0;
  return (
    <div className="group/heatmap relative">
      <div
        className={`pointer-events-none absolute right-3 top-1 z-10 rounded-xl border border-[#dfe3da] bg-white/95 px-3 py-2 shadow-lg backdrop-blur transition-all ${hovered ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"}`}
      >
        <p className="text-xs font-medium">
          {hovered
            ? new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(
                new Date(`${hovered.date}T00:00:00`),
              )
            : "—"}
        </p>
        <p className="mt-1 text-[10px] text-[#737a70]">
          {hovered?.count || 0} laporan ·{" "}
          {hovered?.count
            ? hovered.count >= max * 0.75
              ? "Aktivitas tinggi"
              : hovered.count >= max * 0.35
                ? "Aktivitas sedang"
                : "Aktivitas rendah"
            : "Tidak ada aktivitas"}
        </p>
      </div>
      <div
        ref={scrollRef}
        onScroll={(event) =>
          setScroll({
            left: event.currentTarget.scrollLeft,
            width: event.currentTarget.clientWidth,
            content: event.currentTarget.scrollWidth,
          })
        }
        className="chart-scroll overflow-x-auto"
      >
        <svg
          width={svgWidth}
          height="170"
          viewBox={`0 0 ${svgWidth} 170`}
          className="max-w-none"
          role="img"
          aria-label="Aktivitas laporan harian selama satu tahun"
          onMouseLeave={() => setHovered(null)}
        >
          {monthLabels.map((month) => (
            <text
              key={`${month.label}-${month.x}`}
              x={month.x}
              y="11"
              fontSize="9"
              fontWeight="600"
              fill="#858c83"
            >
              {month.label}
            </text>
          ))}
          {["Min", "Sel", "Kam", "Sab"].map((day, index) => (
            <text
              key={day}
              x="0"
              y={30 + index * step * 2 + 9}
              fontSize="8"
              fill="#9aa098"
            >
              {day}
            </text>
          ))}
          <g transform="translate(25, 20)">
            {data.map((item, index) => {
              const slot = startDay + index,
                x = Math.floor(slot / 7) * step,
                y = (slot % 7) * step,
                isToday = item.date === today;
              return (
                <motion.rect
                  key={item.date}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(index * 0.001, 0.3) }}
                  x={x}
                  y={y}
                  width={cell}
                  height={cell}
                  rx="2.5"
                  fill={levels[level(item.count)]}
                  stroke={
                    hovered?.date === item.date
                      ? "#354b2d"
                      : isToday
                        ? "#526b47"
                        : item.count
                          ? "#fff"
                          : "#e4e7e0"
                  }
                  strokeWidth={
                    hovered?.date === item.date ? "1.5" : isToday ? "2" : ".5"
                  }
                  onMouseEnter={() => setHovered(item)}
                />
              );
            })}
          </g>
        </svg>
      </div>
      {scroll.content > scroll.width && (
        <button
          type="button"
          aria-label="Navigasi horizontal konsistensi harian"
          className="heatmap-scroll-track relative mx-auto mt-2 block h-1.5 w-36 overflow-hidden rounded-full bg-[#eef1ec] opacity-0 transition-opacity duration-200 group-hover/heatmap:opacity-100 focus:opacity-100"
          onClick={(event) => {
            const container = scrollRef.current;
            if (!container) return;
            const rect = event.currentTarget.getBoundingClientRect();
            const ratio = (event.clientX - rect.left) / rect.width;
            container.scrollTo({
              left: ratio * container.scrollWidth - container.clientWidth / 2,
              behavior: "smooth",
            });
          }}
        >
          <span
            className="absolute inset-y-0 rounded-full bg-[#a9bda1] transition-[left,background-color] duration-150"
            style={{ left: `${thumbLeft}%`, width: `${thumbWidth}%` }}
          />
        </button>
      )}
    </div>
  );
}

export function ProjectDistributionChart({
  projects,
}: {
  projects: ProjectSeries[];
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const series = useMemo(
    () =>
      projects
        .map((project, index) => ({
          ...project,
          color: project.color || seriesPalette[index % seriesPalette.length],
          total: project.values.reduce((sum, value) => sum + value, 0),
        }))
        .filter((project) => project.total > 0)
        .sort((a, b) => b.total - a.total),
    [projects],
  );
  const total = series.reduce((sum, project) => sum + project.total, 0);
  const radius = 72,
    circumference = 2 * Math.PI * radius;
  let runningOffset = 0;
  const segments = series.map((project) => {
    const length = total ? (project.total / total) * circumference : 0;
    const segment = { ...project, length, offset: runningOffset };
    runningOffset += length;
    return segment;
  });
  const active =
    hovered === null
      ? null
      : segments.find((project) => project.id === hovered) || null;
  return (
    <div className="grid min-h-[260px] items-center gap-5 sm:grid-cols-[220px_1fr]">
      <div className="relative mx-auto h-[210px] w-[210px]">
        <svg
          viewBox="0 0 200 200"
          className="h-full w-full"
          role="img"
          aria-label="Distribusi laporan per project"
          onMouseLeave={() => setHovered(null)}
        >
          <circle cx="100" cy="100" r="78" fill="#eef0eb" />
          {segments.map((project) => {
            const startAngle =
              (project.offset / circumference) * Math.PI * 2 - Math.PI / 2;
            const endAngle =
              ((project.offset + project.length) / circumference) *
                Math.PI *
                2 -
              Math.PI / 2;
            return (
              <motion.path
                key={project.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.55 }}
                d={donutSlicePath(
                  startAngle,
                  endAngle,
                  48,
                  hovered === project.id ? 81 : 78,
                )}
                fill={project.color}
                stroke="#fff"
                strokeWidth="2"
                onMouseEnter={() => setHovered(project.id)}
                className="cursor-pointer transition-all"
              />
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div className="max-w-28">
            <p className="font-display text-2xl font-medium tracking-[-.04em] text-[#2e352c]">
              {active ? active.total : total}
            </p>
            <p className="mt-1 text-[10px] font-medium uppercase tracking-[.1em] text-[#858c83]">
              Laporan
            </p>
          </div>
        </div>
      </div>
      <div className="space-y-2.5">
        {segments.map((project, index) => (
          <button
            key={project.id}
            onMouseEnter={() => setHovered(project.id)}
            onMouseLeave={() => setHovered(null)}
            className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${hovered === project.id ? "border-[#d8ddd3] bg-white shadow-sm" : "border-transparent hover:bg-white"}`}
          >
            <span className="grid h-6 w-6 place-items-center rounded-lg bg-[#f0f2ed] text-[10px] font-medium text-[#7c8379]">
              {index + 1}
            </span>
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: project.color }}
            />
            <span className="min-w-0 flex-1 truncate text-xs font-medium">
              {project.name}
            </span>
            <span className="text-right">
              <strong className="block text-xs">{project.total}</strong>
              <small className="text-[9px] text-[#8b9188]">
                {Math.round((project.total / total) * 100)}%
              </small>
            </span>
          </button>
        ))}
        {!segments.length && (
          <p className="text-center text-xs text-[#858b82]">
            Belum ada data Project.
          </p>
        )}
      </div>
    </div>
  );
}

export function HeatLegend() {
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-[#8a9087]">
      <span>Lebih sedikit</span>
      {levels.map((color) => (
        <span
          key={color}
          className="h-3 w-3 rounded-[3px]"
          style={{ background: color }}
        />
      ))}
      <span>Lebih banyak</span>
    </div>
  );
}
