-- Dummy data for LootChat application (Development only)
-- Note: Passwords are BCrypt encoded version of 'Password123!'

-- Delete in correct order due to foreign key constraints
DELETE FROM user_channel_read_states WHERE 1=1;
DELETE FROM direct_message_reactions WHERE 1=1;
DELETE FROM direct_message_messages WHERE 1=1;
DELETE FROM direct_messages WHERE 1=1;
DELETE FROM message_reactions WHERE 1=1;
DELETE FROM messages WHERE 1=1;
DELETE FROM channels WHERE 1=1;
DELETE FROM invite_tokens WHERE 1=1;
DELETE FROM users WHERE 1=1;

INSERT INTO users (id, username, email, password, first_name, last_name, avatar, role, created_at, updated_at, is_enabled, is_account_non_expired, is_account_non_locked, is_credentials_non_expired) 
VALUES 
    (1, 'admin', 'admin@lootchat.com', '$2b$10$uohmyCJhqM.12TrdPJrLiOzn2tzkUO1Z5mnzX85zdUigYEg9JoUFK', 'Admin', 'User', 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin', 'ADMIN', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, true, true, true, true),
    (2, 'john_doe', 'john@example.com', '$2b$10$uohmyCJhqM.12TrdPJrLiOzn2tzkUO1Z5mnzX85zdUigYEg9JoUFK', 'John', 'Doe', 'https://api.dicebear.com/7.x/avataaars/svg?seed=john', 'USER', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, true, true, true, true),
    (3, 'jane_smith', 'jane@example.com', '$2b$10$uohmyCJhqM.12TrdPJrLiOzn2tzkUO1Z5mnzX85zdUigYEg9JoUFK', 'Jane', 'Smith', 'https://api.dicebear.com/7.x/avataaars/svg?seed=jane', 'MODERATOR', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, true, true, true, true),
    (4, 'bob_wilson', 'bob@example.com', '$2b$10$uohmyCJhqM.12TrdPJrLiOzn2tzkUO1Z5mnzX85zdUigYEg9JoUFK', 'Bob', 'Wilson', 'https://api.dicebear.com/7.x/avataaars/svg?seed=bob', 'USER', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, true, true, true, true),
    (5, 'alice_johnson', 'alice@example.com', '$2b$10$uohmyCJhqM.12TrdPJrLiOzn2tzkUO1Z5mnzX85zdUigYEg9JoUFK', 'Alice', 'Johnson', 'https://api.dicebear.com/7.x/avataaars/svg?seed=alice', 'USER', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, true, true, true, true),
    (6, 'charlie_brown', 'charlie@example.com', '$2b$10$uohmyCJhqM.12TrdPJrLiOzn2tzkUO1Z5mnzX85zdUigYEg9JoUFK', 'Charlie', 'Brown', 'https://api.dicebear.com/7.x/avataaars/svg?seed=charlie', 'USER', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, true, true, true, true);

-- Insert channels
INSERT INTO channels (id, name, description, channel_type, created_at, updated_at) 
VALUES 
    (1, 'general', 'General chat for everyone', 'TEXT', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (2, 'gaming', 'Discussion about gaming and strategies', 'TEXT', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (3, 'help', 'Ask for help and get support', 'TEXT', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (4, 'off-topic', 'Random discussions and fun', 'TEXT', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (5, 'voice-lounge', 'Casual voice chat hangout', 'VOICE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (6, 'gaming-voice', 'Voice chat for gaming sessions', 'VOICE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Insert dummy messages
INSERT INTO messages (id, content, user_id, channel_id, created_at, updated_at) 
VALUES 
    (1, 'Welcome to LootChat! 🎮', 1, 1, CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP - INTERVAL '5 days'),
    (2, 'Hey everyone! Excited to be here!', 2, 1, CURRENT_TIMESTAMP - INTERVAL '4 days', CURRENT_TIMESTAMP - INTERVAL '4 days'),
    (3, 'Has anyone tried the new game update?', 3, 2, CURRENT_TIMESTAMP - INTERVAL '4 days', CURRENT_TIMESTAMP - INTERVAL '4 days'),
    (4, 'Yes! The new features are amazing!', 4, 2, CURRENT_TIMESTAMP - INTERVAL '3 days', CURRENT_TIMESTAMP - INTERVAL '3 days'),
    (5, 'I found a legendary item yesterday! 🏆', 5, 2, CURRENT_TIMESTAMP - INTERVAL '3 days', CURRENT_TIMESTAMP - INTERVAL '3 days'),
    (6, 'Nice! What was it?', 2, 2, CURRENT_TIMESTAMP - INTERVAL '3 days', CURRENT_TIMESTAMP - INTERVAL '3 days'),
    (7, 'A rare sword with +50 damage!', 5, 2, CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days'),
    (8, 'That''s awesome! I''m still grinding for better gear.', 6, 2, CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days'),
    (9, 'Anyone want to team up for a dungeon run later?', 3, 2, CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days'),
    (10, 'I''m in! What time works for everyone?', 4, 2, CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP - INTERVAL '1 day'),
    (11, 'Around 8 PM EST would be perfect for me.', 3, 2, CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP - INTERVAL '1 day'),
    (12, 'Count me in as well!', 2, 2, CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP - INTERVAL '1 day'),
    (13, 'Just hit level 50! 🎉', 6, 1, CURRENT_TIMESTAMP - INTERVAL '12 hours', CURRENT_TIMESTAMP - INTERVAL '12 hours'),
    (14, 'Congratulations! That''s a big milestone!', 1, 1, CURRENT_TIMESTAMP - INTERVAL '10 hours', CURRENT_TIMESTAMP - INTERVAL '10 hours'),
    (15, 'Thanks! The grind was real but worth it.', 6, 1, CURRENT_TIMESTAMP - INTERVAL '8 hours', CURRENT_TIMESTAMP - INTERVAL '8 hours'),
    (16, 'Pro tip: Always save your gold for epic gear.', 5, 3, CURRENT_TIMESTAMP - INTERVAL '6 hours', CURRENT_TIMESTAMP - INTERVAL '6 hours'),
    (17, 'Good advice! I learned that the hard way.', 4, 3, CURRENT_TIMESTAMP - INTERVAL '4 hours', CURRENT_TIMESTAMP - INTERVAL '4 hours'),
    (18, 'Has anyone explored the new map area yet?', 2, 2, CURRENT_TIMESTAMP - INTERVAL '2 hours', CURRENT_TIMESTAMP - INTERVAL '2 hours'),
    (19, 'Yeah, it''s huge! Lots of hidden treasures.', 3, 2, CURRENT_TIMESTAMP - INTERVAL '1 hour', CURRENT_TIMESTAMP - INTERVAL '1 hour'),
    (20, 'This community is awesome! Thanks for all the help!', 6, 1, CURRENT_TIMESTAMP - INTERVAL '30 minutes', CURRENT_TIMESTAMP - INTERVAL '30 minutes');

-- Reset sequences to continue from the last inserted ID
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));
SELECT setval('channels_id_seq', (SELECT MAX(id) FROM channels));
SELECT setval('messages_id_seq', (SELECT MAX(id) FROM messages));
SELECT setval('message_reactions_id_seq', (SELECT COALESCE(MAX(id), 1) FROM message_reactions));
SELECT setval('direct_messages_id_seq', (SELECT COALESCE(MAX(id), 1) FROM direct_messages));
SELECT setval('direct_message_messages_id_seq', (SELECT COALESCE(MAX(id), 1) FROM direct_message_messages));
SELECT setval('direct_message_reactions_id_seq', (SELECT COALESCE(MAX(id), 1) FROM direct_message_reactions));
