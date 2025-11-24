package com.lootchat.LootChat.repository;

import com.lootchat.LootChat.entity.DirectMessageMessage;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DirectMessageMessageRepository extends JpaRepository<DirectMessageMessage, Long> {
    
    @Query("SELECT dmm FROM DirectMessageMessage dmm " +
           "LEFT JOIN FETCH dmm.sender " +
           "LEFT JOIN FETCH dmm.directMessage " +
           "WHERE dmm.directMessage.id = :directMessageId " +
           "ORDER BY dmm.createdAt DESC")
    List<DirectMessageMessage> findByDirectMessageId(@Param("directMessageId") Long directMessageId, Pageable pageable);
    
    @Query("SELECT dmm FROM DirectMessageMessage dmm " +
           "LEFT JOIN FETCH dmm.sender " +
           "LEFT JOIN FETCH dmm.directMessage " +
           "WHERE dmm.id = :id")
    Optional<DirectMessageMessage> findByIdWithSenderAndDirectMessage(@Param("id") Long id);
    
    @Query("SELECT COUNT(dmm) FROM DirectMessageMessage dmm " +
           "WHERE dmm.directMessage.id = :directMessageId " +
           "AND dmm.sender.id != :userId " +
           "AND dmm.isRead = false")
    int countUnreadMessages(@Param("directMessageId") Long directMessageId, @Param("userId") Long userId);
    
    @Query("SELECT dmm FROM DirectMessageMessage dmm " +
           "WHERE dmm.directMessage.id = :directMessageId " +
           "ORDER BY dmm.createdAt DESC " +
           "LIMIT 1")
    Optional<DirectMessageMessage> findLastMessageByDirectMessageId(@Param("directMessageId") Long directMessageId);
}
