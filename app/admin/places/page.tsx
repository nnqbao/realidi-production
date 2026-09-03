import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { PlaceCsvImport } from "@/features/admin/place-csv-import";
import type { PlaceStatus } from "@/types/database";

const PAGE_SIZE = 30;

export default async function AdminPlacesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const { q, status, page } = await searchParams;
  const offset = Math.max(0, (Number(page ?? 1) - 1) * PAGE_SIZE);
  const supabase = await createServerSupabase();
  let query = supabase
    .from("places")
    .select("id, name, slug, status, editorial_score, district, deleted_at", { count: "exact" })
    .order("name")
    .range(offset, offset + PAGE_SIZE - 1);
  if (status === "deleted") query = query.not("deleted_at", "is", null);
  else {
    query = query.is("deleted_at", null);
    if (status) query = query.eq("status", status as PlaceStatus);
  }
  if (q) {
    const safe = q.replace(/[%_,()]/g, " ").trim();
    if (safe) query = query.or(`name.ilike.%${safe}%,district.ilike.%${safe}%,slug.ilike.%${safe}%`);
  }
  const { data, count } = await query;
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const current = Number(page ?? 1) || 1;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl">Địa điểm</h1>
        <Button asChild>
          <Link href="/admin/places/new">Tạo địa điểm</Link>
        </Button>
      </div>
      <form className="mt-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Tên, slug, khu vực" className="min-h-11 rounded-xl border border-brand/14 px-3" />
        <select name="status" defaultValue={status ?? ""} className="min-h-11 rounded-xl border border-brand/14 px-3">
          <option value="">Mọi trạng thái</option>
          <option value="draft">Nháp</option>
          <option value="active">Đang hiện</option>
          <option value="hidden">Ẩn</option>
          <option value="archived">Lưu trữ</option>
          <option value="pending">Chờ duyệt</option>
          <option value="deleted">Đã xóa mềm</option>
        </select>
        <button type="submit" className="min-h-11 rounded-xl bg-brand px-4 text-sm text-white">
          Lọc
        </button>
      </form>
      <PlaceCsvImport />
      {(data ?? []).length === 0 ? (
        <p className="mt-6 text-sm text-[#6F7480]">Chưa có địa điểm khớp bộ lọc.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {(data ?? []).map((p) => (
            <li key={p.id} className="flex items-center justify-between rounded-2xl border border-subtle bg-surface px-4 py-3">
              <div>
                <Link href={`/admin/places/${p.id}`} className="font-medium">
                  {p.name}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {p.district} · {p.deleted_at ? "đã xóa mềm" : p.status}
                </p>
              </div>
              <Link href={`/place/${p.slug}`} className="text-sm underline">
                Xem
              </Link>
            </li>
          ))}
        </ul>
      )}
      {totalPages > 1 ? (
        <p className="mt-4 text-sm">
          {current > 1 ? (
            <Link href={`/admin/places?q=${q ?? ""}&status=${status ?? ""}&page=${current - 1}`} className="underline">
              Trước
            </Link>
          ) : null}{" "}
          Trang {current}/{totalPages}{" "}
          {current < totalPages ? (
            <Link href={`/admin/places?q=${q ?? ""}&status=${status ?? ""}&page=${current + 1}`} className="underline">
              Sau
            </Link>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
