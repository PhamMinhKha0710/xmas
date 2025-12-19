# 🎄 Cây Thông Noel 3D Tương Tác Sang Trọng Cao Cấp

> Một ứng dụng web cây thông Noel 3D chất lượng cao dựa trên **React**, **Three.js (R3F)** và **nhận dạng cử chỉ AI**.

Dự án này không chỉ là một cây, mà là một phòng trưng bày tương tác lưu giữ kỷ niệm. Hàng trăm nghìn hạt, đèn màu rực rỡ và ảnh Polaroid lơ lửng cùng nhau tạo nên một cây thông Noel xa xỉ. Người dùng có thể kiểm soát hình dạng của cây (tập hợp/phân tán) và xoay góc nhìn thông qua cử chỉ, trải nghiệm bữa tiệc thị giác cấp độ phim.

![Project Preview](public/preview.png)
*(Lưu ý: Đề xuất tải lên một ảnh chụp màn hình chạy dự án của bạn ở đây)*

## ✨ Tính Năng Cốt Lõi

* **Trải Nghiệm Thị Giác Cực Đỉnh**: Thân cây được tạo thành từ hơn 45,000 hạt phát sáng, kết hợp với hiệu ứng ánh sáng động (Bloom) và hiệu ứng lấp lánh, tạo ra không khí mơ màng.
* **Phòng Trưng Bày Kỷ Niệm**: Ảnh được treo lơ lửng trên cây theo phong cách "Polaroid", mỗi tấm là một vật thể phát sáng độc lập, hỗ trợ kết xuất hai mặt.
* **Kiểm Soát Cử Chỉ AI**: Không cần chuột, chỉ cần sử dụng camera để bắt cử chỉ để kiểm soát hình dạng của cây (tập hợp/phân tán) và xoay góc nhìn.
* **Chi Tiết Phong Phú**: Bao gồm đèn màu nhấp nháy động, tuyết vàng bạc rơi, và quà tặng Giáng sinh và trang trí kẹo phân bố ngẫu nhiên.
* **Tùy Chỉnh Cao**: **Hỗ trợ người dùng dễ dàng thay thế bằng ảnh của riêng mình, và tự do điều chỉnh số lượng ảnh.**

## 🛠️ Công Nghệ Sử Dụng

* **Framework**: React 18, Vite
* **Engine 3D**: React Three Fiber (Three.js)
* **Thư Viện Công Cụ**: @react-three/drei, Maath
* **Xử Lý Hậu Kỳ**: @react-three/postprocessing
* **AI Thị Giác**: MediaPipe Tasks Vision (Google)

## 🚀 Bắt Đầu Nhanh

### 1. Chuẩn Bị Môi Trường
Đảm bảo máy tính của bạn đã cài đặt [Node.js](https://nodejs.org/) (khuyến nghị v18 hoặc cao hơn).

### 2. Cài Đặt Phụ Thuộc
Mở terminal trong thư mục gốc của dự án, chạy: ```bash npm install
### 3. Khởi Động Dự Án
npm run dev
### 🖼️ Tùy Chỉnh Ảnh
### 1. Chuẩn Bị Ảnh
Tìm thư mục public/photos/ trong thư mục dự án.

Ảnh lớn trên đỉnh/ảnh bìa: Đặt tên là top.jpg (sẽ hiển thị trên ngôi sao năm cánh lập thể trên đỉnh cây).

Ảnh thân cây: Đặt tên là 1.jpg, 2.jpg, 3.jpg ... và tiếp tục.

Khuyến nghị: Sử dụng ảnh vuông hoặc tỷ lệ 4:3, kích thước file không nên quá lớn (khuyến nghị dưới 500kb mỗi ảnh để đảm bảo mượt mà)
### 2. Thay Thế Ảnh
Chỉ cần sao chép ảnh của bạn vào thư mục public/photos/, ghi đè lên ảnh cũ. Vui lòng giữ nguyên định dạng tên file (1.jpg, 2.jpg, v.v.).
### 3. Sửa Đổi Số Lượng Ảnh (Tăng Hoặc Giảm)
Nếu bạn thêm nhiều ảnh hơn (ví dụ từ 31 ảnh mặc định lên 100 ảnh), cần sửa code để thông báo cho chương trình tải chúng.
Mở file: src/App.tsx
Tìm khoảng dòng 19: // --- Tạo động danh sách ảnh (top.jpg + 1.jpg đến 31.jpg) ---
const TOTAL_NUMBERED_PHOTOS = 31; // <--- Sửa số này!
### 🖐️ Hướng Dẫn Kiểm Soát Cử Chỉ
* **Dự án này tích hợp hệ thống nhận dạng cử chỉ AI, vui lòng đứng trước camera để thao tác (góc phải dưới màn hình có nút DEBUG để xem hình camera)**:
🖐 Mở lòng bàn tay (Open Palm)	Phân tán (Disperse)	Cây thông Noel nổ tung thành hàng nghìn hạt và ảnh bay lượn
✊ Siết chặt nắm đấm (Closed Fist)	Tập hợp (Assemble)	Tất cả các yếu tố tức thì tập hợp thành một cây thông Noel hoàn hảo
👋 Di chuyển lòng bàn tay trái phải	Xoay góc nhìn	Tay sang trái, cây sang trái; tay sang phải, cây sang phải
👋 Di chuyển lòng bàn tay lên xuống	Nghiêng góc nhìn	Tay lên, góc nhìn nâng cao; tay xuống, góc nhìn hạ thấp
### ⚙️ Cấu Hình Nâng Cao
* **Nếu bạn quen với code, có thể điều chỉnh nhiều tham số thị giác hơn trong đối tượng CONFIG trong src/App.tsx**:
  const CONFIG = {
  colors: { ... }, // Sửa màu của cây, đèn, viền
  counts: {
    foliage: 15000,   // Sửa số lượng hạt lá cây (cấu hình thấp có thể lag)
    ornaments: 300,   // Sửa số lượng ảnh treo/Polaroid
    lights: 400       // Sửa số lượng đèn màu
  },
  tree: { height: 22, radius: 9 }, // Sửa kích thước cây
  // ...
};
### 📄 License
Giấy phép MIT. Tự do sử dụng và sửa đổi cho lễ hội của riêng bạn!
### Chúc Giáng Sinh Vui Vẻ! 🎄✨

