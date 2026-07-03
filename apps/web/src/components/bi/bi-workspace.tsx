"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  biApi,
  subscribeBiMetricsStream,
  type BiDataSource,
  type WidgetType,
} from "@/lib/api/bi-api";
import {
  computeTotalArOutstanding,
  type BiDashboard,
  type BiDrillDownResult,
  type BiKpis,
  type BiScheduledReport,
  type BiWidgetData,
} from "@/lib/types/bi";
import { BiWidgetChart } from "@/components/bi/widget-chart";
import { PowerBiVisual, PowerBiKpiCard } from "@/components/bi/power-bi-visual";
import { CardKpi } from "@/components/bi/advanced-charts";
import { VisualizationPane } from "@/components/bi/visualization-pane";
import { SlicerBar, slicersToFilterParams, type SlicerState } from "@/components/bi/slicer-bar";
import { DrillThroughPane } from "@/components/bi/drill-through-pane";
import { BiToolbar, PageTabs, ReportsDrawer } from "@/components/bi/power-bi-ribbon";
import { GridLayoutWrapper, generateLayout, type GridLayoutConfig } from "@/components/bi/grid-layout-wrapper";
import { PBI } from "@/components/bi/power-bi-theme";
import { Modal, inputClasses } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { DATA_SOURCE_OPTIONS } from "@/components/bi/widget-chart";
import { DEFAULT_STYLE, type WidgetFilter, type WidgetQueryAttrs, type WidgetStyleConfig } from "@/components/bi/widget-config-schema";
import type { ReportRunStatus } from "@/lib/types/bi";

const EXECUTIVE_PAGE_ID = "__executive__";
const LAYOUT_SAVE_DEBOUNCE_MS = 400;

