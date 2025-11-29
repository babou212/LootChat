package com.lootchat.LootChat.repository;

import com.lootchat.LootChat.entity.Message;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MessageRepository extends JpaRepository<Message, Long> {
    
    List<Message> findByUserId(Long userId);
    
    List<Message> findByUserIdOrderByCreatedAtDesc(Long userId);
    
    List<Message> findAllByOrderByCreatedAtDesc();
    
    List<Message> findByChannelIdOrderByCreatedAtDesc(Long channelId);
    
    Page<Message> findByChannelIdOrderByCreatedAtDesc(Long channelId, Pageable pageable);
    
    List<Message> findByChannelIdAndIdLessThanOrderByIdDesc(Long channelId, Long beforeId, Pageable pageable);
    
    List<Message> findByChannelIdAndUserIdOrderByCreatedAtDesc(Long channelId, Long userId);
    
    @Query("SELECT m FROM Message m LEFT JOIN FETCH m.user LEFT JOIN FETCH m.channel WHERE m.id = :id")
    Optional<Message> findByIdWithUserAndChannel(@Param("id") Long id);
}
