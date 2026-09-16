package com.elearning.learning.common.response;

import com.elearning.learning.common.exception.ErrorCode;
import java.time.Instant;
import java.util.List;
import java.util.Map;

public record ApiError(
    boolean success,
    String code,
    String message,
    Map<String, List<String>> errors,
    Instant timestamp,
    String path
) {
    public static ApiError of(ErrorCode code, Map<String, List<String>> errors, String path) {
        return new ApiError(false, code.name(), code.message(), errors, Instant.now(), path);
    }
}
