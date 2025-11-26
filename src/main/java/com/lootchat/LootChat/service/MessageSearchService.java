package com.lootchat.LootChat.service;

import com.lootchat.LootChat.entity.Message;
import com.lootchat.LootChat.entity.MessageDocument;
import com.lootchat.LootChat.repository.MessageSearchRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

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

    public List<MessageDocument> searchAllMessages(String query, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.Direction.DESC, "CreatedAt");
        Page<MessageDocument> results = messageSearchRepository.findMessageContaining(query, pageable);
        return results.getContent();
    }

    public List<MessageDocument> searchMessagesInChannel(Long channelId, String query, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.Direction.DESC, "CreatedAt");
        Page<MessageDocument> results = messageSearchRepository.findChannelIdContainingMessage(channelId, query, pageable);
        return results.getContent();
    }

    public List<MessageDocument> searchMessagesByUser(Long userId, String query, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.Direction.DESC, "CreatedAt");
        Page<MessageDocument> results = messageSearchRepository.findUserIdContainingMessage(userId, query, pageable);
        return results.getContent();
    }

    /**
     * this is for the initial bulk indexing of messages, good for the initial messages we are loading in from
     * sql injection, couldnt be bothered finding out how to do this so I asked claude
     */
    public void indexAllMessages(List<Message> messages) {
        try {
            List<MessageDocument> documents = messages.stream()
                    .map(message -> MessageDocument.builder()
                            .id(String.valueOf(message.getId()))
                            .messageId(message.getId())
                            .content(message.getContent())
                            .userId(message.getUser().getId())
                            .username(message.getUser().getUsername())
                            .channelId(message.getChannel() != null ? message.getChannel().getId() : null)
                            .channelName(message.getChannel() != null ? message.getChannel().getName() : null)
                            .imageUrl(message.getImageUrl())
                            .createdAt(message.getCreatedAt())
                            .updatedAt(message.getUpdatedAt())
                            .build())
                    .collect(Collectors.toList());

            messageSearchRepository.saveAll(documents);
            log.info("Bulk indexed {} messages in Elasticsearch", documents.size());
        } catch (Exception e) {
            log.error("Failed to bulk index messages", e);
        }
    }


}
