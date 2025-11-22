package com.lootchat.LootChat.config;

import io.minio.MinioClient;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Slf4j
@Configuration
public class MinioConfig {

    @Value("${minio.endpoint}")
    private String endpoint;

    @Value("${minio.access-key}")
    private String accessKey;

    @Value("${minio.secret-key}")
    private String secretKey;

    @Bean
    public MinioClient minioClient() {
        if (endpoint == null || endpoint.isEmpty()) {
            throw new IllegalStateException("MinIO endpoint is not configured. Set minio.endpoint property.");
        }
        if (accessKey == null || accessKey.isEmpty()) {
            throw new IllegalStateException("MinIO access key is not configured. Set minio.access-key property.");
        }
        if (secretKey == null || secretKey.isEmpty()) {
            throw new IllegalStateException("MinIO secret key is not configured. Set minio.secret-key property.");
        }

        log.info("Initializing MinIO client with endpoint: {}", endpoint);

        try {
            return MinioClient.builder()
                    .endpoint(endpoint)
                    .credentials(accessKey, secretKey)
                    .build();
        } catch (Exception e) {
            log.error("Failed to initialize MinIO client", e);
            throw new IllegalStateException("Could not create MinIO client", e);
        }
    }
}
