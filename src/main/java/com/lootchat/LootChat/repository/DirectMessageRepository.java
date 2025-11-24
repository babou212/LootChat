package com.lootchat.LootChat.repository;

import com.lootchat.LootChat.entity.DirectMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DirectMessageRepository extends JpaRepository<DirectMessage, Long> {
    
    @Query("SELECT dm FROM DirectMessage dm WHERE " +
           "(dm.user1.id = :userId1 AND dm.user2.id = :userId2) OR " +
           "(dm.user1.id = :userId2 AND dm.user2.id = :userId1)")
    Optional<DirectMessage> findByBothUsers(@Param("userId1") Long userId1, @Param("userId2") Long userId2);
    
    @Query("SELECT dm FROM DirectMessage dm WHERE " +
           "dm.user1.id = :userId OR dm.user2.id = :userId " +
           "ORDER BY dm.lastMessageAt DESC NULLS LAST")
    List<DirectMessage> findAllByUser(@Param("userId") Long userId);
    
    @Query("SELECT dm FROM DirectMessage dm " +
           "LEFT JOIN FETCH dm.user1 " +
           "LEFT JOIN FETCH dm.user2 " +
           "WHERE dm.id = :id")
    Optional<DirectMessage> findByIdWithUsers(@Param("id") Long id);
}
