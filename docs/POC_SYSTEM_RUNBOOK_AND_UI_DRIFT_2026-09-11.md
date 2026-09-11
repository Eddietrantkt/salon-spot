
# The Salon Spot — Runbook, môi trường và lý do hiện vẫn là POC

Ngày lập: 11/09/2026
Phạm vi: checkout D:/downloadD/salon_spot, candidate UI d8350217c0e4d7dfe6646dd4e5068bbe8553190c
Hosted demo: https://salon-spot-web-poc.vercel.app/

> Tài liệu này mô tả cách chạy và ranh giới bằng chứng của hệ thống hiện tại. Nó không phải tuyên bố rằng hosted demo đã đạt production readiness.

## 1. Tóm tắt kiến trúc

~~~text
Browser
  |
  v
Vercel: static React/Vite web + SPA fallback + /api rewrite
  |
  v
Render Free: NestJS API và worker chạy cùng process trong hosted POC
  |
  v
Aiven MySQL Free: dữ liệu hosted POC
~~~

Local/package runtime dùng topology khác:

~~~text
Browser -> nginx web :8080 -> API :3000 -> MySQL 8.4 :3307
                                      \
                                       -> worker :3001
~~~

Các nguồn cấu hình chính:

- package.json: workspace scripts và package manager.
- apps/web/vite.config.ts: web dev server và proxy /api vào API local.
- vercel.json: build Vite web, rewrite /api/* tới Render API, fallback route về index.html.
- render.yaml: Render API Free, autoDeploy: false, worker chạy trong API qua RUN_WORKERS_IN_API=true.
- compose.yaml: MySQL local tối thiểu.
- compose.runtime.yaml: packaged runtime gồm MySQL, migrate, API, worker và nginx web.
- Dockerfile: build/runtime image dùng Node 24.
- docs/VERCEL_RENDER_AIVEN_POC_SETUP.md và docs/RUNTIME_OPERATIONS_RUNBOOK.md: runbook vận hành chi tiết.

## 2. Chuẩn môi trường

| Thành phần | Chuẩn/giá trị | Ghi chú |
| --- | --- | --- |
| Node.js | Node 24 | Đây là version dùng trong Docker/CI baseline; máy kiểm tra trước đó có Node 25 nên không phải môi trường tái lập chuẩn |
| pnpm | 10.32.0 | Khớp package.json và lockfile |
| Database | MySQL 8.4 | Prisma schema/migration là DB truth |
| Web local | Vite, mặc định 5173 | Có thể thay bằng cấu hình Vite |
| API local | NestJS, mặc định 3000 | PORT trong env |
| Worker runtime | Cổng nội bộ 3001 | Không expose ra host trong Compose baseline |
| Packaged web | http://localhost:8080 | nginx proxy /api tới API |
| Hosted web | Vercel | Static artifact, SPA fallback |
| Hosted API | Render Free | URL bị che sau Vercel rewrite ở browser |
| Hosted DB | Aiven MySQL Free theo POC setup | Không được coi là DB production |

Không commit các giá trị thật của DATABASE_URL, JWT secret, refresh-token pepper, media secret, password hoặc cookie secret. Chỉ dùng file example làm mẫu; secret thật phải được cấp qua environment/secret manager của môi trường tương ứng.

## 3. Chạy local từ đầu

Thực hiện tại thư mục repository root.

### 3.1 Chuẩn bị dependency và env

~~~powershell
corepack enable
pnpm install --frozen-lockfile
Copy-Item .env.example apps/api/.env
~~~

Mở apps/api/.env và thay toàn bộ placeholder secret. Đảm bảo DATABASE_URL trỏ đúng MySQL local ở host port 3307, ví dụ về cấu trúc:

~~~text
mysql://<user>:<password>@127.0.0.1:3307/<database>
~~~

Các biến quan trọng:

- DATABASE_URL, PORT, WEB_ORIGIN, NODE_ENV.
- JWT_ACCESS_SECRET, REFRESH_TOKEN_PEPPER.
- MEDIA_UPLOAD_SECRET, MEDIA_PUBLIC_BASE_URL, MEDIA_STORAGE_ROOT.
- SLOT_HOLD_TTL_SECONDS và các giới hạn upload/media.

### 3.2 Khởi động MySQL và migration

~~~powershell
docker compose up -d mysql
pnpm prisma:generate
Push-Location apps/api
pnpm exec prisma migrate deploy --schema prisma/schema.prisma
Pop-Location
~~~

Kiểm tra schema trước khi chạy:

~~~powershell
Push-Location apps/api
pnpm exec prisma validate --schema prisma/schema.prisma
Pop-Location
~~~

### 3.3 Seed demo local

~~~powershell
pnpm --filter @salon-spot/api demo:seed
~~~

Seed chỉ dành cho database demo local cô lập. Nó tạo các tài khoản, salon, workspace, slot và booking mẫu có identifier demo_*, đồng thời reset fixture demo về trạng thái biết trước. Không chạy lệnh này trên database có dữ liệu thật.

### 3.4 Chạy API và web

Mở hai terminal:

~~~powershell
pnpm --filter @salon-spot/api dev
~~~

~~~powershell
pnpm --filter @salon-spot/web dev
~~~

Mở http://localhost:5173. Vite proxy /api tới http://localhost:3000 theo VITE_DEV_API_ORIGIN; có thể override biến này nếu API local chạy ở cổng khác.

Health checks:

~~~powershell
Invoke-WebRequest http://localhost:3000/api/v1/health
Invoke-WebRequest http://localhost:3000/api/v1/health/ready
~~~

Worker development mode:

~~~powershell
pnpm --filter @salon-spot/api worker:dev
~~~

Không chạy worker riêng đồng thời với RUN_WORKERS_IN_API=true trên cùng database; nếu không sẽ có hai scheduler cùng xử lý job.

## 4. Chạy packaged runtime bằng Docker Compose

Đây là cách gần CI/runtime hơn local dev:

~~~powershell
Copy-Item .env.runtime.example .env.runtime
~~~

Thay placeholder trong .env.runtime, sau đó:

~~~powershell
pnpm runtime:up
docker compose --project-name salon-spot-runtime --env-file .env.runtime -f compose.runtime.yaml ps
~~~

Mở http://localhost:8080. Thứ tự khởi động là:

1. MySQL healthy.
2. Container migrate chạy prisma migrate deploy.
3. API và worker khởi động sau khi migration thành công.
4. nginx web phục vụ static build và proxy API.

Dừng runtime:

~~~powershell
pnpm runtime:down
~~~

Không thêm --volumes trừ khi cố ý xóa database/media của đúng runtime Compose project đó. Luôn dùng project name riêng để không đụng container/volume của người dùng.

## 5. Kiểm tra và bằng chứng hiện có

Các gate đã chạy trên candidate nêu ở đầu tài liệu:

| Gate | Kết quả | Diễn giải |
| --- | --- | --- |
| pnpm typecheck | PASS | Contracts, API và web hoàn tất |
| pnpm lint | PASS | Script hiện chủ yếu chạy TypeScript check |
| pnpm test | PASS | Web 28/28; API 48 suites, 129 pass tests; deployment config 1/1 |
| Production build | PASS | Contracts/API/Vite web build thành công |
| MySQL E2E | PASS trên DB disposable | 11/11 migrations, 6/6 suites, 24/24 tests |
| Packaged browser UAT | Chưa đạt | Runtime/migration/seed/health/cleanup pass; browser 5 pass, 6 fail do debug test, locator và expectation stale |
| Hosted health | PASS tại lần kiểm tra | /api/v1/health và /api/v1/health/ready HTTP 200 |
| Hosted UI smoke | PASS trong phạm vi đã kiểm tra | Search/detail/empty state/EN-VI/routes/responsive; không ghi nhận console warning/error |

Các kết quả trên không đồng nghĩa mọi workflow production đã được chứng minh. Đặc biệt, browser UAT packaged vẫn fail và chưa có candidate SHA công khai được xác nhận từ Vercel.

## 6. Vì sao đây vẫn là POC, chưa phải production

### 6.1 Hạ tầng hosted còn là free/demo topology

- Render dùng gói Free, có thể sleep khi idle, giới hạn CPU/RAM và restart không kiểm soát như production.
- Worker hosted chạy cùng process API vì Render Free không có background worker riêng. Đây là workaround POC, không phải topology ưu tiên cho production.
- Aiven Free có giới hạn dung lượng/kết nối, có thể power off khi không hoạt động và không có SLA production.
- Media hosted đặt ở /tmp/media, có thể mất sau restart/redeploy. Chưa có object storage bền vững như S3/R2 adapter đã cấu hình đầy đủ.
- Vercel đang phục vụ static web; không phải bằng chứng rằng toàn bộ backend, database, worker và deployment lifecycle đã có HA.

### 6.2 Release identity và deployment proof chưa đủ chặt

- HTML public không expose candidate commit SHA; chỉ thấy Vercel cache/deployment headers.
- render.yaml đặt autoDeploy: false, nên push GitHub không tự động đồng nghĩa API hosted đã deploy.
- Vercel rewrite tới một API Render khác môi trường local. Vì vậy cùng source UI vẫn có thể hiển thị data, session và trạng thái booking khác.
- Muốn production phải có build manifest/version endpoint, artifact digest, migration record và bằng chứng deploy gắn với đúng SHA.

### 6.3 Phạm vi sản phẩm còn cố ý giới hạn

Đã có nền tảng Core MVP: auth/session, Owner BOLA theo salon, Admin capability, Professional profile, workspace/publication, fixed availability và booking không thanh toán theo chuỗi detail → hold → confirm → cancel/complete.

Nhưng các phần sau chưa nằm trong production scope hoặc chưa được xác minh đầy đủ:

- Payment thật, refund, reconciliation.
- Email provider thật, retry/feedback khi provider ngoài thất bại.
- Chat, Manager, reschedule và các workflow marketplace mở rộng.
- Professional verification đầy đủ với private evidence, Admin review và rollout tài khoản cũ.
- Rate limiting, abuse protection, WAF, SLO/alerting production.
- HA/failover cho API, worker, MySQL và media storage.
- Backup/restore vận hành định kỳ có owner, retention, RTO/RPO và cảnh báo thật.
- Clean guest browser, toàn bộ mutation Owner/Admin và booking UI trên candidate hosted chưa được sign-off.

## 7. Vì sao UI local/source có thể nhìn khác hosted web

### 7.1 Điều đã xác nhận

Trong lần đối chiếu ngày 11/09/2026:

- Local build tạo apps/web/dist/assets/index-DNqiN7y6.js và index-BjZ8maFq.css.
- HTML hosted Vercel cũng tham chiếu đúng hai asset hash này.
- Last-Modified của HTML hosted là 2026-09-11 08:43:49 GMT, trùng thời điểm commit UI d835021 lúc 15:43:00 +07 ở mức phút.
- Tuy nhiên hosted response không public candidate SHA, nên chỉ có thể kết luận asset đang quan sát khớp local build; chưa thể chứng minh cryptographically rằng Vercel build từ đúng commit.

Vì vậy hiện chưa có bằng chứng mạnh rằng source JSX/CSS đang chạy trên web là một phiên bản hoàn toàn khác. Chênh lệch nhìn thấy nên kiểm tra theo các nguyên nhân dưới đây.

### 7.2 Các nguyên nhân thường gặp trong checkout này

1. **Locale lưu trong browser**: web mặc định English nhưng lựa chọn EN/VI lưu ở localStorage key salon-spot.locale. Hai browser/profile có thể hiển thị cùng build nhưng khác ngôn ngữ, format tiền và ngày.
2. **Session và capability**: guest, Professional, Owner và Admin có navigation/route khác nhau. Refresh cookie và access token cũng làm page xuất hiện khác sau khi session restore.
3. **Route/query state**: trang root chưa search khác trang root có ?area=D1&date=...; detail mới khác URL fixture cũ. Đây là state thật, không chỉ CSS.
4. **Dữ liệu khác môi trường**: local dùng MySQL local/seed; hosted gọi API Render qua Vercel rewrite và dùng database hosted. Workspace, slot, booking, notification và user profile không được kỳ vọng giống nhau.
5. **Viewport/responsive breakpoint**: layout mobile/tablet/desktop khác nhau. Đã phát hiện ở khoảng 895px account text có thể bị cắt nội bộ dù trang không overflow ngang; 390px và 1440px không ghi nhận page overflow trong lần đo trước.
6. **Cache/deployment timing**: Vercel có X-Vercel-Cache: HIT; push GitHub không đủ để chứng minh hosted đã nhận commit mới, đặc biệt khi backend Render đang autoDeploy: false.
7. **Ảnh ngoài**: hero visual dùng URL ảnh bên ngoài và có fallback. CDN/browser cache hoặc lỗi tải ảnh có thể làm visual khác dù DOM/layout giống.
8. **Fixture ID đã đổi**: reference cũ demo_chair trả 404; API hiện dùng demo_ws_chair và demo_ws_private. Vì vậy bookmark/tài liệu/test cũ sẽ dẫn tới UI lỗi, tạo cảm giác web “khác”.

### 7.3 Cách đối chiếu một cách đáng tin cậy

Khi cần kết luận local và hosted có cùng bản hay không, ghi lại cùng một bảng cho mỗi lần kiểm tra:

| Trường | Local | Hosted |
| --- | --- | --- |
| Git commit SHA | git rev-parse HEAD | Deployment metadata/artifact SHA từ Vercel/CI |
| Web asset hash | tên asset trong apps/web/dist/index.html | asset trong HTML public |
| API origin | Vite proxy/local API | Vercel rewrite → Render API |
| Locale | localStorage['salon-spot.locale'] | locale của browser profile |
| Session | guest/demo role | guest/demo role và thời điểm restore |
| Viewport | width/height | width/height |
| URL/query | route và query đầy đủ | route và query đầy đủ |
| API response | status/body đã redacted | status/body đã redacted |

Không dùng screenshot đơn lẻ để kết luận deployment drift. Screenshot phải đi cùng URL, viewport, body/DOM text, console/page errors, request/API evidence và candidate SHA.

## 8. Các điểm cần sửa/làm rõ trước khi gọi production

### Ưu tiên release gate

- Đưa e2e/debug-login.spec.ts ra khỏi test discovery hoặc đổi hard-coded port sang baseURL.
- Sửa expectation/locator stale trong e2e/p1-release-gate.spec.ts.
- Cập nhật toàn bộ reference demo_chair sang demo_ws_chair, hoặc triển khai compatibility redirect nếu link cũ còn public.
- Chạy lại packaged browser UAT trên Node 24 clean checkout và lưu report.json gắn với SHA.
- Tách rõ “GitHub push”, “Vercel web deploy” và “Render API deploy”; mỗi lớp phải có status/commit evidence riêng.

### Ưu tiên vận hành và an toàn dữ liệu

- Dùng database/identity disposable cho booking UAT; không test hold/confirm/cancel trên account hoặc DB thật.
- Xác định owner của migration, backup, restore, rollback và secret rotation.
- Chọn persistent object storage cho media trước khi có dữ liệu thật.
- Bổ sung rate limit, alerting, log retention, health SLO và recovery rehearsal.
- Chốt production topology cho worker thay vì chạy chung process với API.

### Ranh giới booking UI

Trong audit hiện tại chỉ chọn slot trên UI để xác minh bước chuyển trạng thái. Chưa bấm “Giữ khung giờ đã chọn”, “Xác nhận lịch đặt” hoặc “Hủy lịch đặt” vì các thao tác này ghi/thay đổi booking state. Muốn sign-off end-to-end cần một môi trường disposable và tài khoản disposable được cấp riêng cho UAT.

## 9. Kết luận

The Salon Spot hiện là một **functional workflow POC** có web hosted chạy được, API/DB flow đã có nhiều bằng chứng tốt và local packaged runtime có thể tái lập. Nó chưa phải production vì hạ tầng free/ephemeral, worker workaround, release identity chưa chặt, browser gate còn fail, fixture reference còn drift và các dịch vụ production như payment/email/storage/monitoring/HA chưa hoàn chỉnh.

Chênh lệch UI quan sát trên web hiện được giải thích hợp lý nhất bởi state/môi trường/deployment evidence chưa được khóa cùng nhau; asset hash hosted đang khớp local build đã kiểm tra. Không nên sửa UI theo cảm nhận trước khi đối chiếu đủ SHA, locale, session, viewport, route và API response.
