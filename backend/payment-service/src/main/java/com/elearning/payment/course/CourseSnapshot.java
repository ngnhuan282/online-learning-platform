package com.elearning.payment.course;

import java.math.BigDecimal;

public record CourseSnapshot(
    Long id,
    String title,
    BigDecimal price,
    String currency,
    BigDecimal originalPrice
) {
    public CourseSnapshot {
        originalPrice = originalPrice == null || originalPrice.compareTo(price) < 0 ? price : originalPrice;
    }

    public CourseSnapshot(Long id, String title, BigDecimal price, String currency) {
        this(id, title, price, currency, price);
    }

    public BigDecimal discountAmount() {
        return originalPrice.subtract(price);
    }
}
