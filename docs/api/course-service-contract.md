# Course Service – API Contract (Tuần 7 Freeze)

> **Dịch vụ:** `course-service`  
> **Phiên bản:** 1.0 (Freeze Tuần 7)  
> **Base URL:** `http://localhost:8082/api/v1` (trực tiếp) hoặc thông qua API Gateway `http://localhost:8080/api/v1`  
> **Người phụ trách:** TV2 (Tùng)

---

## 1. Cơ chế Xác thực & Phân quyền (Authentication & Authorization)

Course Service hoạt động phía sau API Gateway hoặc giải mã trực tiếp JWT Bearer Token:
- **Header:** `Authorization: Bearer <jwt-token>`
- **JWT Claims:**
  - `sub`: `userId` (Long, bắt buộc đối với các API yêu cầu đăng nhập)
  - `roles`: Danh sách quyền hoặc role (ví dụ: `ROLE_ADMIN`, `ROLE_INSTRUCTOR`, `ROLE_STUDENT`)

### Mã lỗi chuẩn (Standard Error Response)
Mọi lỗi trả về theo định dạng `ApiResponse<T>`:
```json
{
  "code": 40401,
  "message": "Không tìm thấy khóa học",
  "result": null
}
```
HTTP status code phản ánh đúng lỗi (400, 401, 403, 404, 500).

---

## 2. API Công khai (Public Endpoints - Guest & Students)

### 2.1. Tìm kiếm và Danh sách khóa học
- **Endpoint:** `GET /api/v1/courses`
- **Mô tả:** Danh sách khóa học đã xuất bản (`PUBLISHED`), hỗ trợ tìm kiếm, lọc theo category, sắp xếp và phân trang.
- **Query Parameters:**
  - `keyword` (String, optional): Tìm kiếm theo tiêu đề
  - `categoryId` (Long, optional): Lọc theo danh mục
  - `page` (Integer, default 0): Số trang (0-based)
  - `size` (Integer, default 10): Số bản ghi trên trang
  - `sortBy` (String, default `createdAt`): Trường sắp xếp (`createdAt`, `price`, `avgRating`)
  - `direction` (String, default `desc`): `asc` hoặc `desc`
- **Response:** `200 OK`
```json
{
  "code": 200,
  "message": "Success",
  "result": {
    "content": [
      {
        "id": 1,
        "title": "Lập trình Java Spring Boot chuyên sâu",
        "headline": "Xây dựng microservices từ cơ bản tới nâng cao",
        "description": "...",
        "price": 499000.0,
        "thumbnailUrl": "/api/v1/media/download/thumbnails/java-spring.jpg",
        "status": "PUBLISHED",
        "categoryId": 2,
        "categoryName": "Backend Development",
        "avgRating": 4.8,
        "reviewCount": 15,
        "createdAt": "2026-10-01T10:00:00Z"
      }
    ],
    "page": 0,
    "size": 10,
    "totalElements": 42,
    "totalPages": 5
  }
}
```

### 2.2. Chi tiết khóa học (Catalog View)
- **Endpoint:** `GET /api/v1/courses/{id}`
- **Ghi chú quan trọng cho TV4 (Payment):** Payment Service gọi endpoint này để xác thực tồn tại và lấy `price` chính xác của khóa học khi tạo đơn hàng.
- **Response:** `200 OK`
```json
{
  "code": 200,
  "message": "Success",
  "result": {
    "id": 1,
    "title": "Lập trình Java Spring Boot chuyên sâu",
    "headline": "Xây dựng microservices từ cơ bản tới nâng cao",
    "description": "Khóa học đầy đủ...",
    "price": 499000.0,
    "thumbnailUrl": "/api/v1/media/download/thumbnails/java-spring.jpg",
    "status": "PUBLISHED",
    "categoryId": 2,
    "categoryName": "Backend Development",
    "avgRating": 4.8,
    "reviewCount": 15,
    "createdAt": "2026-10-01T10:00:00Z"
  }
}
```

### 2.3. Danh sách Sections & Lessons (Curriculum Outline)
- **Endpoint:** `GET /api/v1/courses/{courseId}/sections`
- **Ghi chú quan trọng cho TV3 (Learning):** Learning Service hoặc FE Player gọi endpoint này để render danh sách chương mục và bài học.
- **Response:** `200 OK` (Đã tối ưu JOIN FETCH không bị N+1)
```json
{
  "code": 200,
  "message": "Success",
  "result": [
    {
      "id": 10,
      "title": "Chương 1: Giới thiệu Spring Boot",
      "orderIndex": 0,
      "lessons": [
        {
          "id": 101,
          "title": "Bài 1: Cài đặt môi trường JDK 21",
          "orderIndex": 0,
          "lessonType": "VIDEO",
          "duration": 600,
          "videoUrl": "/api/v1/media/download/videos/intro.mp4",
          "isPreview": true
        },
        {
          "id": 102,
          "title": "Bài 2: Kiến trúc MVC",
          "orderIndex": 1,
          "lessonType": "DOCUMENT",
          "duration": 300,
          "videoUrl": null,
          "isPreview": false
        }
      ]
    }
  ]
}
```

