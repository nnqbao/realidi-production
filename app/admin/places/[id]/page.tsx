import { notFound, redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { adminMergePlaces, adminUpsertPlace } from "@/features/admin/actions";
import { adminRestorePlace, adminSetPlaceStatus, adminSoftDeletePlace } from "@/features/admin/console-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlaceMediaForm } from "@/features/admin/place-media-form";
import { Textarea } from "@/components/ui/textarea";

export default async function EditPlacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data: place } = await supabase.from("places").select("*").eq("id", id).maybeSingle();
  if (!place) notFound();
  const { data: others } = await supabase.from("places").select("id, name, address, latitude, longitude").neq("id", id).is("deleted_at", null).limit(200);
  const dupes = (others ?? []).filter((row) => {
    const sameName = row.name.trim().toLowerCase() === place.name.trim().toLowerCase();
    const sameAddress = Boolean(place.address && row.address && row.address.trim().toLowerCase() === place.address.trim().toLowerCase());
    const closeCoord =
      place.latitude != null &&
      place.longitude != null &&
      row.latitude != null &&
      row.longitude != null &&
      Math.abs(Number(row.latitude) - Number(place.latitude)) < 0.0003 &&
      Math.abs(Number(row.longitude) - Number(place.longitude)) < 0.0003;
    return sameName || sameAddress || closeCoord;
  });
  const { data: media } = await supabase.from("place_media").select("*").eq("place_id", id).order("sort_order");
  return (
    <div className="max-w-xl space-y-8">
      <h1 className="font-display text-3xl">{place.name}</h1>
      <p className="text-sm">
        <a href={`/place/${place.slug}`} className="underline" target="_blank" rel="noreferrer">
          Xem trước trang công khai
        </a>
      </p>
      {dupes.length > 0 ? (
        <p className="rounded-2xl border border-brand/16 bg-brand/6 px-4 py-3 text-sm">
          Có thể trùng với: {dupes.map((d) => d.name).join(", ")}
        </p>
      ) : null}
      <PlaceMediaForm placeId={id} />
      <ul className="text-sm text-[#6F7480]">
        {(media ?? []).map((m) => (
          <li key={m.id}>{m.storage_path} {m.alt_text ? `· ${m.alt_text}` : ""}</li>
        ))}
      </ul>
      <form
        className="space-y-3"
        action={async (formData) => {
          "use server";
          await adminUpsertPlace({
            id,
            name: formData.get("name"),
            slug: place.slug,
            shortDescription: formData.get("shortDescription"),
            description: formData.get("description") || place.description,
            categoryId: place.category_id,
            address: formData.get("address"),
            district: formData.get("district"),
            city: formData.get("city") || place.city,
            latitude: Number(formData.get("latitude")),
            longitude: Number(formData.get("longitude")),
            editorialScore: Number(formData.get("editorialScore")),
            adminQualityScore: Number(formData.get("adminQualityScore")),
            status: formData.get("status"),
            typicalDurationMinutes: place.typical_duration_minutes,
            website: formData.get("website") || null,
            phone: formData.get("phone") || null,
            googleMapsUrl: formData.get("googleMapsUrl") || null,
            seoTitle: formData.get("seoTitle") || null,
            seoDescription: formData.get("seoDescription") || null,
          });
          redirect("/admin/places");
        }}
      >
        <Label>Mô tả</Label>
        <Textarea name="description" defaultValue={place.description ?? ""} />
        <Label>Thành phố</Label>
        <Input name="city" defaultValue={place.city ?? ""} />
        <Label>Google Maps URL</Label>
        <Input name="googleMapsUrl" defaultValue={place.google_maps_url ?? ""} />
        <Input name="name" defaultValue={place.name} />
        <Label>Mô tả ngắn</Label>
        <Input name="shortDescription" defaultValue={place.short_description ?? ""} />
        <Label>Địa chỉ</Label>
        <Input name="address" defaultValue={place.address ?? ""} />
        <Label>Quận</Label>
        <Input name="district" defaultValue={place.district ?? ""} />
        <Label>Lat</Label>
        <Input name="latitude" defaultValue={place.latitude ?? ""} />
        <Label>Lng</Label>
        <Input name="longitude" defaultValue={place.longitude ?? ""} />
        <Label>Editorial score</Label>
        <Input name="editorialScore" defaultValue={String(place.editorial_score)} />
        <Label>Admin quality</Label>
        <Input name="adminQualityScore" defaultValue={String(place.admin_quality_score)} />
        <Label>Website</Label>
        <Input name="website" defaultValue={place.website ?? ""} />
        <Label>Điện thoại</Label>
        <Input name="phone" defaultValue={place.phone ?? ""} />
        <Label>SEO title</Label>
        <Input name="seoTitle" defaultValue={place.seo_title ?? ""} />
        <Label>SEO description</Label>
        <Textarea name="seoDescription" defaultValue={place.seo_description ?? ""} />
        <Label>Trạng thái</Label>
        <select name="status" defaultValue={place.status} className="w-full rounded-xl border border-brand/14 bg-surface px-3 py-2">
          <option value="draft">Nháp</option>
          <option value="active">Đang hiện</option>
          <option value="hidden">Ẩn</option>
          <option value="archived">Lưu trữ</option>
          <option value="temporarily_closed">Tạm đóng</option>
          <option value="permanently_closed">Đóng cửa</option>
          <option value="pending">Chờ duyệt</option>
        </select>
        <Button type="submit">Cập nhật</Button>
      </form>
      <form
        className="space-y-2 rounded-2xl border border-border p-4"
        action={async (formData) => {
          "use server";
          await adminMergePlaces(id, String(formData.get("intoId")));
          redirect("/admin/places");
        }}
      >
        <p className="text-sm font-medium">Gộp vào nơi khác</p>
        <select name="intoId" className="w-full rounded-xl border border-brand/14 bg-surface px-3 py-2">
          {(others ?? []).map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline">
          Gộp
        </Button>
      </form>
      <div className="flex flex-wrap gap-2">
        <form
          action={async () => {
            "use server";
            await adminSetPlaceStatus(id, "active", "publish");
          }}
        >
          <Button type="submit" variant="outline">
            Publish
          </Button>
        </form>
        <form
          action={async () => {
            "use server";
            await adminSetPlaceStatus(id, "hidden", "unpublish");
          }}
        >
          <Button type="submit" variant="outline">
            Ẩn
          </Button>
        </form>
        <form
          action={async () => {
            "use server";
            await adminSetPlaceStatus(id, "archived", "archive");
          }}
        >
          <Button type="submit" variant="outline">
            Lưu trữ
          </Button>
        </form>
        {place.deleted_at ? (
          <form
            action={async () => {
              "use server";
              await adminRestorePlace(id);
            }}
          >
            <Button type="submit">Khôi phục</Button>
          </form>
        ) : (
          <form
            action={async () => {
              "use server";
              await adminSoftDeletePlace(id, "admin_soft_delete");
            }}
          >
            <Button type="submit" variant="ghost">
              Xóa mềm
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
