"use client";

import { ErrorState } from "@/components/states";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="px-4 py-16">
      <ErrorState
        title="Có lỗi xảy ra"
        description="Thử lại. Nếu lặp lại, kiểm tra kết nối dữ liệu."
        retry={reset}
      />
    </div>
  );
}
