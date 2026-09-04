import { api } from "@/convex/_generated/api";
import { convexQueryAuthed } from "@/lib/convex/server";
import { adminUpsertPlace } from "@/features/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { redirect } from "next/navigation";
import { slugify } from "@/lib/utils";

export default async function NewPlacePage() {
  const categories = await convexQueryAuthed(api.editorial.listCategories, {});
  return (
    <div className="max-w-xl">
      <h1 className="font-display text-3xl">Tạo nơi</h1>
      <form
        className="mt-6 space-y-3"
        action={async (formData) => {
          "use server";
          const name = String(formData.get("name"));
          await adminUpsertPlace({
            name,
            slug: slugify(name),
            shortDescription: formData.get("shortDescription"),
            description: formData.get("description"),
            categoryId: formData.get("categoryId") || null,
            address: formData.get("address"),
            district: formData.get("district"),
            city: "TP. Hồ Chí Minh",
            latitude: Number(formData.get("latitude")),
            longitude: Number(formData.get("longitude")),
            editorialScore: Number(formData.get("editorialScore") || 0.5),
            adminQualityScore: Number(formData.get("adminQualityScore") || 0.5),
            status: String(formData.get("status") || "draft"),
            typicalDurationMinutes: Number(formData.get("duration") || 60),
            website: formData.get("website") || null,
            phone: formData.get("phone") || null,
            googleMapsUrl: formData.get("googleMapsUrl") || null,
            seoTitle: formData.get("seoTitle") || null,
            seoDescription: formData.get("seoDescription") || null,
          });
          redirect("/admin/places");
        }}
      >
        <Field name="name" label="Tên" />
        <Field name="shortDescription" label="Mô tả ngắn" />
        <div>
          <Label>Mô tả</Label>
          <Textarea name="description" className="mt-1" />
        </div>
        <label className="block text-sm">
          Danh mục
          <select name="categoryId" className="mt-1 w-full rounded-xl border border-brand/14 bg-surface px-3 py-2">
            {categories.filter((c) => c.is_active).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name_vi}
              </option>
            ))}
          </select>
        </label>
        <Field name="address" label="Địa chỉ" />
        <Field name="district" label="Quận" />
        <Field name="latitude" label="Latitude" />
        <Field name="longitude" label="Longitude" />
        <Field name="editorialScore" label="Editorial score 0–1" defaultValue="0.7" />
        <Field name="adminQualityScore" label="Admin quality 0–1" defaultValue="0.7" />
        <Field name="duration" label="Thời lượng (phút)" defaultValue="60" />
        <Field name="website" label="Website" />
        <Field name="phone" label="Điện thoại" />
        <Field name="googleMapsUrl" label="Google Maps URL" />
        <Field name="seoTitle" label="SEO title" />
        <div>
          <Label>SEO description</Label>
          <Textarea name="seoDescription" className="mt-1" />
        </div>
        <label className="block text-sm">
          Trạng thái
          <select name="status" defaultValue="draft" className="mt-1 w-full rounded-xl border border-brand/14 bg-surface px-3 py-2">
            <option value="draft">Nháp</option>
            <option value="active">Đang hiện</option>
            <option value="hidden">Ẩn</option>
          </select>
        </label>
        <Button type="submit">Lưu</Button>
      </form>
    </div>
  );
}

function Field({ name, label, defaultValue }: { name: string; label: string; defaultValue?: string }) {
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} defaultValue={defaultValue} className="mt-1" required={name === "name"} />
    </div>
  );
}
