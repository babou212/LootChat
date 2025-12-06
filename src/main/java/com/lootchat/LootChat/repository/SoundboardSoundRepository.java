package com.lootchat.LootChat.repository;

import com.lootchat.LootChat.entity.SoundboardSound;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SoundboardSoundRepository extends JpaRepository<SoundboardSound, Long> {
    List<SoundboardSound> findAllByOrderByCreatedAtDesc();
    Optional<SoundboardSound> findByIdAndUserId(Long id, Long userId);
    long count();
}
