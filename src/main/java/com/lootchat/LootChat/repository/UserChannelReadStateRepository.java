package com.lootchat.LootChat.repository;

import com.lootchat.LootChat.entity.UserChannelReadState;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserChannelReadStateRepository extends JpaRepository<UserChannelReadState, Long> {

    Optional<UserChannelReadState> findByUserIdAndChannelId(Long userId, Long channelId);

    List<UserChannelReadState> findByUserId(Long userId);

    @Query("SELECT ucrs FROM UserChannelReadState ucrs WHERE ucrs.user.id = :userId AND ucrs.channel.id IN :channelIds")
    List<UserChannelReadState> findByUserIdAndChannelIdIn(@Param("userId") Long userId, @Param("channelIds") List<Long> channelIds);

    @Modifying
    @Query("UPDATE UserChannelReadState ucrs SET ucrs.lastReadAt = :lastReadAt, ucrs.lastReadMessageId = :lastReadMessageId, ucrs.updatedAt = :updatedAt WHERE ucrs.user.id = :userId AND ucrs.channel.id = :channelId")
    int updateLastRead(@Param("userId") Long userId, 
                       @Param("channelId") Long channelId, 
                       @Param("lastReadAt") LocalDateTime lastReadAt,
                       @Param("lastReadMessageId") Long lastReadMessageId,
                       @Param("updatedAt") LocalDateTime updatedAt);

    @Query("SELECT ucrs.channel.id FROM UserChannelReadState ucrs WHERE ucrs.user.id = :userId")
    List<Long> findChannelIdsByUserId(@Param("userId") Long userId);

    void deleteByChannelId(Long channelId);

    void deleteByUserId(Long userId);
}
