<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Frontend design system

- Giao diện frontend mới hoặc được chỉnh sửa phải bám theo theme foundation “Ms Chau’s IELTS”.
- Dùng chung `FoundationTheme` trong `src/features/foundation/foundation-theme.tsx`; giữ nguyên cơ chế chọn theme theo hệ điều hành và lưu lựa chọn giữa các trang.
- Màu sắc lấy từ semantic tokens trong `src/features/foundation/foundation.module.css`. Không tạo bảng màu Light/Dark riêng hoặc gắn mã màu trực tiếp trong component; bổ sung token tại nguồn này khi cần.
- Dùng typography, header/footer, icon `currentColor`, bo góc và focus ring của foundation. Thương hiệu/tiêu đề tiếng Anh dùng `--serif`; tiêu đề tiếng Việt (gồm các trang tài khoản), nội dung và biểu mẫu dùng Be Vietnam Pro đã nạp subset `vietnamese` để tránh lệch dấu hoặc fallback từng ký tự.
- Hỗ trợ cả Light/Dark, responsive, bàn phím và `prefers-reduced-motion` khi triển khai giao diện.