### 2.4. Đánh giá khóa học (Reviews)
- **Endpoint:** `GET /api/v1/courses/{courseId}/reviews`
- **Mô tả:** Danh sách đánh giá công khai (chỉ trả về reviews không bị ẩn `isHidden = false`).
- **Query Parameters:**
  - `page` (Integer, default 0)
  - `size` (Integer, default 5)
- **Response:** `200 OK`
```json
{
  "code": 200,
  "message": "Success",
  "result": {
    "content": [
      {
        "id": 201,
        "courseId": 1,
        "userId": 5,
        "rating": 5,
        "comment": "Khóa học rất chi tiết và dễ hiểu!",
        "isHidden": false,
        "createdAt": "2026-10-05T14:30:00Z",
        "updatedAt": null
      }
    ],
    "page": 0,
    "size": 5,
    "totalElements": 1,
    "totalPages": 1
  }
}
```

---

## 3. API Đánh giá khóa học (User Authenticated)

Yêu cầu Header: `Authorization: Bearer <token>` (`sub` = userId).

### 3.1. Tạo đánh giá
- **Endpoint:** `POST /api/v1/courses/{courseId}/reviews`
- **Body:**
```json
{
  "rating": 5,
  "comment": "Bài giảng rất hay và thực tế!"
}
```
- **Validation:**
  - `rating`: Bắt buộc, số nguyên từ 1 đến 5.
  - `comment`: Tối đa 2000 ký tự.
  - Một user chỉ được đánh giá 1 lần cho 1 khóa học.
- **Response:** `200 OK` (Trả về `ReviewResponse`).

### 3.2. Cập nhật đánh giá của mình
- **Endpoint:** `PUT /api/v1/courses/{courseId}/reviews/{reviewId}`
- **Body:**
```json
{
  "rating": 4,
  "comment": "Cập nhật lại nhận xét sau khi hoàn thành khóa học."
}
```

### 3.3. Xóa đánh giá của mình
- **Endpoint:** `DELETE /api/v1/courses/{courseId}/reviews/{reviewId}`
- **Response:** `200 OK` (Xóa thành công, tự động cập nhật lại `avgRating` và `reviewCount`).

---

## 4. API Quản lý Admin/Instructor (Admin Authenticated)

Yêu cầu Header: `Authorization: Bearer <token>` có quyền `ROLE_ADMIN` hoặc `ROLE_INSTRUCTOR`.

### 4.1. Khóa học (Course CRUD & Status)
- `POST /api/v1/admin/courses`: Tạo khóa học mới.
- `PUT /api/v1/admin/courses/{id}`: Cập nhật thông tin khóa học.
- `DELETE /api/v1/admin/courses/{id}`: Xóa khóa học.
- `PATCH /api/v1/admin/courses/{id}/status`: Cập nhật trạng thái (`DRAFT`, `PUBLISHED`, `ARCHIVED`).

### 4.2. Chương mục & Bài học (Curriculum)
- `POST /api/v1/admin/courses/{courseId}/sections`: Thêm Section.
- `PUT /api/v1/admin/courses/{courseId}/sections/{sectionId}`: Sửa Section.
- `DELETE /api/v1/admin/courses/{courseId}/sections/{sectionId}`: Xóa Section.
- `PUT /api/v1/admin/courses/{courseId}/sections/reorder`: Sắp xếp thứ tự Section.
- `POST /api/v1/admin/courses/{courseId}/sections/{sectionId}/lessons`: Thêm Lesson.
- `PUT /api/v1/admin/courses/{courseId}/sections/{sectionId}/lessons/{lessonId}`: Sửa Lesson.
- `DELETE /api/v1/admin/courses/{courseId}/sections/{sectionId}/lessons/{lessonId}`: Xóa Lesson.
- `PUT /api/v1/admin/courses/{courseId}/sections/{sectionId}/lessons/reorder`: Sắp xếp thứ tự Lesson.

### 4.3. Quản lý Review vi phạm (Admin Moderation)
- `PUT /api/v1/admin/courses/{courseId}/reviews/{reviewId}/hide`: Ẩn review khỏi public view.
- `PUT /api/v1/admin/courses/{courseId}/reviews/{reviewId}/show`: Bỏ ẩn review.

---

## 5. Media & File Storage
- `POST /api/v1/media/upload`: Upload file (multipart/form-data: `file`, `type` [thumbnail, video, document]).
- `GET /api/v1/media/download/{folder}/{filename}`: Tải file hoặc stream video / ảnh từ local fallback hoặc chuyển hướng S3 presigned URL.

---

## 6. Checklist Tích hợp Tuần 8 & 9 (Integration Readiness)
1. **TV3 (Learning Service):**
   - Xác thực người học đã enroll trước khi xem video bài học không phải preview.
   - Gọi `GET /api/v1/courses/{courseId}/sections` để render navigation bài học.
2. **TV4 (Payment Service):**
   - Gọi `GET /api/v1/courses/{courseId}` để lấy giá chuẩn và trạng thái `PUBLISHED` trước khi tạo Payment Order.
