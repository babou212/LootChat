package com.lootchat.LootChat.service.message;

import com.lootchat.LootChat.document.MessageDocument;
import com.lootchat.LootChat.dto.message.MessageSearchResponse;
import com.lootchat.LootChat.dto.message.MessageSearchResult;
import com.lootchat.LootChat.entity.ChannelType;
import com.lootchat.LootChat.entity.Message;
import com.lootchat.LootChat.entity.User;
import com.lootchat.LootChat.repository.MessageRepository;
import com.lootchat.LootChat.repository.MessageSearchRepository;
import com.lootchat.LootChat.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@Lazy
@RequiredArgsConstructor
public class MessageSearchService {
    
    private final MessageSearchRepository searchRepository;
    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    
    /**
     * Search messages across all channels
     */
    public MessageSearchResponse searchAllMessages(String query, int page, int size) {
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<MessageDocument> results = searchRepository.findByContentContainingIgnoreCase(query, pageRequest);
        
        return buildResponse(results);
    }
    
    /**
     * Search messages within a specific channel
     */
    public MessageSearchResponse searchChannelMessages(Long channelId, String query, int page, int size) {
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<MessageDocument> results = searchRepository.findByChannelIdAndContentContainingIgnoreCase(
                channelId, query, pageRequest);
        
        return buildResponse(results);
    }
    
    /**
     * Index a message for searching
     */
    @Transactional
    public void indexMessage(Message message) {
        if (message.getChannel().getChannelType() != ChannelType.TEXT) {
            log.debug("Skipping indexing for message {} from voice channel", message.getId());
            return;
        }
        
        try {
            MessageDocument document = MessageDocument.builder()
                    .id(message.getId().toString())
                    .messageId(message.getId())
                    .content(message.getContent())
                    .channelId(message.getChannel().getId())
                    .channelName(message.getChannel().getName())
                    .userId(message.getUser().getId())
                    .username(message.getUser().getUsername())
                    .createdAt(message.getCreatedAt())
                    .edited(message.getUpdatedAt() != null && !message.getUpdatedAt().equals(message.getCreatedAt()))
                    .attachmentUrls(message.getImageUrl())
                    .build();
            
            searchRepository.save(document);
            log.debug("Indexed message {} in Elasticsearch", message.getId());
        } catch (Exception e) {
            log.error("Failed to index message {} in Elasticsearch", message.getId(), e);
        }
    }
    
    /**
     * Update indexed message
     */
    @Transactional
    public void updateMessage(Message message) {
        indexMessage(message); // Elasticsearch upserts by ID
    }
    
    /**
     * Delete message from index
     */
    @Transactional
    public void deleteMessage(Long messageId) {
        try {
            searchRepository.deleteById(messageId.toString());
            log.debug("Deleted message {} from Elasticsearch", messageId);
        } catch (Exception e) {
            log.error("Failed to delete message {} from Elasticsearch", messageId, e);
        }
    }
    
    /**
     * Reindex all messages (for maintenance)
     */
    @Transactional(readOnly = true)
    public void reindexAllMessages() {
        log.info("Starting full reindex of messages");
        searchRepository.deleteAll();
        
        List<Message> allMessages = messageRepository.findAll();
        List<MessageDocument> documents = allMessages.stream()
                .filter(message -> message.getChannel().getChannelType() == ChannelType.TEXT)
                .map(message -> MessageDocument.builder()
                        .id(message.getId().toString())
                        .messageId(message.getId())
                        .content(message.getContent())
                        .channelId(message.getChannel().getId())
                        .channelName(message.getChannel().getName())
                        .userId(message.getUser().getId())
                        .username(message.getUser().getUsername())
                        .createdAt(message.getCreatedAt())
                        .edited(message.getUpdatedAt() != null && !message.getUpdatedAt().equals(message.getCreatedAt()))
                        .attachmentUrls(message.getImageUrl())
                        .build())
                .collect(Collectors.toList());
        
        searchRepository.saveAll(documents);
        log.info("Completed reindex of {} messages (TEXT channels only)", documents.size());
    }
    
    private MessageSearchResponse buildResponse(Page<MessageDocument> page) {
        List<MessageSearchResult> results = page.getContent().stream()
                .map(doc -> {
                    // Fetch user avatar from database
                    String avatar = userRepository.findById(doc.getUserId())
                            .map(User::getAvatar)
                            .orElse(null);
                    
                    return MessageSearchResult.builder()
                            .messageId(doc.getMessageId())
                            .content(doc.getContent())
                            .channelId(doc.getChannelId())
                            .channelName(doc.getChannelName())
                            .userId(doc.getUserId())
                            .username(doc.getUsername())
                            .userAvatar(avatar)
                            .createdAt(doc.getCreatedAt())
                            .edited(doc.getEdited())
                            .attachmentUrls(doc.getAttachmentUrls() != null ? 
                                    Arrays.asList(doc.getAttachmentUrls().split(",")) : null)
                            .build();
                })
                .collect(Collectors.toList());
        
        return MessageSearchResponse.builder()
                .results(results)
                .page(page.getNumber())
                .size(page.getSize())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .build();
    }
}
