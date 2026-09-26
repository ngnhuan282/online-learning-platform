package com.elearning.payment.course;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Component;

// D6 will replace this local catalog with Course Service price verification.
@Component
public class CourseSnapshotProvider {

    private final Map<Long, CourseSnapshot> courses = Map.of(
        101L,
        new CourseSnapshot(
            101L,
            "IELTS Intensive 7.5+: But pha 4 ky nang cung chuyen gia",
            BigDecimal.valueOf(1_690_000),
            "VND"
        ),
        102L,
        new CourseSnapshot(
            102L,
            "Tieng Anh chuyen nganh IT & Phong van cong ty quoc te",
            BigDecimal.valueOf(1_290_000),
            "VND"
        ),
        103L,
        new CourseSnapshot(
            103L,
            "TOEIC 850+ Cap toc: Chien thuat giai de & tang diem",
            BigDecimal.valueOf(1_090_000),
            "VND"
        )
    );

    public Optional<CourseSnapshot> findById(Long courseId) {
        return Optional.ofNullable(courses.get(courseId));
    }
}
