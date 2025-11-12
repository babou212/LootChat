package com.lootchat.LootChat.entity;

import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Collection;
@Data
@NoArgsConstructor
public class PagingResult<T> {

    private Collection<T> content;
    private Integer totalPages;
    private long totalElements;
    private Integer sizePage;
    private Integer page;
    private Boolean empty;

    public PagingResult(Collection<T> content, Integer totalPages, long totalElements, Integer sizePage, Integer page, Boolean empty) {
        this.content = content;
        this.totalPages = totalPages;
        this.totalElements = totalElements;
        this.sizePage = sizePage;
        this.page = page + 1;
        this.empty = empty;
    }
}
