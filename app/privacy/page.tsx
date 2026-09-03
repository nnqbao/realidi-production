export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="font-display text-3xl">Chính sách quyền riêng tư</h1>
      <p className="mt-4 text-sm leading-6 text-[#6F7480]">
        Realidi lưu hồ sơ, bài viết, tin nhắn và dữ liệu phiên để vận hành sản phẩm. Chúng tôi không bán dữ liệu cá nhân.
        Bạn có thể yêu cầu tải dữ liệu hoặc xóa tài khoản trong Cài đặt.
      </p>
      <p className="mt-3 text-sm leading-6 text-[#6F7480]">
        Session được lưu bằng cookie HttpOnly. Email xác minh và đặt lại mật khẩu do nhà cung cấp xác thực gửi.
      </p>
    </main>
  );
}