export function BiWorkspace() {
  const [editMode, setEditMode] = useState(false);
  const [live, setLive] = useState(true);
  const [activePageId, setActivePageId] = useState(EXECUTIVE_PAGE_ID);
  const [kpis, setKpis] = useState<BiKpis | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dashboards, setDashboards] = useState<BiDashboard[]>([]);
  const [widgetDataMap, setWidgetDataMap] = useState<Record<string, BiWidgetData>>({});
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [crossFilterKey, setCrossFilterKey] = useState<string | null>(null);
  const [drillDown, setDrillDown] = useState<BiDrillDownResult | null>(null);
  const [drillTitle, setDrillTitle] = useState("");
  const [slicers, setSlicers] = useState<SlicerState>({ period: "all", status: "all", department: "all" });
  const [reports, setReports] = useState<BiScheduledReport[]>([]);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [dashModalOpen, setDashModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [newDashName, setNewDashName] = useState("");
  const [widgetTitle, setWidgetTitle] = useState("");
  const [widgetType, setWidgetType] = useState<WidgetType>("bar");
  const [widgetSource, setWidgetSource] = useState<BiDataSource>("ar_aging");
  const [widgetQueryAttrs, setWidgetQueryAttrs] = useState<WidgetQueryAttrs>({});
  const [widgetFilters, setWidgetFilters] = useState<WidgetFilter[]>([]);
  const [widgetStyle, setWidgetStyle] = useState<WidgetStyleConfig>(DEFAULT_STYLE.bar);
  const [reportName, setReportName] = useState("");
  const [reportCron, setReportCron] = useState("weekly");
  const [reportFormat, setReportFormat] = useState<"PDF" | "EXCEL">("PDF");
  const [reportRecipients, setReportRecipients] = useState("");
  const [reportRunStatus, setReportRunStatus] = useState<Record<string, ReportRunStatus>>({});
  const layoutSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filterParams = useMemo(() => slicersToFilterParams(slicers), [slicers]);

  const activeDashboard = dashboards.find((d) => d.id === activePageId) || null;
  const isExecutive = activePageId === EXECUTIVE_PAGE_ID;

  const pages = useMemo(
    () => [
      { id: EXECUTIVE_PAGE_ID, name: "Executive overview", deletable: false },
      ...dashboards.map((d) => ({ id: d.id, name: d.name, deletable: true })),
    ],
    [dashboards],
  );

  const currentLayout = useMemo(() => {
    if (!activeDashboard) return { lg: [], md: [], sm: [] };
    const layout = activeDashboard.layout as GridLayoutConfig | undefined;
    const widgetIds = activeDashboard.widgets.map((w) => w.id);
    return generateLayout(widgetIds, layout);
  }, [activeDashboard]);

  const loadKpis = useCallback(() => {
    biApi
      .getKpis(filterParams)
      .then((data) => {
        setKpis(data);
        setLoadError(null);
      })
      .catch((err) => {
        console.error(err);
        setLoadError("Could not load KPI data. Check API connection and try Refresh.");
      });
  }, [filterParams]);

  const loadDashboards = useCallback(() => {
    biApi
      .getDashboards()
      .then(setDashboards)
      .catch((err) => console.error("Failed to load dashboards:", err));
  }, []);

  const loadReports = useCallback(() => {
    biApi.getReports().then(setReports).catch(console.error);
  }, []);

  useEffect(() => {
    loadKpis();
    loadDashboards();
    loadReports();
  }, [loadKpis, loadDashboards, loadReports]);

  useEffect(() => {
    if (!live) return;
    let unsub: (() => void) | undefined;
    subscribeBiMetricsStream(
      (data) => setKpis(data as BiKpis),
      (err) => console.warn("SSE metrics stream:", err.message),
      filterParams,
    ).then((fn) => {
      unsub = fn;
    });
    return () => unsub?.();
  }, [live, filterParams]);

  useEffect(() => {
    if (!selectedWidgetId || !activeDashboard) return;
    const widget = activeDashboard.widgets.find((w) => w.id === selectedWidgetId);
    if (!widget) return;
    loadWidgetDraft(widget);
  }, [selectedWidgetId, activeDashboard]);

  function resetWidgetDraft(type: WidgetType = "bar") {
    setWidgetTitle("");
    setWidgetType(type);
    setWidgetSource("ar_aging");
    setWidgetQueryAttrs({});
    setWidgetFilters([]);
    setWidgetStyle(DEFAULT_STYLE[type] || {});
  }

  function buildWidgetConfig(): Record<string, unknown> {
    return {
      title: widgetTitle || widgetSource,
      dataSource: widgetSource,
      queryAttrs: widgetQueryAttrs,
      filters: widgetFilters.filter((f) => f.field && f.value),
      style: widgetStyle,
      ...(widgetStyle.format ? { format: widgetStyle.format } : {}),
      ...(widgetStyle.max !== undefined ? { max: widgetStyle.max } : {}),
      ...(widgetStyle.trend ? { trend: widgetStyle.trend } : {}),
    };
  }

  function loadWidgetDraft(widget: BiDashboard["widgets"][number]) {
    const type = widget.type as WidgetType;
    setWidgetTitle(widget.config?.title || "");
    setWidgetType(widget.type as WidgetType);
    setWidgetSource((widget.config?.dataSource || "ar_aging") as BiDataSource);
    setWidgetQueryAttrs(widget.config?.queryAttrs || {});
    setWidgetFilters(widget.config?.filters || []);
    setWidgetStyle({
      ...(DEFAULT_STYLE[type] || {}),
      ...(widget.config?.style || {}),
    });
  }

  useEffect(() => {
    if (!activeDashboard?.widgets.length) return;
    let cancelled = false;
    (async () => {
      for (const w of activeDashboard.widgets) {
        try {
          const data = await biApi.getWidgetData(w.id, filterParams);
          if (!cancelled) {
            setWidgetDataMap((prev) => ({ ...prev, [w.id]: data }));
          }
        } catch {
          /* widget data optional */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeDashboard, filterParams]);

  async function handleCrossFilter(source: BiDataSource, key: string, name: string) {
    setCrossFilterKey(key);
    try {
      const result = await biApi.drillDown(source, key, name);
      setDrillDown(result);
      setDrillTitle(name);
    } catch {
      /* drill optional */
    }
  }

  async function createDashboard() {
    if (!newDashName.trim()) return;
    const created = await biApi.createDashboard(newDashName.trim());
    setNewDashName("");
    setDashModalOpen(false);
    await loadDashboards();
    setActivePageId(created.id);
    setEditMode(true);
  }

  async function deletePage(id: string) {
    const page = dashboards.find((d) => d.id === id);
    if (!page) return;
    if (
      !confirm(
        `Delete report page "${page.name}"? All visuals on this page will be removed.`,
      )
    ) {
      return;
    }
    await biApi.deleteDashboard(id);
    setDashboards((prev) => prev.filter((d) => d.id !== id));
    if (activePageId === id) {
      setActivePageId(EXECUTIVE_PAGE_ID);
      setSelectedWidgetId(null);
      resetWidgetDraft();
      setDrillDown(null);
      setCrossFilterKey(null);
    }
  }

  async function addWidget() {
    if (!activeDashboard) return;
    await biApi.addWidget(activeDashboard.id, widgetType, buildWidgetConfig());
    resetWidgetDraft(widgetType);
    const updated = await biApi.getDashboard(activeDashboard.id);
    setDashboards((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
  }

  async function updateSelectedWidget() {
    if (!selectedWidgetId || !activeDashboard) return;
    await biApi.updateWidget(selectedWidgetId, {
      type: widgetType,
      config: buildWidgetConfig(),
    });
    const updated = await biApi.getDashboard(activeDashboard.id);
    setDashboards((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    const data = await biApi.getWidgetData(selectedWidgetId, filterParams);
    setWidgetDataMap((prev) => ({ ...prev, [selectedWidgetId]: data }));
    setSelectedWidgetId(null);
    resetWidgetDraft();
  }

  function cancelWidgetEdit() {
    setSelectedWidgetId(null);
    resetWidgetDraft();
  }

  function handleTypeChange(type: WidgetType) {
    setWidgetType(type);
    setWidgetQueryAttrs({});
    setWidgetStyle(DEFAULT_STYLE[type] || {});
  }

  function handleSourceChange(source: BiDataSource) {
    setWidgetSource(source);
    const match = DATA_SOURCE_OPTIONS.find((o) => o.value === source);
    if (match) handleTypeChange(match.defaultType);
  }

  function handleQueryAttrChange(key: string, val: string) {
    setWidgetQueryAttrs((a) => ({ ...a, [key]: val }));
  }

  function handleStyleChange(key: string, val: string | number | boolean) {
    setWidgetStyle((s) => ({ ...s, [key]: val }));
  }

  async function deleteWidget(id: string) {
    if (!confirm("Remove this visual from the report page?")) return;
    await biApi.deleteWidget(id);
    if (activeDashboard) {
      const updated = await biApi.getDashboard(activeDashboard.id);
      setDashboards((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    }
  }

  const handleLayoutChange = useCallback(
    (layout: GridLayoutConfig) => {
      if (!activeDashboard || !editMode) return;

      setDashboards((prev) =>
        prev.map((d) => (d.id === activeDashboard.id ? { ...d, layout } : d)),
      );

      if (layoutSaveTimer.current) clearTimeout(layoutSaveTimer.current);
      layoutSaveTimer.current = setTimeout(async () => {
        try {
          await biApi.updateDashboard(activeDashboard.id, { layout });
        } catch (error) {
          console.error("Failed to save layout:", error);
        }
      }, LAYOUT_SAVE_DEBOUNCE_MS);
    },
    [activeDashboard, editMode],
  );

  useEffect(() => {
    return () => {
      if (layoutSaveTimer.current) clearTimeout(layoutSaveTimer.current);
    };
  }, []);

  async function createReport() {
    const recipients = reportRecipients.split(",").map((e) => e.trim()).filter(Boolean);
    if (!reportName.trim() || !recipients.length) return;
    await biApi.createReport({
      name: reportName.trim(),
      cronExpr: reportCron,
      format: reportFormat,
      recipients,
      dashboardId: activeDashboard?.id,
    });
    setReportModalOpen(false);
    setReportName("");
    setReportRecipients("");
    loadReports();
  }

  const agingData = kpis
    ? [
      { name: "Current", value: kpis.arAging.current, key: "Current" },
      { name: "31–60", value: kpis.arAging.d31_60, key: "31-60" },
      { name: "61–90", value: kpis.arAging.d61_90, key: "61-90" },
      { name: "90+", value: kpis.arAging.over90, key: "90+" },
    ]
    : [];

  const totalArOutstanding = kpis ? computeTotalArOutstanding(kpis.arAging) : 0;
  const collectionHealthPct =
    totalArOutstanding > 0 ? (kpis!.arAging.current / totalArOutstanding) * 100 : 0;

  const inventoryData =
    kpis?.inventorySnapshot?.slice(0, 8).map((s: any) => ({
      name: s.sku,
      value: s.quantity,
      key: s.sku,
    })) || [];

  return (
    <div
      className="-m-8 flex flex-col min-h-[calc(100vh-36px)] relative overflow-hidden"
      style={{ fontFamily: "'Segoe UI', 'IBM Plex Sans', sans-serif" }}
    >
      <BiToolbar
        editMode={editMode}
        live={live}
        onSetEditMode={setEditMode}
        onToggleLive={() => setLive((v) => !v)}
        onRefresh={loadKpis}
      />
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 flex flex-col min-w-0">
          <SlicerBar
            slicers={slicers}
            onChange={setSlicers}
            departmentOptions={kpis?.departments}
          />

          {loadError && (
            <div
              className="mx-4 mt-3 px-3 py-2 rounded text-[13px]"
              style={{ background: "#FDE7E9", color: "#A4262C", border: "1px solid #F1BBBC" }}
            >
              {loadError}
            </div>
          )}

          <div
            className="flex-1 overflow-auto p-4"
            style={{
              background: PBI.canvas,
              backgroundImage: editMode
                ? `radial-gradient(${PBI.canvasGrid} 1px, transparent 1px)`
                : undefined,
              backgroundSize: editMode ? "16px 16px" : undefined,
            }}
          >
            {!kpis && isExecutive && (
              <p className="text-[13px]" style={{ color: PBI.textMuted }}>
                Loading report data…
              </p>
            )}

            {isExecutive && kpis && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                  <PowerBiVisual title="AR outstanding" span="sm">
                    <CardKpi
                      title="Total AR outstanding"
                      value={totalArOutstanding}
                      format="currency"
                    />
                  </PowerBiVisual>
                  <PowerBiVisual title="Active employees" span="sm">
                    <PowerBiKpiCard
                      label="Headcount"
                      value={kpis.totals.activeEmployees}
                      trend="Live from HR module"
                    />
                  </PowerBiVisual>
                  <PowerBiVisual title="Open purchase orders" span="sm">
                    <PowerBiKpiCard label="Open POs" value={kpis.totals.openPurchaseOrders} />
                  </PowerBiVisual>
                  <PowerBiVisual title="Active projects" span="sm">
                    <PowerBiKpiCard label="Projects" value={kpis.totals.activeProjects} />
                  </PowerBiVisual>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 auto-rows-[minmax(320px,auto)]">
                  <PowerBiVisual
                    title="AR aging by bucket"
                    subtitle="Click segment to cross-filter"
                    span="lg"
                  >
                    <BiWidgetChart
                      type="pie"
                      series={agingData}
                      activeKey={crossFilterKey}
                      onSegmentClick={(key, name) => handleCrossFilter("ar_aging", key, name)}
                    />
                  </PowerBiVisual>

                  <PowerBiVisual title="Inventory by SKU" subtitle="Top 8 by quantity" span="lg">
                    <BiWidgetChart
                      type="bar"
                      series={inventoryData}
                      activeKey={crossFilterKey}
                      onSegmentClick={(key, name) => handleCrossFilter("inventory", key, name)}
                    />
                  </PowerBiVisual>

                  <PowerBiVisual title="Collection health" subtitle="Current bucket vs total AR" span="md">
                    <BiWidgetChart
                      type="gauge"
                      series={[{ name: "Collection health", value: Math.round(collectionHealthPct), key: "health" }]}
                      config={{ max: 100, format: "percent", title: "Current AR %" }}
                    />
                  </PowerBiVisual>

                  <PowerBiVisual title="Open invoices" subtitle="AR invoice count" span="md">
                    <CardKpi
                      title="Open AR invoices"
                      value={kpis.totals.openArInvoices ?? kpis.totals.invoices}
                      format="number"
                    />
                  </PowerBiVisual>
                </div>
              </div>
            )}

            {!isExecutive && activeDashboard && (
              <GridLayoutWrapper
                layout={currentLayout}
                editMode={editMode}
                onLayoutChange={handleLayoutChange}
              >
                {activeDashboard.widgets.map((w) => {
                  const data = widgetDataMap[w.id];
                  const source = (w.config?.dataSource || "ar_aging") as BiDataSource;
                  return (
                    <div key={w.id}>
                      <PowerBiVisual
                        widgetId={w.id}
                        title={w.config?.title || w.type}
                        subtitle={source.replace(/_/g, " ")}
                        editMode={editMode}
                        selected={selectedWidgetId === w.id}
                        onSelect={() => setSelectedWidgetId(w.id)}
                        onDelete={editMode ? () => deleteWidget(w.id) : undefined}
                      >
                        <BiWidgetChart
                          type={w.type as WidgetType}
                          series={data?.series}
                          heatmap={data?.heatmap}
                          activeKey={crossFilterKey}
                          onSegmentClick={(key, name) => handleCrossFilter(source, key, name)}
                          config={w.config}
                        />
                      </PowerBiVisual>
                    </div>
                  );
                })}
              </GridLayoutWrapper>
            )}

            {!isExecutive && activeDashboard && activeDashboard.widgets.length === 0 && (
              <div
                className="flex flex-col items-center justify-center py-16 rounded border-2 border-dashed"
                style={{ borderColor: PBI.canvasGrid, color: PBI.textMuted }}
              >
                <p className="text-[14px] font-medium">This page is empty</p>
                <p className="text-[12px] mt-1">Switch to Edit mode and use the Visualizations pane to add charts.</p>
              </div>
            )}

            {!isExecutive && !activeDashboard && (
              <p className="text-[13px]" style={{ color: PBI.textMuted }}>
                Select a report page or create a new one.
              </p>
            )}
          </div>

          <DrillThroughPane
            title={drillTitle}
            data={drillDown}
            onClose={() => {
              setDrillDown(null);
              setCrossFilterKey(null);
            }}
          />

          <PageTabs
            pages={pages}
            activeId={activePageId}
            onSelect={(id) => {
              setActivePageId(id);
              setDrillDown(null);
              setCrossFilterKey(null);
            }}
            onAdd={() => setDashModalOpen(true)}
            onDelete={deletePage}
          />
        </div>

        {editMode && !isExecutive && activeDashboard && (
          <VisualizationPane
            selectedType={widgetType}
            selectedSource={widgetSource}
            widgetTitle={widgetTitle}
            queryAttrs={widgetQueryAttrs}
            filters={widgetFilters}
            style={widgetStyle}
            editingWidgetId={selectedWidgetId}
            onTypeChange={handleTypeChange}
            onSourceChange={handleSourceChange}
            onTitleChange={setWidgetTitle}
            onQueryAttrChange={handleQueryAttrChange}
            onFilterChange={setWidgetFilters}
            onStyleChange={handleStyleChange}
            onAddVisual={addWidget}
            onUpdateVisual={updateSelectedWidget}
            onCancelEdit={cancelWidgetEdit}
            canAdd={!!activeDashboard}
          />
        )}

        {editMode && isExecutive && (
          <aside
            className="w-[260px] shrink-0 p-4 text-[12px]"
            style={{ background: PBI.paneBg, borderLeft: `1px solid ${PBI.paneBorder}`, color: PBI.textMuted }}
          >
            <p className="font-semibold mb-2" style={{ color: PBI.text }}>
              Executive overview
            </p>
            <p>This page is read-only. Create a <strong>new page</strong> to build custom visuals in Edit mode.</p>
          </aside>
        )}
      </div>

      <ReportsDrawer
        open={reportsOpen}
        reports={reports}
        runStatus={reportRunStatus}
        onClose={() => setReportsOpen(false)}
        onCreate={() => {
          setReportsOpen(false);
          setReportModalOpen(true);
        }}
        onRun={async (id) => {
          setReportRunStatus((prev) => ({ ...prev, [id]: "running" }));
          try {
            await biApi.runReport(id);
            setReportRunStatus((prev) => ({ ...prev, [id]: "done" }));
            loadReports();
          } catch {
            setReportRunStatus((prev) => ({ ...prev, [id]: "failed" }));
          }
        }}
        onDownload={async (id, name, format) => {
          const blob = await biApi.downloadReport(id);
          const ext = format === "EXCEL" ? "csv" : "pdf";
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${name}.${ext}`;
          a.click();
          URL.revokeObjectURL(url);
        }}
        onDelete={async (id) => {
          await biApi.deleteReport(id);
          loadReports();
        }}
      />

      <Modal open={dashModalOpen} onClose={() => setDashModalOpen(false)} title="New report page">
        <p className="text-[13px] mb-3" style={{ color: PBI.textMuted }}>
          Like Power BI, each page is a canvas for visuals.
        </p>
        <input
          className={inputClasses}
          placeholder="Page name"
          value={newDashName}
          onChange={(e) => setNewDashName(e.target.value)}
        />
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => setDashModalOpen(false)}>Cancel</Button>
          <Button onClick={createDashboard}>Create page</Button>
        </div>
      </Modal>

      <Modal open={reportModalOpen} onClose={() => setReportModalOpen(false)} title="New subscription">
        <div className="space-y-3">
          <input className={inputClasses} placeholder="Subscription name" value={reportName} onChange={(e) => setReportName(e.target.value)} />
          <select className={inputClasses} value={reportCron} onChange={(e) => setReportCron(e.target.value)}>
            <option value="daily">Daily at 8 AM</option>
            <option value="weekly">Weekly (Monday 8 AM)</option>
            <option value="monthly">Monthly (1st, 8 AM)</option>
          </select>
          <select className={inputClasses} value={reportFormat} onChange={(e) => setReportFormat(e.target.value as "PDF" | "EXCEL")}>
            <option value="PDF">PDF</option>
            <option value="EXCEL">Excel (CSV)</option>
          </select>
          <input className={inputClasses} placeholder="Email recipients (comma-separated)" value={reportRecipients} onChange={(e) => setReportRecipients(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => setReportModalOpen(false)}>Cancel</Button>
          <Button onClick={createReport}>Create subscription</Button>
        </div>
      </Modal>
    </div>
  );
}
