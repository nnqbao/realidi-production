"use client";

import { useState, useTransition } from "react";
import { adminImportPlacesCsv } from "@/features/admin/console-actions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function PlaceCsvImport() {
  const [pending, start] = useTransition();
  const [rows, setRows] = useState<{ line: number; error?: string; ok?: boolean; skipped?: string }[]>([]);

  return (
    <form
      className="mt-4 space-y-2 rounded-2xl border border-subtle p-4"
      action={(formData) =>
        start(async () => {
          const result = await adminImportPlacesCsv(formData);
          if (result.error) {
            toast.error(
              result.error === "HEADER"
                ? "CSV thiếu cột name, latitude hoặc longitude."
                : result.error === "EMPTY"
                  ? "File trống."
                  : "Không đọc được file.",
            );
            if (result.rows.length) setRows(result.rows);
            return;
          }
          setRows(result.rows);
          const ok = result.rows.filter((r) => r.ok).length;
          toast.success(`Đã nhập ${ok} dòng.`);
        })
      }
    >
      <p className="text-sm font-medium">Nhập CSV</p>
      <p className="text-xs text-[#6F7480]">
        Cột bắt buộc: name, latitude, longitude. Tùy chọn: slug, address, district, city, short_description, status, phone, website. Dòng trùng slug sẽ được bỏ qua.
      </p>
      <input type="file" name="file" accept=".csv,text/csv" required />
      <Button type="submit" disabled={pending} size="sm">
        {pending ? "Đang nhập…" : "Nhập CSV"}
      </Button>
      {rows.length ? (
        <ul className="max-h-40 overflow-auto text-xs text-[#6F7480]">
          {rows.map((row) => (
            <li key={row.line}>
              Dòng {row.line}: {row.ok ? "OK" : row.skipped ?? row.error}
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}
