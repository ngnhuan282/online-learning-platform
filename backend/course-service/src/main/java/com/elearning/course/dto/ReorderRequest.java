package com.elearning.course.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.util.List;

/**
 * Dùng để cập nhật thứ tự (orderIndex) hàng loạt cho Section hoặc Lesson.
 * Body: [{"id": 3, "orderIndex": 0}, {"id": 1, "orderIndex": 1}]
 */
public record ReorderRequest(
    @NotNull(message = "Items list is required")
    List<Item> items
) {
    public record Item(
        @NotNull(message = "Item id is required")
        Long id,

        @Min(value = 0, message = "Order index must be >= 0")
        int orderIndex
    ) {}
}
