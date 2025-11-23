package com.lootchat.LootChat;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;
import com.lootchat.LootChat.service.S3FileStorageService;

@SpringBootTest
@ActiveProfiles("test")
class LootChatApplicationTests {

	@MockBean
	private S3FileStorageService s3FileStorageService;

	@Test
	void contextLoads() {
		// Context loads successfully with mocked S3 service
	}

}
