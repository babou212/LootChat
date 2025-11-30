package com.lootchat.LootChat.service;

import com.lootchat.LootChat.entity.InboxEvent;
import com.lootchat.LootChat.repository.InboxEventRepository;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("InboxService Tests")
class InboxServiceTest {

    @Mock
    private InboxEventRepository inboxRepository;

    @InjectMocks
    private InboxService inboxService;

    private ConsumerRecord<String, String> testRecord;

    @BeforeEach
    void setUp() {
        testRecord = new ConsumerRecord<>(
                "lootchat.chat.messages", // topic
                0,                         // partition
                100L,                      // offset
                "channel-1",               // key
                "{\"messageId\":1,\"content\":\"test\"}" // value
        );
    }

    @Test
    @DisplayName("storeEvent should store new event successfully")
    void storeEvent_ShouldStoreNewEvent() {
        when(inboxRepository.existsByIdempotencyKey(anyString())).thenReturn(false);
        when(inboxRepository.save(any(InboxEvent.class))).thenAnswer(invocation -> {
            InboxEvent event = invocation.getArgument(0);
            event.setId(1L);
            return event;
        });

        Optional<InboxEvent> result = inboxService.storeEvent(testRecord, "MESSAGE_CREATED");

        assertThat(result).isPresent();
        assertThat(result.get().getId()).isEqualTo(1L);
        assertThat(result.get().getEventType()).isEqualTo("MESSAGE_CREATED");
        assertThat(result.get().getTopic()).isEqualTo("lootchat.chat.messages");
        assertThat(result.get().getKafkaPartition()).isEqualTo(0);
        assertThat(result.get().getKafkaOffset()).isEqualTo(100L);
        assertThat(result.get().getMessageKey()).isEqualTo("channel-1");
        
        verify(inboxRepository).existsByIdempotencyKey("lootchat.chat.messages:0:100");
        verify(inboxRepository).save(any(InboxEvent.class));
    }

    @Test
    @DisplayName("storeEvent should return empty for duplicate event")
    void storeEvent_ShouldReturnEmpty_ForDuplicate() {
        when(inboxRepository.existsByIdempotencyKey(anyString())).thenReturn(true);

        Optional<InboxEvent> result = inboxService.storeEvent(testRecord, "MESSAGE_CREATED");

        assertThat(result).isEmpty();
        verify(inboxRepository).existsByIdempotencyKey("lootchat.chat.messages:0:100");
        verify(inboxRepository, never()).save(any());
    }

    @Test
    @DisplayName("storeEvent should handle race condition gracefully")
    void storeEvent_ShouldHandleRaceCondition() {
        when(inboxRepository.existsByIdempotencyKey(anyString())).thenReturn(false);
        when(inboxRepository.save(any(InboxEvent.class)))
                .thenThrow(new DataIntegrityViolationException("Duplicate key"));

        Optional<InboxEvent> result = inboxService.storeEvent(testRecord, "MESSAGE_CREATED");

        assertThat(result).isEmpty();
    }

    @Test
    @DisplayName("storeEvent with custom key should work correctly")
    void storeEvent_WithCustomKey_ShouldWork() {
        String customKey = "custom:business:key";
        when(inboxRepository.existsByIdempotencyKey(customKey)).thenReturn(false);
        when(inboxRepository.save(any(InboxEvent.class))).thenAnswer(invocation -> {
            InboxEvent event = invocation.getArgument(0);
            event.setId(1L);
            return event;
        });

        Optional<InboxEvent> result = inboxService.storeEvent(
                customKey, 
                "MESSAGE_CREATED", 
                "test-topic", 
                "{\"data\":\"value\"}"
        );

        assertThat(result).isPresent();
        assertThat(result.get().getIdempotencyKey()).isEqualTo(customKey);
        assertThat(result.get().getTopic()).isEqualTo("test-topic");
    }

    @Test
    @DisplayName("isDuplicate should return true for existing key")
    void isDuplicate_ShouldReturnTrue_ForExistingKey() {
        when(inboxRepository.existsByIdempotencyKey("existing:key")).thenReturn(true);

        boolean result = inboxService.isDuplicate("existing:key");

        assertThat(result).isTrue();
    }

    @Test
    @DisplayName("isDuplicate should return false for new key")
    void isDuplicate_ShouldReturnFalse_ForNewKey() {
        when(inboxRepository.existsByIdempotencyKey("new:key")).thenReturn(false);

        boolean result = inboxService.isDuplicate("new:key");

        assertThat(result).isFalse();
    }

    @Test
    @DisplayName("buildIdempotencyKey should create correct format")
    void buildIdempotencyKey_ShouldCreateCorrectFormat() {
        String key = inboxService.buildIdempotencyKey(testRecord);

        assertThat(key).isEqualTo("lootchat.chat.messages:0:100");
    }

    @Test
    @DisplayName("markAsProcessed should call repository correctly")
    void markAsProcessed_ShouldCallRepository() {
        inboxService.markAsProcessed(1L, "processor-1");

        verify(inboxRepository).markAsProcessed(eq(1L), any(), eq("processor-1"));
    }

    @Test
    @DisplayName("recordFailure should truncate long error messages")
    void recordFailure_ShouldTruncateLongError() {
        String longError = "x".repeat(2000);
        
        inboxService.recordFailure(1L, longError);

        ArgumentCaptor<String> errorCaptor = ArgumentCaptor.forClass(String.class);
        verify(inboxRepository).incrementRetryCount(eq(1L), errorCaptor.capture());
        
        assertThat(errorCaptor.getValue()).hasSize(1000);
    }

    @Test
    @DisplayName("getPendingEventCount should return repository count")
    void getPendingEventCount_ShouldReturnCount() {
        when(inboxRepository.countByProcessedFalse()).thenReturn(42L);

        long count = inboxService.getPendingEventCount();

        assertThat(count).isEqualTo(42L);
    }
}
