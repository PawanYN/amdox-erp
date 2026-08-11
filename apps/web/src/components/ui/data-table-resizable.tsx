"use client";

import React, { ReactNode, useState, useEffect, useRef } from "react";
import { Table, THead, TH, TBody, TR, TD, EmptyState } from "./table";
import { Card } from "./card";

export interface ColumnDef<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (row: T) => ReactNode;
  className?: string;
  width?: number; // in pixels
}

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  keyExtractor: (row: T) => string | number;
  emptyMessage?: string;
  tableId?: string; // For localStorage persistence
  resizable?: boolean; // Enable/disable column resizing (default: true)
}

const DEFAULT_COLUMN_WIDTH = 150;

export function DataTableResizable<T>({
  data,
  columns,
  keyExtractor,
  emptyMessage = "No records found.",
  tableId = "default-table",
  resizable = true,
}: DataTableProps<T>) {
  const [columnWidths, setColumnWidths] = useState<number[]>(() => {
    // Load from localStorage or use defaults
    if (typeof window === "undefined") return columns.map(col => col.width || DEFAULT_COLUMN_WIDTH);

    const stored = localStorage.getItem(`table-widths-${tableId}`);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return columns.map(col => col.width || DEFAULT_COLUMN_WIDTH);
      }
    }
    return columns.map(col => col.width || DEFAULT_COLUMN_WIDTH);
  });

  const [draggingColumn, setDraggingColumn] = useState<number | null>(null);
  const [startX, setStartX] = useState(0);
  const tableRef = useRef<HTMLDivElement>(null);

  // Save widths to localStorage
  useEffect(() => {
    localStorage.setItem(`table-widths-${tableId}`, JSON.stringify(columnWidths));
  }, [columnWidths, tableId]);

  const handleMouseDown = (e: React.MouseEvent, columnIndex: number) => {
    if (!resizable) return;

    // Only resize on the right edge of the column header
    const header = e.currentTarget as HTMLElement;
    const rect = header.getBoundingClientRect();
    const isRightEdge = e.clientX >= rect.right - 10;

    if (!isRightEdge) return;

    e.preventDefault();
    setDraggingColumn(columnIndex);
    setStartX(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingColumn === null) return;

    const delta = e.clientX - startX;
    const newWidths = [...columnWidths];
    const minWidth = 80; // Minimum column width

    newWidths[draggingColumn] = Math.max(minWidth, newWidths[draggingColumn] + delta);
    setColumnWidths(newWidths);
    setStartX(e.clientX);
  };

  const handleMouseUp = () => {
    setDraggingColumn(null);
  };

  return (
    <Card>
      <div
        ref={tableRef}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ userSelect: draggingColumn !== null ? "none" : "auto" }}
      >
        <Table>
          <THead>
            {columns.map((col, index) => (
              <TH
                key={index}
                style={{
                  width: `${columnWidths[index]}px`,
                  position: "relative",
                  minWidth: `${columnWidths[index]}px`,
                  maxWidth: `${columnWidths[index]}px`,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                onMouseDown={(e) => handleMouseDown(e, index)}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingRight: "8px",
                  }}
                >
                  <span>{col.header}</span>
                  {resizable && index < columns.length - 1 && (
                    <div
                      style={{
                        position: "absolute",
                        right: 0,
                        top: 0,
                        bottom: 0,
                        width: "10px",
                        cursor: "col-resize",
                        backgroundColor: draggingColumn === index ? "#1f5fa8" : "transparent",
                        opacity: draggingColumn === index ? 0.5 : 0,
                        transition: "opacity 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        if (draggingColumn === null) {
                          (e.currentTarget as HTMLElement).style.opacity = "0.3";
                          (e.currentTarget as HTMLElement).style.backgroundColor = "#1f5fa8";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (draggingColumn === null) {
                          (e.currentTarget as HTMLElement).style.opacity = "0";
                        }
                      }}
                    />
                  )}
                </div>
              </TH>
            ))}
          </THead>
          <TBody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-0 border-0">
                  <EmptyState message={emptyMessage} />
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <TR key={keyExtractor(row)}>
                  {columns.map((col, idx) => (
                    <TD
                      key={idx}
                      className={col.className}
                      style={{
                        width: `${columnWidths[idx]}px`,
                        minWidth: `${columnWidths[idx]}px`,
                        maxWidth: `${columnWidths[idx]}px`,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {col.cell
                        ? col.cell(row)
                        : col.accessorKey
                          ? (row[col.accessorKey] as ReactNode)
                          : null}
                    </TD>
                  ))}
                </TR>
              ))
            )}
          </TBody>
        </Table>
      </div>
    </Card>
  );
}
