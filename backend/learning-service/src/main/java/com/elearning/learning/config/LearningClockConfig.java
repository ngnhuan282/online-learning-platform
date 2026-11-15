package com.elearning.learning.config;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class LearningClockConfig {

    @Bean
    Clock learningClock() {
        return Clock.systemUTC();
    }
}
