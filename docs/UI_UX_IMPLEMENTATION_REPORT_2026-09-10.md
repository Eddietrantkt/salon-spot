# Salon Spot — UI/UX implementation report

Ngày: 10/09/2026  
Nguồn yêu cầu: [`UX_UI_AUDIT_2026-09-10.md`](./UX_UI_AUDIT_2026-09-10.md)

## Phạm vi đã triển khai

Đã cải thiện vertical slice Explore/search và app shell, giữ nguyên API, schema, session, authorization và booking business rules.

- Tách semantic design tokens tại `apps/web/src/shared/design-tokens.css`: canvas, surface, text, border, brand, feedback, radius, shadow và motion.
- Thêm SVG line icon set dùng chung tại `apps/web/src/shared/ui/icon.tsx`; thay glyph location/date/image/arrow và emoji notification ở các surface chính.
- Search có request feedback rõ hơn: loading indicator, lỗi có `Try again` và `Change search`, giữ nguyên area/date để retry.
- Workspace card dùng ảnh lazy-load, fallback ảnh có ngữ nghĩa, metadata availability/live và visual hierarchy gọn hơn.
- App shell có nhóm `Workspace` cho Professional/Owner/Admin để tránh navbar tràn ở tablet; guest vẫn chỉ thấy Explore và Sign in theo capability hiện có.
- Mobile navigation có icon + label + unread badge, không còn emoji; thêm footer copy trung thực về availability/local time/booking details.
- Breakpoint 761–960px chuyển hero thành thứ tự copy → search → visual, để CTA tìm kiếm không bị đẩy khỏi vùng quan sát đầu tiên.

## Validation

- Repo lint/typecheck: PASS.
- Web typecheck: PASS.
- Web tests: PASS — 21/21.
- Web production build: PASS.
- `git diff --check`: PASS.
- Local browser preview: app render có DOM/ARIA, search error state hiển thị retry/change-search, login không có credential prefill, viewport hiện tại không overflow ngang.

## Chưa xác nhận trong slice này

- Browse → detail → hold → confirm với dữ liệu MySQL/API thật chưa được claim PASS trong report này.
- Visual QA đầy đủ ở 375/768/1024/1440px và owner flow cần một browser gate có backend/fixture đồng bộ.
- `styles.css` vẫn còn các rule lịch sử; token layer mới đang override an toàn. Việc hợp nhất toàn bộ CSS nên là một follow-up riêng để giảm drift.

## Next steps đề xuất

1. Chạy browser evidence gate với cùng candidate SHA và dataset cho browse → detail → booking.
2. Migrate detail/booking và My Bookings sang token/component states mới.
3. Tiếp tục thay technical copy/raw status ở Owner, Notifications và Admin theo content mapping EN/VI.
