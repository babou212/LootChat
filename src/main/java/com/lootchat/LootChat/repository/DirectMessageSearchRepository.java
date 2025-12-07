package com.lootchat.LootChat.repository;

import com.lootchat.LootChat.document.DirectMessageDocument;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.elasticsearch.annotations.Query;
import org.springframework.data.elasticsearch.repository.ElasticsearchRepository;
import org.springframework.stereotype.Repository;

@Repository
@Lazy
public interface DirectMessageSearchRepository extends ElasticsearchRepository<DirectMessageDocument, String> {
    
    /**
     * Search direct messages in a specific DirectMessage conversation
     * Filters by directMessageId to ensure only messages from this conversation are returned
     */
    @Query("""
        {
          "bool": {
            "must": [
              {
                "query_string": {
                  "query": "*?0*",
                  "fields": ["content^2", "senderUsername"],
                  "default_operator": "OR",
                  "analyze_wildcard": true
                }
              },
              {
                "term": {"directMessageId": ?1}
              }
            ]
          }
        }
        """)
    Page<DirectMessageDocument> searchInConversation(String query, Long directMessageId, Pageable pageable);
}
