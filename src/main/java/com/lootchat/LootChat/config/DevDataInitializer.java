package com.lootchat.LootChat.config;

import com.lootchat.LootChat.entity.Channel;
import com.lootchat.LootChat.entity.ChannelType;
import com.lootchat.LootChat.entity.DirectMessage;
import com.lootchat.LootChat.entity.DirectMessageMessage;
import com.lootchat.LootChat.entity.Message;
import com.lootchat.LootChat.entity.Role;
import com.lootchat.LootChat.entity.User;
import com.lootchat.LootChat.repository.ChannelRepository;
import com.lootchat.LootChat.repository.DirectMessageMessageRepository;
import com.lootchat.LootChat.repository.DirectMessageRepository;
import com.lootchat.LootChat.repository.MessageRepository;
import com.lootchat.LootChat.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

/**
 * Initializes development data.
 * 
 * Default password for all dev users: "Password123!"
 */
@Slf4j
@Configuration
@Profile("dev")
@RequiredArgsConstructor
public class DevDataInitializer {

    private final UserRepository userRepository;
    private final ChannelRepository channelRepository;
    private final MessageRepository messageRepository;
    private final DirectMessageRepository directMessageRepository;
    private final DirectMessageMessageRepository directMessageMessageRepository;
    private final PasswordEncoder passwordEncoder;

    private static final Random random = new Random();
    
    private static final String[] MESSAGE_TEMPLATES = {
        "Hey everyone! 👋",
        "What's up?",
        "Anyone want to team up for a game?",
        "Just finished an epic gaming session!",
        "Has anyone tried the new update?",
        "Looking for teammates!",
        "GG everyone! That was intense! 🎮",
        "I found a bug in the game...",
        "Who's online right now?",
        "Need help with this level",
        "That was so close!",
        "Anyone streaming today?",
        "Check out this clip I recorded!",
        "Best game I've played in weeks!",
        "The new season is amazing!",
        "Anyone else having lag issues?",
        "Just got a new high score! 🏆",
        "Who wants to do a dungeon run?",
        "I'm taking a break, back in 10",
        "Does anyone know how to...",
        "Thanks for the help earlier!",
        "See you all tomorrow!",
        "Good morning everyone!",
        "This boss fight is impossible",
        "Finally beat that level!",
        "Anyone have spare loot?",
        "Trading legendary items!",
        "Join voice chat!",
        "I need a healer for my team",
        "Who's ready for raid night?",
        "This game is so addictive",
        "Just unlocked a new achievement!",
        "Anyone playing later tonight?",
        "I got the rare drop! 😱",
        "Server maintenance in 1 hour",
        "What's the meta build now?",
        "Need tips for this boss",
        "That was hilarious 😂",
        "I'm streaming on my channel",
        "Props to our tank!",
        "Healer saved my life there",
        "Great teamwork everyone!",
        "Who else is hyped for this?",
        "I can't believe we pulled that off",
        "Anyone else grinding tonight?",
        "Just hit max level!",
        "Found a secret area!",
        "This soundtrack is amazing",
        "Rate my build 1-10",
        "Who's the best player here? 🤔"
    };
    
    private static final String[] DM_TEMPLATES = {
        "Hey! How are you doing?",
        "Did you see my message earlier?",
        "Want to play together later?",
        "Thanks for the help yesterday!",
        "I have a question about...",
        "Are you free to chat?",
        "Check this out!",
        "Let me know when you're online",
        "I found something cool",
        "Can you help me with something?",
        "What do you think about...?",
        "Sounds good to me!",
        "Sure, I'm down for that",
        "Maybe later?",
        "Let me check and get back to you",
        "That's awesome!",
        "No way! Really?",
        "Haha that's funny 😄",
        "I'll be there in a few minutes",
        "Running a bit late, sorry!",
        "Just finished, what's up?",
        "Busy right now, catch you later",
        "Thanks!",
        "No problem!",
        "Anytime 👍",
        "See you soon!",
        "Talk to you later",
        "Good luck!",
        "You got this!",
        "That sounds fun"
    };

