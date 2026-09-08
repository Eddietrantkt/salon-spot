# Runbook triển khai POC: Oracle A1 + Cloudflare

## Phạm vi và topology đã triển khai

Đây là một POC single-VM, không phải HA hay SLA production. Các service là
container riêng, nhưng chỉ có một hostname public để giữ refresh-cookie
same-origin:

```text
Internet -> Cloudflare DNS/TLS (Full strict) -> Oracle A1 ARM64
                                               -> nginx/web Vite :443
                                               -> Nest API (private)
                                               -> worker (private)
                                               -> MySQL (private volume)
```

`compose.production.yaml` không publish cổng 3306, 3000 hoặc 3001. Chỉ `web`
publish `80:80` và `443:443`. Media vẫn dùng Docker volume nội bộ ở giai đoạn
này; không cấu hình Aiven/R2 trước khi có S3 media adapter.

## Artefacts

| Artifact | Vai trò |
| --- | --- |
| `compose.production.yaml` | Runtime độc lập cho VM Oracle, không dùng Compose local. |
| `infra/nginx.production.conf` | Redirect HTTP sang HTTPS, proxy `/api/*` nội bộ, TLS origin certificate. |
| `.env.production.example` | Mẫu biến môi trường; file `.env.production` thật bị Git ignore. |
| `infra/scripts/deploy-production.sh` | Preflight ARM64/secrets/certificate, build, migrate, health, worker-restart smoke. |
| `.github/workflows/arm64-container-gate.yml` | Build API/Prisma và web image cho `linux/arm64`, lưu metadata digest và archive checksum. |

## Những giá trị chủ sở hữu phải cung cấp

- Domain/subdomain public, ví dụ `app.example.com`.
- Quyền Oracle Cloud để tạo một VM Always Free A1 tại home region.
- Quyền Cloudflare zone cho domain đó.
- Ba secret auth/media và hai password MySQL mới, mỗi secret ít nhất 32 ký tự.

Không gửi secret vào chat, Git, issue hoặc workflow log.

## Quy trình triển khai

1. Trong Oracle Cloud, tạo VM `VM.Standard.A1.Flex` ARM64 ở home region. Gắn
   public IPv4 và chỉ mở TCP 22 (chỉ IP quản trị), 80 và 443 trong cả VCN
   security list và firewall của VM. Không mở 3306/3000/3001.
2. Cài Docker Engine + Docker Compose plugin, Git, và clone source tại một thư
   mục chỉ deploy account đọc/ghi được. Dùng commit đã qua release gate.
3. Trong Cloudflare, thêm zone/domain, tạo record `A` cho `app.<domain>` trỏ
   đến IPv4 Oracle và bật proxy. Tạo Cloudflare Origin Certificate cho đúng
   hostname. Copy certificate/key vào VM tại `secrets/cloudflare-origin.pem`
   và `secrets/cloudflare-origin.key`; không commit hai file này.
4. Copy `.env.production.example` thành `.env.production`, thay toàn bộ
   placeholder. `WEB_ORIGIN` phải là `https://app.<domain>` và
   `MEDIA_PUBLIC_BASE_URL` là `https://app.<domain>/api/v1`.
5. Chạy trên VM:

   ```sh
   sh infra/scripts/deploy-production.sh
   ```

   Script từ chối chạy nếu không phải ARM64, còn placeholder secret/certificate
   hoặc migration/healthcheck không đạt. Nó chạy migration trước API/worker,
   sau đó kiểm tra API, worker, proxy TLS và restart worker một lần.
6. Sau khi origin trả HTTPS thành công, đặt Cloudflare SSL/TLS encryption mode
   thành **Full (strict)**. Không dùng Flexible. Kiểm tra từ browser qua domain:
   trang chủ, đăng ký/đăng nhập/refresh/logout và một luồng booking.

## Điều kiện GO cho POC public

- GitHub workflow `ARM64 container gate` xanh cho commit deploy; metadata image
  có platform `linux/arm64`.
- `deploy-production.sh` trả `production_deploy_ok` trên VM A1 thật.
- Cloudflare Full (strict) hoạt động, HTTP redirect HTTPS, MySQL/API/worker
  không truy cập được từ Internet.
- Browser smoke ở hostname public đạt các luồng auth và booking đã nêu.

Build ARM64 qua emulation trong CI chỉ chứng minh image build được. VM smoke là
bằng chứng runtime ARM64 thật; browser smoke Cloudflare là bằng chứng TLS/cookie
end-to-end.

## Chưa nằm trong lần triển khai này

- Aiven MySQL: chuyển dữ liệu, TLS, connection pool và restore phải là một
  migration riêng sau khi POC ổn định.
- Cloudflare R2: source hiện dùng filesystem media, nên cần S3 adapter, CORS,
  signed upload/download và migration dữ liệu trước khi bật.
- Backup ngoài VM, monitoring/alerting, email provider và SLA.
