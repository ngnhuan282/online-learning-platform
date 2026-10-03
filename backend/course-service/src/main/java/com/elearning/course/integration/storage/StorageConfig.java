package com.elearning.course.integration.storage;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

@Configuration
public class StorageConfig {

    @Bean
    @Primary
    public StorageService storageService(
        @Value("${storage.type:local}") String storageType,
        @Value("${integrations.s3.bucket:}") String bucketName,
        LocalStorageService localStorageService,
        AwsS3StorageService awsS3StorageService
    ) {
        if ("s3".equalsIgnoreCase(storageType)) {
            if (bucketName == null || bucketName.isBlank()) {
                throw new IllegalStateException("STORAGE_TYPE=s3 requires AWS_S3_BUCKET to be configured");
            }
            return awsS3StorageService;
        }
        if ("local".equalsIgnoreCase(storageType)) {
            return localStorageService;
        }
        throw new IllegalStateException("Unsupported STORAGE_TYPE: " + storageType + ". Supported values are local and s3.");
    }
}
