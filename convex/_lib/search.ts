export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/gi, (letter) => letter === "Đ" ? "D" : "d")
    .toLocaleLowerCase("vi")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function placeSearchText(fields: {
  name: string;
  district?: string;
  address?: string;
  short_description?: string;
}): string {
  return normalizeSearchText([
    fields.name, fields.district, fields.address, fields.short_description,
  ].filter((part): part is string => Boolean(part)).join(" "));
}
