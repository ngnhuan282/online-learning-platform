package com.elearning.payment.course;

import java.math.BigDecimal;

public record CourseSnapshot(Long id, String title, BigDecimal price, String currency) {}
