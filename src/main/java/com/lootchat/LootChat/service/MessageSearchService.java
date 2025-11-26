package com.lootchat.LootChat.service;

import com.lootchat.LootChat.entity.Message;
import com.lootchat.LootChat.entity.MessageDocument;
import com.lootchat.LootChat.repository.MessageSearchRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class MessageSearchService {

    private static final Logger log = LoggerFactory.getLogger(MessageSearchService.class);

    private final MessageSearchRepository messageSearchRepository;

    public void indexMessage(Message message) {
        try {
            MessageDocument document = MessageDocument.builder()
                    .id(String.valueOf(message.getId()))
                    .messageId(message.getId())
                    .content(message.getContent())
                    .userId(message.getUser().getId())
                    .username(message.getUser().getUsername())
                    .channelId(message.getChannel().getId())
                    .channelName(message.getChannel().getName())
                    .imageUrl(message.getImageUrl())
                    .createdAt(message.getCreatedAt())
                    .updatedAt(message.getUpdatedAt())
                    .build();

            messageSearchRepository.save(document);
            log.debug("Indexed message in elasticsearch with messageId{}", message.getId());
        } catch (Exception e) {
            log.error("Failed to index message in elasticsearch with messageId{}", message.getId());
        }
    }

    public void updateMessage(Message message) {
        indexMessage(message);
    }

    public void deleteMessage(Long messageId) {
        try {
            messageSearchRepository.deleteByMessageId(messageId);
            log.debug("message deleted from elasticsearch with id{}", messageId);
        } catch (Exception e) {
            log.error("Failed to delete message from elasticsearch with id{}", messageId);
        }
    }
}
