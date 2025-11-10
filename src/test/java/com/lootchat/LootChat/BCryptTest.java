package com.lootchat.LootChat;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import static org.junit.jupiter.api.Assertions.assertTrue;

public class BCryptTest {

    @Test
    public void testBCryptHash() {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
        String password = "password123";
        String hash = "$2a$10$8.UnVuG9HHgffUDAlk8qfOuVGkqRzgVymGe07xd00DMxs.AQubh4a";
        
        System.out.println("Testing password: " + password);
        System.out.println("Against hash: " + hash);
        
        boolean matches = encoder.matches(password, hash);
        System.out.println("Matches: " + matches);
        
        // Generate a new hash for comparison
        String newHash = encoder.encode(password);
        System.out.println("\nNew hash: " + newHash);
        System.out.println("New hash matches: " + encoder.matches(password, newHash));
        
        assertTrue(matches, "BCrypt hash should match password123");
    }
}
