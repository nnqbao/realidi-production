import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="font-display text-3xl">Không tìm thấy</h1>
      <p className="mt-2 text-muted-foreground">Trang này không tồn tại hoặc nơi đã được gộp.</p>
      <Link href="/home" className="mt-6 inline-block text-brand underline">
        Về bảng tin
      </Link>
    </main>
  );
}
