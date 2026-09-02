**Báo cáo công việc 25/08**  
**Dự án:** The Salon Spot  
**Task:** Hoàn thiện D3-D4 của MVP: Owner quản lý Salon, Workspace, ảnh và publish; đồng thời cấu hình môi trường local, kiểm tra hệ thống và sửa các lỗi trải nghiệm khi test.  
**Tiến độ:** Hoàn thành luồng tạo Salon/Workspace, tải và xử lý ảnh, chọn cover, sắp xếp/xóa ảnh, checklist publish và worker dọn ảnh. Đã sửa lỗi nhập giá khiến không tạo được Workspace, giảm mật khẩu đăng ký tối thiểu xuống 8 ký tự và giảm tải lại dữ liệu sau thao tác ảnh/publish. API có 18 suite/36 test đạt; typecheck API/web và web build đều đạt.  
**Còn lại:** Xác nhận migration D3-D4 trên MySQL local, kiểm tra lại luồng Owner trên trình duyệt sau khi làm mới trang, và bổ sung test transaction/race trên MySQL thật. Tiếp theo triển khai D5: slot cố định và quy tắc chặn lịch.
