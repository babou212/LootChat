package com.lootchat.LootChat.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Tracks the last read timestamp for each user in each channel.
 * This enables persistent unread message counting even when users are offline.
 */
@Entity
@Table(name = "user_channel_read_states",
       uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "channel_id"}),
       indexes = {
           @Index(name = "idx_ucrs_user_id", columnList = "user_id"),
           @Index(name = "idx_ucrs_channel_id", columnList = "channel_id"),
           @Index(name = "idx_ucrs_user_channel", columnList = "user_id, channel_id")
       })
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserChannelReadState {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "channel_id", nullable = false)
    private Channel channel;

    /**
     * The timestamp when the user last read/viewed this channel.
     * Messages created after this timestamp are considered unread.
     */
    @Column(name = "last_read_at", nullable = false)
    private LocalDateTime lastReadAt;

    /**
     * The ID of the last message the user has read.
     * Used for efficient cursor-based queries.
     */
    @Column(name = "last_read_message_id")
    private Long lastReadMessageId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (lastReadAt == null) {
            lastReadAt = LocalDateTime.now();
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
