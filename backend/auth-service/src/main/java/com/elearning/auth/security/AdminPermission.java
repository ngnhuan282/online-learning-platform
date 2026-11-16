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
    PAYMENT_REPORT_VIEW("Thanh toán", "Doanh thu", "VIEW", "Xem thống kê thanh toán", false),
    SHOP_VIEW("Cửa hàng & thành viên", "Vật phẩm", "VIEW", "Xem vật phẩm và giao dịch gem", false),
    SHOP_CREATE("Cửa hàng & thành viên", "Vật phẩm", "CREATE", "Thêm vật phẩm", false),
    SHOP_UPDATE("Cửa hàng & thành viên", "Vật phẩm", "UPDATE", "Sửa / ẩn vật phẩm", false),
    INVENTORY_VIEW("Cửa hàng & thành viên", "Kho đồ học viên", "VIEW", "Xem kho đồ học viên", false),
    INVENTORY_MANAGE("Cửa hàng & thành viên", "Kho đồ học viên", "UPDATE", "Cấp / thu hồi vật phẩm", false),
    ENGAGEMENT_VIEW("Học tập", "Gem, XP & chuỗi học", "VIEW", "Xem tài khoản học tập", false),
    GEM_ADJUST("Học tập", "Gem, XP & chuỗi học", "SPECIAL", "Điều chỉnh gem", false),
    XP_ADJUST("Học tập", "Gem, XP & chuỗi học", "SPECIAL", "Điều chỉnh XP / cấp độ", false),
    STREAK_ADJUST("Học tập", "Gem, XP & chuỗi học", "SPECIAL", "Khôi phục chuỗi / điều chỉnh freeze", false),
    ENGAGEMENT_CONFIG_VIEW("Học tập", "Quy tắc & phần thưởng", "VIEW", "Xem quy tắc học tập", false),
    ENGAGEMENT_CONFIG_UPDATE(
        "Học tập",
        "Quy tắc & phần thưởng",
        "UPDATE",
        "Cấu hình XP, cấp độ và phần thưởng",
        false
    ),
    PRO_PLAN_VIEW("Cửa hàng & thành viên", "Gói Pro", "VIEW", "Xem danh mục gói Pro", false),
    PRO_PLAN_UPDATE("Cửa hàng & thành viên", "Gói Pro", "UPDATE", "Sửa giá / mở bán gói Pro", false),
    PRO_MEMBER_VIEW(
        "Cửa hàng & thành viên",
        "Thành viên Pro",
        "VIEW",
        "Xem thành viên và lịch sử cấp Pro",
        false
    ),
    PRO_MEMBER_MANAGE(
        "Cửa hàng & thành viên",
        "Thành viên Pro",
        "SPECIAL",
        "Cấp / tạm khóa / thu hồi Pro quản trị",
        false
    ),
    PRO_CODE_VIEW("Cửa hàng & thành viên", "Mã Pro", "VIEW", "Xem mã Pro đã che", false),
    PRO_CODE_CREATE("Cửa hàng & thành viên", "Mã Pro", "CREATE", "Phát hành mã Pro", false),
    PRO_CODE_REVOKE("Cửa hàng & thành viên", "Mã Pro", "DELETE", "Thu hồi mã Pro chưa dùng", false),
    COMMUNITY_VIEW("Học tập", "Diễn đàn", "VIEW", "Xem hàng đợi kiểm duyệt", false),
    COMMUNITY_MODERATE("Học tập", "Diễn đàn", "SPECIAL", "Khóa, ẩn / khôi phục bài và bình luận", false),
    QUIZ_VIEW("Học tập", "Quiz", "VIEW", "Xem quản trị quiz", false),
    QUIZ_MANAGE("Học tập", "Quiz", "SPECIAL", "Quản lý quiz", false),
    NOTIFICATION_VIEW("Học tập", "Thông báo", "VIEW", "Xem quản trị thông báo", false),
    NOTIFICATION_MANAGE("Học tập", "Thông báo", "SPECIAL", "Quản lý thông báo", false);

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
        if (this == INVENTORY_VIEW) return List.of("ADMIN_ACCESS", "ENGAGEMENT_VIEW");
        if (this == INVENTORY_MANAGE) return List.of(
            "ADMIN_ACCESS",
            "ENGAGEMENT_VIEW",
            "INVENTORY_VIEW",
            "SHOP_VIEW"
        );
        String view = switch (this) {
            case SHOP_CREATE, SHOP_UPDATE -> "SHOP_VIEW";
            case GEM_ADJUST, XP_ADJUST, STREAK_ADJUST -> "ENGAGEMENT_VIEW";
            case ENGAGEMENT_CONFIG_UPDATE -> "ENGAGEMENT_CONFIG_VIEW";
            case PRO_PLAN_UPDATE -> "PRO_PLAN_VIEW";
            case PRO_MEMBER_MANAGE -> "PRO_MEMBER_VIEW";
            case PRO_CODE_CREATE, PRO_CODE_REVOKE -> "PRO_CODE_VIEW";
            case COMMUNITY_MODERATE -> "COMMUNITY_VIEW";
            case QUIZ_MANAGE -> "QUIZ_VIEW";
            case NOTIFICATION_MANAGE -> "NOTIFICATION_VIEW";
            default -> null;
        };
        if (view != null) return List.of("ADMIN_ACCESS", view);
        return List.of("ADMIN_ACCESS");
    }

    public static Set<String> allCodes() {
        return java.util.Arrays.stream(values()).map(Enum::name).collect(Collectors.toSet());
    }
}
