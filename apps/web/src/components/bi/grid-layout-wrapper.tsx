"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { Layout, ResponsiveLayouts } from "react-grid-layout";

/** v2 moved WidthProvider + legacy Responsive to the /legacy entrypoint */
const ResponsiveGridLayout = dynamic(
  async () => {
    const { Responsive, WidthProvider } = await import("react-grid-layout/legacy");
    return WidthProvider(Responsive);
  },
  { ssr: false },
);

export type GridLayoutItem = Layout;

export type GridLayoutConfig = {
  lg?: GridLayoutItem[];
  md?: GridLayoutItem[];
  sm?: GridLayoutItem[];
};

type GridLayoutWrapperProps = {
  layout: GridLayoutConfig;
  editMode: boolean;
  onLayoutChange: (layout: GridLayoutConfig) => void;
  children: React.ReactNode;
};

export function GridLayoutWrapper({
  layout,
  editMode,
  onLayoutChange,
  children,
}: GridLayoutWrapperProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const layouts: ResponsiveLayouts = useMemo(
    () => ({
      lg: layout.lg || [],
      md: layout.md?.length ? layout.md : layout.lg || [],
      sm: layout.sm?.length ? layout.sm : layout.lg || [],
    }),
    [layout],
  );

  const handleLayoutChange = useCallback(
    (_current: Layout[], allLayouts: ResponsiveLayouts) => {
      onLayoutChange({
        lg: allLayouts.lg || [],
        md: allLayouts.md || [],
        sm: allLayouts.sm || [],
      });
    },
    [onLayoutChange],
  );

  if (!mounted) {
    return <div className="min-h-[600px] animate-pulse bg-[#EDEBE9]/30 rounded" />;
  }

  return (
    <ResponsiveGridLayout
      className="layout"
      layouts={layouts}
      breakpoints={{ lg: 1200, md: 996, sm: 768 }}
      cols={{ lg: 12, md: 8, sm: 4 }}
      rowHeight={80}
      margin={[12, 12]}
      containerPadding={[0, 0]}
      compactType="vertical"
      isDraggable={editMode}
      isResizable={editMode}
      draggableHandle=".drag-handle"
      onLayoutChange={handleLayoutChange}
    >
      {children}
    </ResponsiveGridLayout>
  );
}

export function generateLayout(
  widgetIds: string[],
  existingLayout?: GridLayoutConfig,
): GridLayoutConfig {
  const lg: GridLayoutItem[] = [];

  widgetIds.forEach((id, index) => {
    const existing = existingLayout?.lg?.find((item) => item.i === id);

    if (existing) {
      lg.push(existing);
    } else {
      const row = Math.floor(index / 2);
      const col = (index % 2) * 6;

      lg.push({
        i: id,
        x: col,
        y: row * 4,
        w: 6,
        h: 4,
        minW: 3,
        minH: 3,
      });
    }
  });

  return { lg, md: [], sm: [] };
}
