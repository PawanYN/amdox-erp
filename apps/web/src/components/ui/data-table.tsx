"use client";

import React, { ReactNode } from "react";
import { Table, THead, TH, TBody, TR, TD, EmptyState } from "./table";
import { Card } from "./card";

export interface ColumnDef<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  keyExtractor: (row: T) => string | number;
  emptyMessage?: string;
}

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  emptyMessage = "No records found.",
}: DataTableProps<T>) {
  return (
    <Card>
      <Table>
        <THead>
          {columns.map((col, index) => (
            <TH key={index}>{col.header}</TH>
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
                  <TD key={idx} className={col.className}>
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
    </Card>
  );
}
