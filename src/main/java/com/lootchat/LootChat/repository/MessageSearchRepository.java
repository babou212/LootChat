package com.lootchat.LootChat.repository;

import com.lootchat.LootChat.document.MessageDocument;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.elasticsearch.repository.ElasticsearchRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface MessageSearchRepository extends ElasticsearchRepository<MessageDocument, String> {
    
    Page<MessageDocument> findByContentContainingIgnoreCase(String content, Pageable pageable);
    
    Page<MessageDocument> findByChannelIdAndContentContainingIgnoreCase(Long channelId, String content, Pageable pageable);
    
    Page<MessageDocument> findByChannelId(Long channelId, Pageable pageable);
}
