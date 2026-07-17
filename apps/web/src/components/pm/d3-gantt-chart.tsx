"use client";

import { useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";

export type GanttTask = {
  id: string;
  title: string;
  status: string;
  startDate?: string;
  dueDate?: string;
};

type Props = {
  tasks: GanttTask[];
  rangeStart: Date;
  rangeDays: number;
  onReschedule: (taskId: string, startDate: string, dueDate: string) => void;
};

const STATUS_COLOR: Record<string, string> = {
  TODO: "#94a3b8",
  IN_PROGRESS: "#2563eb",
  BLOCKED: "#ef4444",
  DONE: "#10b981",
};

function parseDate(d: string | undefined): Date | null {
  if (!d) return null;
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function D3GanttChart({ tasks, rangeStart, rangeDays, onReschedule }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const rowHeight = 36;
  const labelWidth = 200;
  const dayWidth = 28;
  const chartWidth = rangeDays * dayWidth;
  const height = Math.max(120, tasks.length * rowHeight + 40);

  const dateToX = useCallback(
    (d: Date) => {
      const diff = Math.floor((d.getTime() - rangeStart.getTime()) / 86400000);
      return Math.max(0, Math.min(rangeDays - 1, diff)) * dayWidth;
    },
    [rangeStart, rangeDays, dayWidth],
  );

  const xToDate = useCallback(
    (x: number) => {
      const dayIndex = Math.round(x / dayWidth);
      const d = new Date(rangeStart);
      d.setDate(d.getDate() + dayIndex);
      return d.toISOString().slice(0, 10);
    },
    [rangeStart, dayWidth],
  );

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg.append("g").attr("transform", `translate(${labelWidth}, 24)`);

    // Day grid
    for (let i = 0; i < rangeDays; i++) {
      const x = i * dayWidth;
      g.append("line")
        .attr("x1", x)
        .attr("x2", x)
        .attr("y1", 0)
        .attr("y2", tasks.length * rowHeight)
        .attr("stroke", "#e2e8f0")
        .attr("stroke-width", 1);
      const d = new Date(rangeStart);
      d.setDate(d.getDate() + i);
      svg
        .append("text")
        .attr("x", labelWidth + x + dayWidth / 2)
        .attr("y", 14)
        .attr("text-anchor", "middle")
        .attr("font-size", 9)
        .attr("fill", "#64748b")
        .text(d.toLocaleDateString(undefined, { month: "short", day: "numeric" }));
    }

    tasks.forEach((task, i) => {
      const y = i * rowHeight + 8;
      const start = parseDate(task.startDate) ?? rangeStart;
      const end = parseDate(task.dueDate) ?? start;
      const x0 = dateToX(start);
      const x1 = dateToX(end);
      const barW = Math.max(dayWidth, x1 - x0 + dayWidth);

      svg
        .append("text")
        .attr("x", 8)
        .attr("y", 24 + y + 12)
        .attr("font-size", 11)
        .attr("fill", "#0f172a")
        .text(task.title.length > 24 ? `${task.title.slice(0, 24)}…` : task.title);

      const bar = g
        .append("rect")
        .attr("x", x0)
        .attr("y", y)
        .attr("width", barW)
        .attr("height", 20)
        .attr("rx", 4)
        .attr("fill", STATUS_COLOR[task.status] || STATUS_COLOR.TODO)
        .attr("opacity", 0.9)
        .style("cursor", "grab");

      const drag = d3
        .drag<SVGRectElement, unknown>()
        .on("drag", function (event) {
          const nx = Math.max(
            0,
            Math.min(chartWidth - barW, (parseFloat(d3.select(this).attr("x")) || x0) + event.dx),
          );
          d3.select(this).attr("x", nx);
        })
        .on("end", function () {
          const nx = parseFloat(d3.select(this).attr("x"));
          const newStart = xToDate(nx);
          const duration = Math.max(0, Math.round((barW - dayWidth) / dayWidth));
          const endD = new Date(newStart);
          endD.setDate(endD.getDate() + duration);
          onReschedule(task.id, newStart, endD.toISOString().slice(0, 10));
        });

      bar.call(drag as never);
    });
  }, [tasks, rangeStart, rangeDays, dateToX, xToDate, onReschedule, chartWidth, dayWidth]);

  return (
    <svg
      ref={svgRef}
      width={labelWidth + chartWidth}
      height={height}
      className="block min-w-full"
    />
  );
}
