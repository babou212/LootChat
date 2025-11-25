package com.lootchat.LootChat;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class LootChatApplication {

	public static void main(String[] args) {
		SpringApplication.run(LootChatApplication.class, args);
	}

}
