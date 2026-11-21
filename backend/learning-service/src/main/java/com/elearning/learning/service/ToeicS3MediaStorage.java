package com.elearning.learning.service;

import com.elearning.learning.common.exception.AppException;
import com.elearning.learning.common.exception.ErrorCode;
import jakarta.annotation.PreDestroy;
import java.net.URI;
import java.nio.file.Path;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.core.exception.SdkException;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

@Component
public class ToeicS3MediaStorage {

    private static final String PREFIX = "documents/toeic/uploads/";
    private final String bucket;
    private final S3Client client;
    private final S3Presigner presigner;

    public ToeicS3MediaStorage(
        @Value("${toeic.media.s3-bucket:}") String bucket,
        @Value("${toeic.media.s3-region:ap-southeast-1}") String region
    ) {
        this.bucket = bucket.trim();
        this.client = enabled()
            ? S3Client.builder()
                  .region(Region.of(region))
                  .overrideConfiguration(config ->
                      config
                          .apiCallTimeout(Duration.ofSeconds(30))
                          .apiCallAttemptTimeout(Duration.ofSeconds(12))
                  )
                  .build()
            : null;
        this.presigner = enabled() ? S3Presigner.builder().region(Region.of(region)).build() : null;
    }

    public boolean enabled() {
        return !bucket.isEmpty();
    }

    public void put(String key, Path file, String contentType) {
        try {
            client.putObject(
                request ->
                    request
                        .bucket(bucket)
                        .key(PREFIX + key)
                        .contentType(contentType),
                RequestBody.fromFile(file)
            );
        } catch (SdkException ex) {
            throw new AppException(ErrorCode.TOEIC_MEDIA_STORAGE_UNAVAILABLE, ex);
        }
    }

    public long size(String key) {
        try {
            return client.headObject(request -> request.bucket(bucket).key(PREFIX + key)).contentLength();
        } catch (S3Exception ex) {
            throw new AppException(
                ex.statusCode() == 404 ? ErrorCode.NOT_FOUND : ErrorCode.TOEIC_MEDIA_STORAGE_UNAVAILABLE,
                ex
            );
        } catch (SdkException ex) {
            throw new AppException(ErrorCode.TOEIC_MEDIA_STORAGE_UNAVAILABLE, ex);
        }
    }

    public URI preview(String key) {
        try {
            var get = GetObjectRequest.builder()
                .bucket(bucket)
                .key(PREFIX + key)
                .build();
            return URI.create(
                presigner
                    .presignGetObject(request ->
                        request.signatureDuration(Duration.ofMinutes(20)).getObjectRequest(get)
                    )
                    .url()
                    .toString()
            );
        } catch (SdkException ex) {
            throw new AppException(ErrorCode.TOEIC_MEDIA_STORAGE_UNAVAILABLE, ex);
        }
    }

    public void delete(String key) {
        try {
            client.deleteObject(request -> request.bucket(bucket).key(PREFIX + key));
        } catch (SdkException ex) {
            throw new AppException(ErrorCode.TOEIC_MEDIA_STORAGE_UNAVAILABLE, ex);
        }
    }

    @PreDestroy
    void close() {
        if (enabled()) {
            presigner.close();
            client.close();
        }
    }
}
