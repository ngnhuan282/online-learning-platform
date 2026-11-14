package com.elearning.ai;

import static org.assertj.core.api.Assertions.assertThat;

import com.elearning.ai.provider.AiProviderProperties;
import java.io.IOException;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.context.properties.bind.validation.BindValidationException;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.core.env.SystemEnvironmentPropertySource;
import org.springframework.core.io.ClassPathResource;

class AiProviderPropertiesTests {

    @Test
    void optionalEnvironmentVariablesHaveSafeDefaults() {
        context(Map.of()).run(context -> {
            assertThat(context).hasNotFailed();
            AiProviderProperties properties = context.getBean(AiProviderProperties.class);
            assertThat(properties.getApiKey()).isEmpty();
            assertThat(properties.getModel()).isEmpty();
            assertThat(properties.getRequestTimeoutMs()).isEqualTo(60000);
        });
    }

    @Test
    void bindsComposeEnvironmentVariablesThroughApplicationConfiguration() {
        context(
            Map.of("AI_API_KEY", "test-ai-key", "AI_MODEL", "test-model", "AI_REQUEST_TIMEOUT_MS", "9000")
        ).run(context -> {
            assertThat(context).hasNotFailed();
            AiProviderProperties properties = context.getBean(AiProviderProperties.class);
            assertThat(properties.getApiKey()).isEqualTo("test-ai-key");
            assertThat(properties.getModel()).isEqualTo("test-model");
            assertThat(properties.getRequestTimeoutMs()).isEqualTo(9000);
        });
    }

    @Test
    void acceptsBothTimeoutBounds() {
        for (int timeout : new int[] { 1000, 60000 }) {
            context(Map.of("AI_REQUEST_TIMEOUT_MS", Integer.toString(timeout))).run(context -> {
                assertThat(context).hasNotFailed();
                assertThat(context.getBean(AiProviderProperties.class).getRequestTimeoutMs()).isEqualTo(
                    timeout
                );
            });
        }
    }

    @Test
    void rejectsTimeoutOutsideValidatedRange() {
        for (int timeout : new int[] { 999, 60001 }) {
            context(Map.of("AI_REQUEST_TIMEOUT_MS", Integer.toString(timeout))).run(context -> {
                assertThat(context).hasFailed();
                assertThat(context.getStartupFailure()).hasRootCauseInstanceOf(BindValidationException.class);
            });
        }
    }

    private ApplicationContextRunner context(Map<String, Object> environmentVariables) {
        return new ApplicationContextRunner()
            .withUserConfiguration(PropertiesConfiguration.class)
            .withInitializer(context -> {
                var sources = context.getEnvironment().getPropertySources();
                sources.remove(StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME);
                sources.remove(StandardEnvironment.SYSTEM_PROPERTIES_PROPERTY_SOURCE_NAME);
                sources.addFirst(
                    new SystemEnvironmentPropertySource("testEnvironment", environmentVariables)
                );
                try {
                    for (var source : new YamlPropertySourceLoader().load(
                        "application",
                        new ClassPathResource("application.yml")
                    )) {
                        sources.addLast(source);
                    }
                } catch (IOException exception) {
                    throw new IllegalStateException("Cannot load application configuration", exception);
                }
            });
    }

    @Configuration(proxyBeanMethods = false)
    @EnableConfigurationProperties(AiProviderProperties.class)
    static class PropertiesConfiguration {}
}
