package com.lootchat.LootChat.repository;

import com.lootchat.LootChat.entity.Message;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MessageRepository extends JpaRepository<Message, Long> {
    
    List<Message> findByUserId(Long userId);
    
    List<Message> findByUserIdOrderByCreatedAtDesc(Long userId);
    
    List<Message> findAllByOrderByCreatedAtDesc();
    
    List<Message> findByChannelIdOrderByCreatedAtDesc(Long channelId);
    
    List<Message> findByChannelIdAndUserIdOrderByCreatedAtDesc(Long channelId, Long userId);
}
