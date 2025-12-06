package com.lootchat.LootChat.service.soundboard;

import com.lootchat.LootChat.dto.soundboard.SoundboardSoundDTO;
import com.lootchat.LootChat.entity.SoundboardSound;
import com.lootchat.LootChat.entity.User;
import com.lootchat.LootChat.repository.SoundboardSoundRepository;
import com.lootchat.LootChat.repository.UserRepository;
import io.minio.*;
import io.minio.http.Method;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class SoundboardService {

    private final SoundboardSoundRepository soundboardRepository;
    private final UserRepository userRepository;
    private final MinioClient minioClient;

    @Value("${minio.bucket-name}")
    private String bucketName;

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(
            ".mp3", ".wav", ".ogg", ".m4a", ".aac"
    );

    private static final Set<String> ALLOWED_MIME_TYPES = Set.of(
            "audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg",
            "audio/x-m4a", "audio/mp4", "audio/aac"
    );

    private static final long MAX_FILE_SIZE = 10 * 1024 * 1024;

    private static final int MAX_DURATION_MS = 300000;

    @Transactional
    public SoundboardSoundDTO uploadSound(String name, Integer durationMs, MultipartFile file, String username) {
        User user = userRepository.findByUsername(username);
        if (user == null) {
            throw new IllegalArgumentException("User not found");
        }

        validateAudioFile(file, durationMs);

        String fileName = uploadAudioFile(file);

        SoundboardSound sound = SoundboardSound.builder()
                .name(name)
                .fileUrl(fileName)
                .fileName(file.getOriginalFilename())
                .durationMs(durationMs)
                .fileSize(file.getSize())
                .user(user)
                .build();

        sound = soundboardRepository.save(sound);

        log.info("Uploaded soundboard sound: {} by user: {}", name, username);

        return toDTO(sound);
    }

    @Transactional(readOnly = true)
    public List<SoundboardSoundDTO> getAllSounds() {
        return soundboardRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Transactional
    public void deleteSound(Long soundId, String username) {
        User user = userRepository.findByUsername(username);
        if (user == null) {
            throw new IllegalArgumentException("User not found");
        }

        SoundboardSound sound = soundboardRepository.findByIdAndUserId(soundId, user.getId())
                .orElseThrow(() -> new IllegalArgumentException("Sound not found or not owned by user"));

        try {
            minioClient.removeObject(
                    RemoveObjectArgs.builder()
                            .bucket(bucketName)
                            .object(sound.getFileUrl())
                            .build()
            );
        } catch (Exception e) {
            log.error("Failed to delete sound file from MinIO: {}", sound.getFileUrl(), e);
        }

        soundboardRepository.delete(sound);
        log.info("Deleted soundboard sound: {} by user: {}", soundId, username);
    }

    public String getPresignedUrl(String fileName) {
        try {
            return minioClient.getPresignedObjectUrl(
                    GetPresignedObjectUrlArgs.builder()
                            .method(Method.GET)
                            .bucket(bucketName)
                            .object(fileName)
                            .expiry(55, TimeUnit.MINUTES)
                            .build()
            );
        } catch (Exception e) {
            log.error("Failed to generate presigned URL for: {}", fileName, e);
            throw new RuntimeException("Failed to generate download URL", e);
        }
    }

    private void validateAudioFile(MultipartFile file, Integer durationMs) {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("Cannot upload empty file");
        }

        if (file.getSize() > MAX_FILE_SIZE) {
            throw new IllegalArgumentException(
                    String.format("File size exceeds maximum allowed: %d bytes", MAX_FILE_SIZE)
            );
        }

        if (durationMs > MAX_DURATION_MS) {
            throw new IllegalArgumentException(
                    String.format("Audio duration exceeds maximum allowed: %d ms", MAX_DURATION_MS)
            );
        }

        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null) {
            throw new IllegalArgumentException("Invalid filename");
        }

        String extension = originalFilename.substring(originalFilename.lastIndexOf('.')).toLowerCase();
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw new IllegalArgumentException("Invalid file type. Allowed: " + ALLOWED_EXTENSIONS);
        }

        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_MIME_TYPES.contains(contentType.toLowerCase())) {
            throw new IllegalArgumentException("Invalid MIME type. Allowed: " + ALLOWED_MIME_TYPES);
        }
    }

    private String uploadAudioFile(MultipartFile file) {
        try {
            String originalFilename = file.getOriginalFilename();
            String extension = originalFilename.substring(originalFilename.lastIndexOf('.'));
            String fileName = "sounds/" + UUID.randomUUID() + extension;

            try (InputStream inputStream = file.getInputStream()) {
                minioClient.putObject(
                        PutObjectArgs.builder()
                                .bucket(bucketName)
                                .object(fileName)
                                .stream(inputStream, file.getSize(), -1)
                                .contentType(file.getContentType())
                                .build()
                );
            }

            log.info("Uploaded audio file to MinIO: {}", fileName);
            return fileName;
        } catch (Exception e) {
            log.error("Failed to upload audio file to MinIO", e);
            throw new RuntimeException("Failed to upload audio file", e);
        }
    }

    private SoundboardSoundDTO toDTO(SoundboardSound sound) {
        return SoundboardSoundDTO.builder()
                .id(sound.getId())
                .name(sound.getName())
                .fileUrl(sound.getFileUrl())
                .fileName(sound.getFileName())
                .durationMs(sound.getDurationMs())
                .fileSize(sound.getFileSize())
                .userId(sound.getUser().getId())
                .username(sound.getUser().getUsername())
                .createdAt(sound.getCreatedAt())
                .build();
    }
}
