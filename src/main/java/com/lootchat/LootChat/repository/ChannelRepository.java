package com.lootchat.LootChat.repository;

import com.lootchat.LootChat.entity.Channel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ChannelRepository extends JpaRepository<Channel, Long> {
    
    Optional<Channel> findByName(String name);
    
    List<Channel> findAllByOrderByNameAsc();
}
