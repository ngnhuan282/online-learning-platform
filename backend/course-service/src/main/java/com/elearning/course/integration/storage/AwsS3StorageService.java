package com.elearning.course.integration.storage;

import com.elearning.course.common.exception.AppException;
import com.elearning.course.common.exception.ErrorCode;
import com.elearning.course.dto.MediaUploadResponse;
import java.io.IOException;
import java.net.URI;
import java.time.Duration;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;

@Service("awsS3StorageService")
public class AwsS3StorageService implements StorageService {

    private final String bucketName;
    private final String region;
    private final String endpointUrl;
    private final String publicEndpointUrl;
    private final boolean pathStyleEnabled;
    private final S3Client s3Client;
    private final S3Presigner s3Presigner;

    public AwsS3StorageService(
            @Value("${integrations.s3.bucket:}") String bucketName,
            @Value("${integrations.s3.region:ap-southeast-1}") String region,
            @Value("${integrations.s3.access-key:}") String accessKey,
            @Value("${integrations.s3.secret-key:}") String secretKey,
            @Value("${integrations.s3.endpoint-url:}") String endpointUrl,
            @Value("${integrations.s3.force-path-style:false}") boolean pathStyleEnabled,
            @Value("${integrations.s3.public-endpoint-url:}") String publicEndpointUrl) {
        this.bucketName = bucketName;
        this.region = region;
        this.endpointUrl = endpointUrl != null ? endpointUrl.trim() : "";
        this.publicEndpointUrl = publicEndpointUrl != null ? publicEndpointUrl.trim() : "";
        this.pathStyleEnabled = this.endpointUrl.isBlank() ? pathStyleEnabled : true;

        Region awsRegion = Region.of(region != null && !region.isBlank() ? region : "ap-southeast-1");
        S3Configuration s3Configuration = S3Configuration.builder()
                .pathStyleAccessEnabled(this.pathStyleEnabled)
                .build();

        AwsBasicCredentials credentials = null;
        if (accessKey != null && !accessKey.isBlank() && secretKey != null && !secretKey.isBlank()) {
            credentials = AwsBasicCredentials.create(accessKey, secretKey);
        }

        var clientBuilder = S3Client.builder()
                .region(awsRegion)
                .serviceConfiguration(s3Configuration);
        var presignerBuilder = S3Presigner.builder()
                .region(awsRegion)
                .serviceConfiguration(s3Configuration);

        if (!this.endpointUrl.isBlank()) {
            clientBuilder.endpointOverride(URI.create(this.endpointUrl));
        }
        String signingEndpoint = this.publicEndpointUrl.isBlank() ? this.endpointUrl : this.publicEndpointUrl;
        if (!signingEndpoint.isBlank()) {
            presignerBuilder.endpointOverride(URI.create(signingEndpoint));
        }

        if (credentials != null) {
            clientBuilder.credentialsProvider(StaticCredentialsProvider.create(credentials));
            presignerBuilder.credentialsProvider(StaticCredentialsProvider.create(credentials));
        } else {
            clientBuilder.credentialsProvider(DefaultCredentialsProvider.create());
            presignerBuilder.credentialsProvider(DefaultCredentialsProvider.create());
        }

        this.s3Client = clientBuilder.build();
        this.s3Presigner = presignerBuilder.build();
    }

    public String getEndpointUrl() {
        return endpointUrl;
    }

    public boolean isPathStyleEnabled() {
        return pathStyleEnabled;
    }

    public String getPublicEndpointUrl() {
        return publicEndpointUrl;
    }

    @Override
    public MediaUploadResponse upload(MultipartFile file, String folder) {
        if (file.isEmpty()) {
            throw new AppException(ErrorCode.BAD_REQUEST, "File tải lên không được rỗng");
        }
        if (bucketName == null || bucketName.isBlank()) {
            throw new AppException(ErrorCode.INTERNAL_ERROR, "Chưa cấu hình AWS S3 bucket name");
        }

        String originalFilename = StringUtils
                .cleanPath(file.getOriginalFilename() != null ? file.getOriginalFilename() : "file");
        String extension = "";
        int dotIndex = originalFilename.lastIndexOf('.');
        if (dotIndex > 0) {
            extension = originalFilename.substring(dotIndex);
        }

        String safeFolder = folder != null && !folder.isBlank() ? folder.replaceAll("[^a-zA-Z0-9_-]", "") : "media";
        String objectKey = safeFolder + "/" + UUID.randomUUID() + extension;

        try {
            PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                    .bucket(bucketName)
                    .key(objectKey)
                    .contentType(file.getContentType())
                    .contentLength(file.getSize())
                    .build();

            s3Client.putObject(putObjectRequest, RequestBody.fromInputStream(file.getInputStream(), file.getSize()));

            String downloadUrl = generatePresignedUrl(objectKey, Duration.ofHours(2));

            return new MediaUploadResponse(
                    objectKey,
                    downloadUrl,
                    originalFilename,
                    file.getSize(),
                    file.getContentType());
        } catch (IOException e) {
            throw new AppException(ErrorCode.INTERNAL_ERROR, "Lỗi khi đọc file để upload lên S3: " + e.getMessage());
        } catch (Exception e) {
            throw new AppException(ErrorCode.INTERNAL_ERROR, "Lỗi khi upload lên AWS S3: " + e.getMessage());
        }
    }

    @Override
    public void delete(String objectKey) {
        if (bucketName == null || bucketName.isBlank()) {
            throw new AppException(ErrorCode.INTERNAL_ERROR, "Chưa cấu hình AWS S3 bucket name");
        }
        if (objectKey == null || objectKey.isBlank()) {
            throw new AppException(ErrorCode.BAD_REQUEST, "S3 object key không được để trống");
        }
        try {
            DeleteObjectRequest deleteObjectRequest = DeleteObjectRequest.builder()
                    .bucket(bucketName)
                    .key(objectKey)
                    .build();
            s3Client.deleteObject(deleteObjectRequest);
        } catch (Exception e) {
            throw new AppException(ErrorCode.INTERNAL_ERROR, "Lỗi khi xóa object khỏi AWS S3");
        }
    }

    @Override
    public String getDownloadUrl(String objectKey) {
        return generatePresignedUrl(objectKey, Duration.ofHours(2));
    }

    @Override
    public String generatePresignedUrl(String objectKey, Duration duration) {
        if (bucketName == null || bucketName.isBlank()) {
            throw new AppException(ErrorCode.INTERNAL_ERROR, "Chưa cấu hình AWS S3 bucket name");
        }
        if (objectKey == null || objectKey.isBlank()) {
            throw new AppException(ErrorCode.BAD_REQUEST, "S3 object key không được để trống");
        }

        GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                .bucket(bucketName)
                .key(objectKey)
                .build();

        GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                .signatureDuration(duration != null ? duration : Duration.ofHours(1))
                .getObjectRequest(getObjectRequest)
                .build();

        return s3Presigner.presignGetObject(presignRequest).url().toString();
    }

    @Override
    public Resource loadAsResource(String objectKey) {
        throw new AppException(ErrorCode.BAD_REQUEST,
                "Tải trực tiếp resource stream từ S3 qua backend không được hỗ trợ, hãy dùng Presigned URL");
    }
}
