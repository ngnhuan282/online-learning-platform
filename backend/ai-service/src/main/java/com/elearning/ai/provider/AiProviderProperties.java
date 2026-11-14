package com.elearning.ai.provider;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.validation.annotation.Validated;

@Component
@ConfigurationProperties(prefix = "integrations.ai")
@Validated
@Getter
@Setter
public class AiProviderProperties {

    private String apiKey = "";
    private String model = "";

    @Min(1000)
    @Max(60000)
    private int requestTimeoutMs = 60000;

    @Min(1)
    @Max(10000)
    private int dailyRequestLimit = 100;

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank() && model != null && model.matches("[a-zA-Z0-9._-]{1,100}");
    }
}
