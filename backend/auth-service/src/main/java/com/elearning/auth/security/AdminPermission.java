package com.elearning.auth.security;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/** Only permissions backed by implemented API operations belong in this catalog. */
public enum AdminPermission {
    USER_DELETE("Người dùng & tài khoản", "Tài khoản", "DELETE", "Xóa mềm tài khoản", true),
    ADMIN_ACCESS("Hệ thống", "Không gian quản trị", "VIEW", "Truy cập quản trị", false),
    DASHBOARD_VIEW("Hệ thống", "Tổng quan tài khoản", "VIEW", "Xem tổng quan", false),
    USER_VIEW("Người dùng & tài khoản", "Tài khoản", "VIEW", "Xem tài khoản", false),
    USER_CREATE("Người dùng & tài khoản", "Tài khoản", "CREATE", "Thêm tài khoản", false),
    USER_UPDATE("Người dùng & tài khoản", "Tài khoản", "UPDATE", "Sửa họ tên", false),
    USER_STATUS_UPDATE("Người dùng & tài khoản", "Tài khoản", "SPECIAL", "Khóa / mở khóa", false),
    USER_ROLES_ASSIGN("Người dùng & tài khoản", "Tài khoản", "SPECIAL", "Gán vai trò", true),
    ROLE_VIEW("Người dùng & tài khoản", "Vai trò", "VIEW", "Xem vai trò", false),
    ROLE_MANAGE("Người dùng & tài khoản", "Vai trò", "SPECIAL", "Quản lý vai trò", true),
    AUDIT_VIEW("Hệ thống", "Nhật ký quản trị", "VIEW", "Xem nhật ký", false),
    COURSE_VIEW("Khóa học & danh mục", "Khóa học", "VIEW", "Xem thống kê khóa học", false),
    COURSE_CREATE("Khóa học & danh mục", "Khóa học", "CREATE", "Tạo khóa học", false),
    COURSE_UPDATE("Khóa học & danh mục", "Khóa học", "UPDATE", "Sửa khóa học", false),
    COURSE_DELETE("Khóa học & danh mục", "Khóa học", "DELETE", "Xóa khóa học", false),
    CATEGORY_VIEW("Khóa học & danh mục", "Danh mục", "VIEW", "Xem danh mục", false),
    CATEGORY_CREATE("Khóa học & danh mục", "Danh mục", "CREATE", "Tạo danh mục", false),
    CATEGORY_UPDATE("Khóa học & danh mục", "Danh mục", "UPDATE", "Sửa danh mục", false),
    CATEGORY_DELETE("Khóa học & danh mục", "Danh mục", "DELETE", "Xóa danh mục", false),
    LEARNING_REPORT_VIEW("Học tập", "Kết quả học tập", "VIEW", "Xem thống kê học tập", false),
    PAYMENT_REPORT_VIEW("Thanh toán", "Doanh thu", "VIEW", "Xem thống kê thanh toán", false);

    public final String group;
    public final String resource;
    public final String action;
    public final String label;
    public final boolean adminOnly;

    AdminPermission(String group, String resource, String action, String label, boolean adminOnly) {
        this.group = group;
        this.resource = resource;
        this.action = action;
        this.label = label;
        this.adminOnly = adminOnly;
    }

    public List<String> dependencies() {
        if (this == ADMIN_ACCESS) return List.of();
        if (name().startsWith("USER_") && this != USER_VIEW) return List.of("ADMIN_ACCESS", "USER_VIEW");
        if (name().startsWith("COURSE_") && this != COURSE_VIEW) return List.of(
            "ADMIN_ACCESS",
            "COURSE_VIEW"
        );
        if (name().startsWith("CATEGORY_") && this != CATEGORY_VIEW) return List.of(
            "ADMIN_ACCESS",
            "CATEGORY_VIEW"
        );
        if (this == ROLE_MANAGE) return List.of("ADMIN_ACCESS", "ROLE_VIEW");
        return List.of("ADMIN_ACCESS");
    }

    public static Set<String> allCodes() {
        return java.util.Arrays.stream(values()).map(Enum::name).collect(Collectors.toSet());
    }
}
