package com.lootchat.LootChat.repository;

import com.lootchat.LootChat.entity.InviteToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface InviteTokenRepository extends JpaRepository<InviteToken, Long> {
    Optional<InviteToken> findByToken(String token);
    boolean existsByToken(String token);
}
