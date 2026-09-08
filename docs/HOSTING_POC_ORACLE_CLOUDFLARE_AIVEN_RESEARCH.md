# Nghiên cứu hosting POC: Oracle + Cloudflare + Aiven

Ngày kiểm tra: 07/09/2026. Phạm vi là POC ít người dùng, chi phí có thể bằng $0 nếu không vượt quota; đây **không** là cam kết production/SLA.

## Kết luận đề xuất

Đi theo từng bước, không tách dịch vụ quá sớm:

```text
Giai đoạn 1 — POC đơn máy
Cloudflare DNS/TLS -> Oracle A1 VM (Docker Compose: nginx -> web Vite, API, worker, MySQL private)

Giai đoạn 2 — tách dữ liệu/media khi POC ổn định
Cloudflare DNS/TLS -> Oracle A1 VM (nginx -> web Vite, API, worker)
                                               -> Aiven MySQL Free (TLS)
                                               -> Cloudflare R2 (S3 API)
```

Đây là phương án phù hợp hơn topology `Next.js`: source hiện tại là **React/Vite** ở `apps/web`, không phải Next.js. Giai đoạn 1 giữ frontend và backend là các container/process tách biệt nhưng dùng cùng origin qua nginx (`/api/*`), phù hợp refresh-cookie hiện có. Giai đoạn 2 chỉ nên thực hiện sau khi adapter media S3-compatible đã được cài đặt và kiểm thử; hiện runtime đang dùng media volume cục bộ.

## Đã xác nhận từ nguồn chính thức

| Thành phần | Xác nhận | Hệ quả cho POC |
| --- | --- | --- |
| Oracle Always Free Ampere A1 | Quota Always Free là 1.500 OCPU-giờ và 9.000 GB-giờ/tháng, tương đương tổng 2 OCPU + 12 GB RAM cho `VM.Standard.A1.Flex`; instance Always Free phải ở home region. Nếu báo hết host capacity, Oracle nói đây là thiếu shape tạm thời ở home region; thử Availability Domain khác hoặc chờ. Oracle cũng có chính sách reclaim Compute Always Free nếu bị coi là idle. | Có thể chạy một VM ARM64 nhỏ cho nginx/web/API/worker/MySQL POC, nhưng không được coi VM miễn phí là tài nguyên chắc chắn tạo mới được tại mọi thời điểm hoặc luôn hoạt động. |
| Cloudflare DNS/TLS | Cloudflare DNS Free không thu phí và không giới hạn DNS query theo FAQ; full setup cần sở hữu domain và trỏ nameserver. Universal SSL tự cấp/gia hạn miễn phí cho domain đã kích hoạt; full setup bao phủ apex và subdomain cấp một. `Full (strict)` yêu cầu origin certificate hợp lệ; Cloudflare Origin CA là một lựa chọn miễn phí. | Dùng Cloudflare làm authoritative DNS, proxy `app`/`api` và bật Full (strict), không dùng Flexible SSL. Domain vẫn là chi phí bên ngoài, không do Cloudflare Free cung cấp. |
| Cloudflare R2 | Free tier Standard: 10 GB-tháng storage, 1 triệu Class A request/tháng, 10 triệu Class B request/tháng; egress Internet miễn phí. Free tier không áp dụng Infrequent Access; đơn vị có làm tròn lên. | Hợp lý cho ảnh POC nhỏ, nhưng không phải “vô hạn miễn phí”; bật cảnh báo chi phí/budget trước upload thật. |
| Aiven MySQL Free | $0, không cần thẻ và không giới hạn thời gian theo tài liệu; 1 node, 1 CPU, 1 GB RAM, 1 GB disk, metrics/logs/backups. Giới hạn: không VPC/static IP/integration/forking, tối đa 76 connections, mỗi tổ chức chỉ một free service cho từng loại; có thể bị power-off nếu không có hoạt động ban đầu/liên tục và không có 99,99% SLA. | Đủ POC rất nhỏ nếu API dùng connection pool thận trọng. Không phù hợp “always-on demo” cần đảm bảo hoặc production. MySQL local trên Oracle đơn giản hơn ở giai đoạn 1 và tránh độ trễ/egress liên vùng. |
| GitHub Actions và ARM64 | GitHub-hosted runners cho public repo có `ubuntu-24.04-arm`/`ubuntu-22.04-arm`; tài liệu cũng nêu standard runner của public repo là free/unlimited. Docker `build-push-action` hỗ trợ multi-platform; `platforms` nhận danh sách target. | Release gate phải bổ sung ít nhất build + smoke trên `linux/arm64`, hoặc build multi-arch manifest `linux/amd64,linux/arm64` và triển khai theo digest. Không suy ra ARM64 pass từ CI x64 hiện tại. |
| Prisma trên ARM64 | Prisma cần engine nhị phân chạy cùng môi trường deploy. Linux ARM64 được hỗ trợ khi đủ OpenSSL, zlib, libgcc và libc; Debian/glibc thường ít rủi ro hơn Alpine. Tài liệu Docker Prisma nêu Debian slim phù hợp trên amd64/arm64, có thể cần cài `openssl`. | Dockerfile hiện dùng `node:24-bookworm-slim`, cài `openssl` và chạy `prisma:generate` **trong image build**: đây là hướng phù hợp về mặt thiết kế. Tuy nhiên chưa có bằng chứng build/run ARM64 của chính candidate này. |