    @Bean
    public CommandLineRunner initDevData() {
        return args -> {
            log.info("Initializing development data...");

            String encodedPassword = passwordEncoder.encode("Password123!");
            log.info("Dev password (Password123!) encoded with: {}", encodedPassword.substring(0, 7));

            List<User> users = new ArrayList<>();
            users.add(createUser("admin", "admin@lootchat.com", encodedPassword, 
                "Admin", "User", Role.ADMIN));
            users.add(createUser("john_doe", "john@example.com", encodedPassword,
                "John", "Doe", Role.USER));
            users.add(createUser("jane_smith", "jane@example.com", encodedPassword,
                "Jane", "Smith", Role.MODERATOR));
            users.add(createUser("bob_wilson", "bob@example.com", encodedPassword,
                "Bob", "Wilson", Role.USER));
            users.add(createUser("alice_johnson", "alice@example.com", encodedPassword,
                "Alice", "Johnson", Role.USER));
            users.add(createUser("charlie_brown", "charlie@example.com", encodedPassword,
                "Charlie", "Brown", Role.USER));

            userRepository.saveAll(users);
            log.info("✅ Created {} users", users.size());

            List<Channel> channels = new ArrayList<>();
            channels.add(createChannel("general", "General chat for everyone", ChannelType.TEXT));
            channels.add(createChannel("gaming", "Discussion about gaming and strategies", ChannelType.TEXT));
            channels.add(createChannel("help", "Ask for help and get support", ChannelType.TEXT));
            channels.add(createChannel("off-topic", "Random discussions and fun", ChannelType.TEXT));
            channels.add(createChannel("voice-lounge", "Casual voice chat hangout", ChannelType.VOICE));
            channels.add(createChannel("gaming-voice", "Voice chat for gaming sessions", ChannelType.VOICE));

            channelRepository.saveAll(channels);
            log.info("✅ Created {} channels", channels.size());

            log.info("Generating 10,000 test messages... (this may take a moment)");
            List<Message> messages = new ArrayList<>();
            LocalDateTime startTime = LocalDateTime.now().minusDays(30);
            
            for (int i = 0; i < 10000; i++) {
                User randomUser = users.get(random.nextInt(users.size()));
                Channel randomChannel = channels.get(random.nextInt(4));
                
                long minutesAgo = random.nextInt(30 * 24 * 60);
                LocalDateTime messageTime = startTime.plusMinutes(minutesAgo);
                
                String content = MESSAGE_TEMPLATES[random.nextInt(MESSAGE_TEMPLATES.length)];
                
                if (random.nextInt(10) < 3) {
                    content += " " + MESSAGE_TEMPLATES[random.nextInt(MESSAGE_TEMPLATES.length)];
                }
                
                Message message = new Message();
                message.setContent(content);
                message.setUser(randomUser);
                message.setChannel(randomChannel);
                message.setCreatedAt(messageTime);
                message.setUpdatedAt(messageTime);
                
                messages.add(message);
                
                if (messages.size() >= 500) {
                    messageRepository.saveAll(messages);
                    log.info("Saved {} messages...", i + 1);
                    messages.clear();
                }
            }
            
            if (!messages.isEmpty()) {
                messageRepository.saveAll(messages);
            }

            log.info("✅ Dev data initialized successfully!");
            log.info("📊 Stats:");
            log.info("   - {} users created", users.size());
            log.info("   - {} channels created", channels.size());
            log.info("   - 10,000 messages generated");
            
            // Generate direct messages between random users
            log.info("Generating direct messages between users...");
            List<DirectMessage> directMessages = new ArrayList<>();
            
            // Create DM conversations between random pairs of users
            for (int i = 0; i < users.size() - 1; i++) {
                for (int j = i + 1; j < users.size(); j++) {
                    // Only create DMs for about 50% of user pairs
                    if (random.nextInt(10) < 5) {
                        User user1 = users.get(i);
                        User user2 = users.get(j);
                        
                        DirectMessage dm = new DirectMessage();
                        dm.setUser1(user1);
                        dm.setUser2(user2);
                        dm.setCreatedAt(LocalDateTime.now().minusDays(random.nextInt(30)));
                        dm.setUpdatedAt(dm.getCreatedAt());
                        
                        directMessages.add(dm);
                    }
                }
            }
            
            directMessageRepository.saveAll(directMessages);
            log.info("✅ Created {} DM conversations", directMessages.size());
            
            // Generate messages for each DM conversation
            log.info("Generating DM messages...");
            List<DirectMessageMessage> dmMessages = new ArrayList<>();
            
            for (DirectMessage dm : directMessages) {
                // Random number of messages per conversation (5-50)
                int numMessages = 5 + random.nextInt(46);
                LocalDateTime conversationStart = dm.getCreatedAt();
                
                for (int i = 0; i < numMessages; i++) {
                    // Alternate between users or pick randomly
                    User sender = random.nextBoolean() ? dm.getUser1() : dm.getUser2();
                    
                    // Random time within conversation period
                    long minutesFromStart = random.nextInt((int) java.time.Duration.between(conversationStart, LocalDateTime.now()).toMinutes() + 1);
                    LocalDateTime messageTime = conversationStart.plusMinutes(minutesFromStart);
                    
                    String content = DM_TEMPLATES[random.nextInt(DM_TEMPLATES.length)];
                    
                    DirectMessageMessage dmMsg = new DirectMessageMessage();
                    dmMsg.setContent(content);
                    dmMsg.setSender(sender);
                    dmMsg.setDirectMessage(dm);
                    dmMsg.setRead(random.nextBoolean()); // Random read status
                    dmMsg.setCreatedAt(messageTime);
                    dmMsg.setUpdatedAt(messageTime);
                    
                    dmMessages.add(dmMsg);
                    
                    // Save in batches
                    if (dmMessages.size() >= 500) {
                        directMessageMessageRepository.saveAll(dmMessages);
                        dmMessages.clear();
                    }
                }
                
                // Update last message time
                if (numMessages > 0) {
                    dm.setLastMessageAt(conversationStart.plusMinutes(random.nextInt(30 * 24 * 60)));
                }
            }
            
            if (!dmMessages.isEmpty()) {
                directMessageMessageRepository.saveAll(dmMessages);
            }
            
            // Update DMs with last message time
            directMessageRepository.saveAll(directMessages);

            log.info("✅ Complete! Dev data initialized successfully!");
            log.info("📊 Final Stats:");
            log.info("   - {} users created", users.size());
            log.info("   - {} channels created", channels.size());
            log.info("   - 10,000 channel messages generated");
            log.info("   - {} DM conversations created", directMessages.size());
            log.info("   - ~{} DM messages generated", directMessages.size() * 25);
            log.info("🔑 Default password for all users: Password123!");
            log.info("👤 Users: admin, john_doe, jane_smith, bob_wilson, alice_johnson, charlie_brown");
        };
    }

    private User createUser(String username, String email, String password,
                           String firstName, String lastName, Role role) {
        User user = new User();
        user.setUsername(username);
        user.setEmail(email);
        user.setPassword(password);
        user.setFirstName(firstName);
        user.setLastName(lastName);
        user.setRole(role);
        user.setAvatar("https://api.dicebear.com/7.x/avataaars/svg?seed=" + username);
        user.setEnabled(true);
        user.setAccountNonExpired(true);
        user.setAccountNonLocked(true);
        user.setCredentialsNonExpired(true);
        user.setCreatedAt(LocalDateTime.now());
        user.setUpdatedAt(LocalDateTime.now());
        return user;
    }

    private Channel createChannel(String name, String description, ChannelType type) {
        Channel channel = new Channel();
        channel.setName(name);
        channel.setDescription(description);
        channel.setChannelType(type);
        channel.setCreatedAt(LocalDateTime.now());
        channel.setUpdatedAt(LocalDateTime.now());
        return channel;
    }
}
