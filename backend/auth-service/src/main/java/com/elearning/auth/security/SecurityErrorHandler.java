package com.elearning.auth.security;

import com.elearning.auth.common.exception.ErrorCode;
import com.elearning.auth.common.response.ApiError;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

@Component
public class SecurityErrorHandler {

    private final JsonMapper mapper;

    public SecurityErrorHandler(JsonMapper mapper) {
        this.mapper = mapper;
    }

    public void write(HttpServletRequest request, HttpServletResponse response, ErrorCode code)
        throws IOException {
        LoggerFactory.getLogger(getClass()).warn("Security request rejected code={}", code);
        response.setStatus(code.status().value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        response
            .getWriter()
            .write(mapper.writeValueAsString(ApiError.of(code, null, request.getRequestURI())));
    }
}
