package com.lootchat.LootChat.dto.message;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MessageSearchResponse {
    private List<MessageSearchResult> results;
    private int page;
    private int size;
    private long totalElements;
    private int totalPages;
}
