package com.elearning.learning.service;

import java.net.URI;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;

@Configuration(proxyBeanMethods = false)
@ConditionalOnProperty(name = "dictation.s3.enabled", havingValue = "true")
class DictationS3Configuration {

    @Bean(destroyMethod = "close")
    S3Client dictationS3Client(
        @Value("${dictation.s3.region}") String region,
        @Value("${dictation.s3.endpoint}") String endpoint,
        @Value("${dictation.s3.force-path-style}") boolean forcePathStyle
    ) {
        var builder = S3Client.builder()
            .region(Region.of(region))
            .serviceConfiguration(
                S3Configuration.builder()
                    .pathStyleAccessEnabled(forcePathStyle || !endpoint.isBlank())
                    .chunkedEncodingEnabled(false)
                    .build()
            )
            .overrideConfiguration(config -> config
                .apiCallTimeout(Duration.ofSeconds(15))
                .apiCallAttemptTimeout(Duration.ofSeconds(8))
            );
        if (!endpoint.isBlank()) {
            builder.endpointOverride(URI.create(endpoint));
        }
        return builder.build();
    }

    @Bean
    DictationS3WorkbookImporter dictationS3WorkbookImporter(
        DictationWorkbookImporter workbooks,
        S3Client dictationS3Client,
        @Value("${dictation.s3.bucket}") String bucket,
        @Value("${dictation.s3.prefix}") String prefix
    ) {
        return new DictationS3WorkbookImporter(workbooks, dictationS3Client, bucket, prefix);
    }
}
