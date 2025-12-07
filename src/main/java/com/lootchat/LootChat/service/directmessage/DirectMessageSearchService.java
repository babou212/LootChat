package com.lootchat.LootChat.service.directmessage;

import com.lootchat.LootChat.document.DirectMessageDocument;
import com.lootchat.LootChat.dto.message.MessageSearchResponse;
import com.lootchat.LootChat.dto.message.MessageSearchResult;
import com.lootchat.LootChat.entity.DirectMessage;
import com.lootchat.LootChat.entity.DirectMessageMessage;
import com.lootchat.LootChat.repository.DirectMessageMessageRepository;
import com.lootchat.LootChat.repository.DirectMessageSearchRepository;
import com.lootchat.LootChat.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor(onConstructor = @__(@Lazy))
public class DirectMessageSearchService {

    @Lazy
    private final DirectMessageSearchRepository searchRepository;
    private final DirectMessageMessageRepository messageRepository;
    private final UserRepository userRepository;

    /**
     * Index a direct message in Elasticsearch
     */
    public void indexMessage(DirectMessageMessage message) {
        try {
            DirectMessage dm = message.getDirectMessage();
            
            DirectMessageDocument document = DirectMessageDocument.builder()
                    .id(message.getId().toString())
                    .messageId(message.getId())
                    .content(message.getContent())
                    .directMessageId(dm.getId())
                    .senderId(message.getSender().getId())
                    .senderUsername(message.getSender().getUsername())
                    .user1Id(dm.getUser1().getId())
                    .user2Id(dm.getUser2().getId())
                    .createdAt(message.getCreatedAt())
                    .edited(message.getUpdatedAt() != null && !message.getUpdatedAt().equals(message.getCreatedAt()))
                    .imageUrl(message.getImageUrl())
                    .build();

            searchRepository.save(document);
        } catch (Exception e) {
            log.error("Failed to index DM message {} in Elasticsearch", message.getId(), e);
        }
    }

    /**
     * Search direct messages in a specific DirectMessage conversation
     * This ensures users can only search messages from this specific conversation
     */
    public MessageSearchResponse searchMessages(String query, Long directMessageId, int page, int size) {
        try {
            PageRequest pageRequest = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
            Page<DirectMessageDocument> results = searchRepository.searchInConversation(
                    query,
                    directMessageId,
                    pageRequest
            );

            return buildResponse(results);
        } catch (Exception e) {
            log.error("Error searching direct messages in conversation {}", directMessageId, e);
            return MessageSearchResponse.builder()
                    .results(List.of())
                    .totalElements(0)
                    .totalPages(0)
                    .page(page)
                    .size(size)
                    .build();
        }
    }

    /**
     * Delete a message from the search index
     */
    public void deleteMessage(Long messageId) {
        try {
            searchRepository.deleteById(messageId.toString());
            log.debug("Deleted DM message {} from Elasticsearch", messageId);
        } catch (Exception e) {
            log.error("Failed to delete DM message {} from Elasticsearch", messageId, e);
        }
    }

    /**
     * Reindex all direct messages
     * Note: This should be run carefully as it processes all DMs
     */
    @Transactional(readOnly = true)
    public void reindexAllMessages() {
        log.info("Starting full reindex of direct messages");
        searchRepository.deleteAll();

        List<DirectMessageMessage> allMessages = messageRepository.findAll();
        List<DirectMessageDocument> documents = allMessages.stream()
                .filter(message -> !message.isDeleted())
                .map(message -> {
                    DirectMessage dm = message.getDirectMessage();
                    return DirectMessageDocument.builder()
                            .id(message.getId().toString())
                            .messageId(message.getId())
                            .content(message.getContent())
                            .directMessageId(dm.getId())
                            .senderId(message.getSender().getId())
                            .senderUsername(message.getSender().getUsername())
                            .user1Id(dm.getUser1().getId())
                            .user2Id(dm.getUser2().getId())
                            .createdAt(message.getCreatedAt())
                            .edited(message.getUpdatedAt() != null && !message.getUpdatedAt().equals(message.getCreatedAt()))
                            .imageUrl(message.getImageUrl())
                            .build();
                })
                .collect(Collectors.toList());

        searchRepository.saveAll(documents);
        log.info("Completed reindex of {} direct messages", documents.size());
    }

    private MessageSearchResponse buildResponse(Page<DirectMessageDocument> page) {
        List<MessageSearchResult> results = page.getContent().stream()
                .map(doc -> {
                    String avatar = userRepository.findById(doc.getSenderId())
                            .map(user -> user.getAvatar())
                            .orElse(null);

                    return MessageSearchResult.builder()
                            .messageId(doc.getMessageId())
                            .content(doc.getContent())
                            .channelId(doc.getDirectMessageId())
                            .channelName("Direct Message")
                            .userId(doc.getSenderId())
                            .username(doc.getSenderUsername())
                            .userAvatar(avatar)
                            .createdAt(doc.getCreatedAt())
                            .edited(doc.getEdited())
                            .attachmentUrls(doc.getImageUrl() != null ? List.of(doc.getImageUrl()) : null)
                            .build();
                })
                .collect(Collectors.toList());

        return MessageSearchResponse.builder()
                .results(results)
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .page(page.getNumber())
                .size(page.getSize())
                .build();
    }
}
