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
import org.springframework.context.annotation.Profile;
import org.springframework.core.io.ClassPathResource;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

@Configuration
@Profile("!test")
public class ToeicSeedConfig {

    private static final Logger log = LoggerFactory.getLogger(ToeicSeedConfig.class);

    @Bean
    @ConditionalOnProperty(name = "toeic.seed.enabled", havingValue = "true", matchIfMissing = true)
    ApplicationRunner seedToeicCollections(ToeicService toeic, JsonMapper mapper) {
        return arguments -> {
            for (String collection : List.of("ets2024-reading", "ets2024-listening")) {
                var resource = new ClassPathResource("toeic/" + collection + ".json");
                if (!resource.exists()) continue;
                try (var input = resource.getInputStream()) {
                    List<Definition> definitions = mapper.readValue(
                        input,
                        new TypeReference<List<Definition>>() {}
                    );
                    for (Definition definition : definitions) toeic.seed(definition);
                    log.info(
                        "TOEIC source collection {} reconciled definitions={}",
                        collection,
                        definitions.size()
                    );
                }
            }
        };
    }
}
