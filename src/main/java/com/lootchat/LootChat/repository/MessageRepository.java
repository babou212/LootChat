package com.lootchat.LootChat.repository;

import com.lootchat.LootChat.entity.Message;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface MessageRepository extends JpaRepository<Message, Long> {
    
    List<Message> findByUserId(Long userId);
    
    /**
     * Count unread messages in a channel for a user based on their last read timestamp.
     * Only counts non-deleted messages created after the specified timestamp.
     */
    @Query("SELECT COUNT(m) FROM Message m WHERE m.channel.id = :channelId AND m.createdAt > :lastReadAt AND m.deleted = false")
    int countUnreadMessagesInChannel(@Param("channelId") Long channelId, @Param("lastReadAt") LocalDateTime lastReadAt);
    
    /**
     * Count all non-deleted messages in a channel (for users who have never read it).
     */
    @Query("SELECT COUNT(m) FROM Message m WHERE m.channel.id = :channelId AND m.deleted = false")
    int countAllMessagesInChannel(@Param("channelId") Long channelId);
    
    /**
     * Get the latest message ID in a channel.
     */
    @Query("SELECT MAX(m.id) FROM Message m WHERE m.channel.id = :channelId")
    Optional<Long> findLatestMessageIdInChannel(@Param("channelId") Long channelId);
    
    /**
     * Get the latest message timestamp in a channel.
     */
    @Query("SELECT MAX(m.createdAt) FROM Message m WHERE m.channel.id = :channelId")
    Optional<LocalDateTime> findLatestMessageTimestampInChannel(@Param("channelId") Long channelId);
    
    List<Message> findByUserIdOrderByCreatedAtDesc(Long userId);
    
    List<Message> findAllByOrderByCreatedAtDesc();
    
    List<Message> findByChannelIdOrderByCreatedAtDesc(Long channelId);
    
    Page<Message> findByChannelIdOrderByCreatedAtDesc(Long channelId, Pageable pageable);
    
    List<Message> findByChannelIdAndIdLessThanOrderByIdDesc(Long channelId, Long beforeId, Pageable pageable);
    
    List<Message> findByChannelIdAndUserIdOrderByCreatedAtDesc(Long channelId, Long userId);
    
    @Query("SELECT m FROM Message m LEFT JOIN FETCH m.user LEFT JOIN FETCH m.channel WHERE m.id = :id")
    Optional<Message> findByIdWithUserAndChannel(@Param("id") Long id);
}
