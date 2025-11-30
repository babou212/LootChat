package com.lootchat.LootChat.repository;

import com.lootchat.LootChat.entity.MessageDocument;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.elasticsearch.repository.ElasticsearchRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface MessageSearchRepository extends ElasticsearchRepository<MessageDocument, String> {

    //full text search
    Page<MessageDocument> findByContentContaining(String content, Pageable pageable);

    //search by channel
    Page<MessageDocument> findByChannelNameAndContentContaining(String channelName, String content, Pageable pageable);

    //search by user
    Page<MessageDocument> findByUsernameAndContentContaining(String username, String content, Pageable pageable);

    // find the OG messageID in database
    MessageDocument findByMessageId(Long messageId);

    // delete by message Id
    void deleteByMessageId(Long messageId);

}
