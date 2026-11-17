package com.elearning.learning.config;

import com.elearning.learning.dto.ToeicModels.Definition;
import com.elearning.learning.service.ToeicService;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

@Configuration
public class ToeicSeedConfig {

    private static final Logger log = LoggerFactory.getLogger(ToeicSeedConfig.class);

    @Bean
    @ConditionalOnProperty(name = "toeic.seed.enabled", havingValue = "true", matchIfMissing = true)
    ApplicationRunner seedToeicReading(ToeicService toeic, JsonMapper mapper) {
        return arguments -> {
            var resource = new ClassPathResource("toeic/ets2024-reading.json");
            if (!resource.exists()) {
                log.info("TOEIC content seed is not packaged; administrators can create content manually");
                return;
            }
            try (var input = resource.getInputStream()) {
                List<Definition> definitions = mapper.readValue(
                    input,
                    new TypeReference<List<Definition>>() {}
                );
                for (Definition definition : definitions) toeic.seed(definition);
                log.info("TOEIC source collection reconciled definitions={}", definitions.size());
            }
        };
    }
}
