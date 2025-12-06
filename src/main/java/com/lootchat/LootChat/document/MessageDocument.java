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
@Document(indexName = "messages")
public class MessageDocument {
    
    @Id
    private String id;
    
    @Field(type = FieldType.Long)
    private Long messageId;
    
    @Field(type = FieldType.Text, analyzer = "standard")
    private String content;
    
    @Field(type = FieldType.Long)
    private Long channelId;
    
    @Field(type = FieldType.Keyword)
    private String channelName;
    
    @Field(type = FieldType.Long)
    private Long userId;
    
    @Field(type = FieldType.Keyword)
    private String username;
    
    @Field(type = FieldType.Date, format = {}, pattern = "uuuu-MM-dd'T'HH:mm:ss.SSS")
    private LocalDateTime createdAt;
    
    @Field(type = FieldType.Boolean)
    private Boolean edited;
    
    @Field(type = FieldType.Text)
    private String attachmentUrls;
}
