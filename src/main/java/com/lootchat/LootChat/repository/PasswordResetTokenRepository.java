package com.lootchat.LootChat.repository;

import com.lootchat.LootChat.entity.PasswordResetToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;

@Repository
public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, Long> {
    
    Optional<PasswordResetToken> findByEmailAndOtpCodeAndUsedFalse(String email, String otpCode);
    
    Optional<PasswordResetToken> findByEmailAndVerifiedTrueAndUsedFalse(String email);
    
    @Modifying
    @Query("DELETE FROM PasswordResetToken t WHERE t.expiresAt < :now")
    void deleteExpiredTokens(LocalDateTime now);
    
    @Modifying
    @Query("UPDATE PasswordResetToken t SET t.used = true WHERE t.email = :email")
    void invalidateAllTokensForEmail(String email);
}
