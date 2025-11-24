package com.lootchat.LootChat.repository;

import com.lootchat.LootChat.entity.DirectMessageReaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DirectMessageReactionRepository extends JpaRepository<DirectMessageReaction, Long> {
    
    List<DirectMessageReaction> findByMessageId(Long messageId);
    
    @Query("SELECT r FROM DirectMessageReaction r WHERE r.message.id = :messageId AND r.userId = :userId AND r.emoji = :emoji")
    Optional<DirectMessageReaction> findByMessageIdAndUserIdAndEmoji(
            @Param("messageId") Long messageId,
            @Param("userId") Long userId,
            @Param("emoji") String emoji);
    
    void deleteByMessageId(Long messageId);
}
