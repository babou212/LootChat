package com.lootchat.LootChat.document;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.elasticsearch.annotations.Document;
import org.springframework.data.elasticsearch.annotations.Field;
import org.springframework.data.elasticsearch.annotations.FieldType;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(indexName = "direct_messages")
public class DirectMessageDocument {
    
    @Id
    private String id;
    
    @Field(type = FieldType.Long)
    private Long messageId;
    
    @Field(type = FieldType.Text, analyzer = "standard")
    private String content;
    
    @Field(type = FieldType.Long)
    private Long directMessageId;
    
    @Field(type = FieldType.Long)
    private Long senderId;
    
    @Field(type = FieldType.Keyword)
    private String senderUsername;
    
    @Field(type = FieldType.Long)
    private Long user1Id;
    
    @Field(type = FieldType.Long)
    private Long user2Id;
    
    @Field(type = FieldType.Date, format = {}, pattern = "uuuu-MM-dd'T'HH:mm:ss.SSS")
    private LocalDateTime createdAt;
    
    @Field(type = FieldType.Boolean)
    private Boolean edited;
    
    @Field(type = FieldType.Keyword)
    private String imageUrl;
}