## Điều chưa xác minh — không được coi là GO

- Home region và tài khoản Oracle cụ thể có còn A1 capacity hay không; việc tạo instance phải kiểm tra trực tiếp trên console.
- Free MySQL của Aiven có region/cloud mong muốn tại thời điểm tạo; tài liệu nêu cloud/region/configuration free có thể bị Aiven thay đổi.
- Image hiện tại (`migration-runtime`, `api-runtime`, `web-runtime`) có build/run thật trên `linux/arm64`, Prisma `migrate deploy`, API/worker recovery và browser flow đạt trên VM A1.
- S3/R2 media adapter, CORS, signed upload/download, lifecycle/cleanup và `MEDIA_PUBLIC_BASE_URL` chưa được triển khai; R2 chưa thể thay thế local media volume chỉ bằng biến môi trường.
- DNS, domain ownership, certificate origin, firewall, backup ngoài VM, secrets và monitoring chưa được provision.

## Release gate tối thiểu trước Oracle A1

1. CI build image target `linux/arm64` (hoặc manifest đa kiến trúc) và lưu **image digest**.
2. Trên ARM64 thật: `prisma migrate deploy` rồi `/health/live`, `/health/ready`, worker restart/heartbeat và outbox recovery.
3. Browser POC qua Cloudflare Full (strict): register/login/refresh/logout, một booking, và không public MySQL/API/worker ports.
4. Chỉ sau khi ba bước trên đạt mới chuyển MySQL sang Aiven hoặc media sang R2; test restore lại trước khi xóa MySQL cũ.

## Nguồn chính thức

- [Oracle: Always Free Resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)
- [Oracle: Free Tier](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier.htm)
- [Oracle: reclaiming idle Always Free Compute](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm#idle)
- [Cloudflare: DNS FAQ](https://developers.cloudflare.com/dns/faq/)
- [Cloudflare: full DNS setup](https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/)
- [Cloudflare: Universal SSL](https://developers.cloudflare.com/ssl/edge-certificates/universal-ssl/)
- [Cloudflare: Full (strict) và HTTPS](https://developers.cloudflare.com/ssl/get-started/)
- [Cloudflare R2: pricing và free tier](https://developers.cloudflare.com/r2/pricing/)
- [Aiven: MySQL Free tier limits](https://aiven.io/docs/products/mysql/concepts/mysql-free-tier)
- [Aiven: MySQL pricing](https://aiven.io/pricing/mysql)
- [GitHub: GitHub-hosted runner architectures](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)
- [GitHub: publish Docker image from Actions](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images)
- [Docker: build-push-action multi-platform support](https://github.com/docker/build-push-action)
- [Prisma: Docker on ARM64/Debian](https://www.prisma.io/docs/guides/deployment/docker)
- [Prisma: Linux ARM64 system requirements](https://docs.prisma.io/docs/orm/reference/system-requirements)
- [Prisma: deploy to a different OS](https://docs.prisma.io/docs/orm/v6/prisma-client/deployment/deploy-to-a-different-os)
