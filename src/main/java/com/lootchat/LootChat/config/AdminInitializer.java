package com.lootchat.LootChat.config;

import com.lootchat.LootChat.entity.Role;
import com.lootchat.LootChat.entity.User;
import com.lootchat.LootChat.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class AdminInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${admin.username:admin}")
    private String adminUsername;

    @Value("${admin.email:admin@lootchat.local}")
    private String adminEmail;

    @Value("${admin.password:admin123}")
    private String adminPassword;

    @Value("${admin.firstName:System}")
    private String adminFirstName;

    @Value("${admin.lastName:Administrator}")
    private String adminLastName;

    @Override
    public void run(String... args) {
        // Check if any admin user exists
        boolean adminExists = userRepository.findAll().stream()
                .anyMatch(user -> user.getRole() == Role.ADMIN);

        if (!adminExists) {
            log.info("No admin user found. Creating default admin user...");
            
            User admin = User.builder()
                    .username(adminUsername)
                    .email(adminEmail)
                    .password(passwordEncoder.encode(adminPassword))
                    .firstName(adminFirstName)
                    .lastName(adminLastName)
                    .role(Role.ADMIN)
                    .isEnabled(true)
                    .isAccountNonExpired(true)
                    .isAccountNonLocked(true)
                    .isCredentialsNonExpired(true)
                    .build();

            userRepository.save(admin);
            
            log.info("=======================================================");
            log.info("DEFAULT ADMIN USER CREATED");
            log.info("Username: {}", adminUsername);
            log.info("Email: {}", adminEmail);
            log.info("Password: {}", adminPassword);
            log.info("=======================================================");
            log.warn("IMPORTANT: Please change the admin password after first login!");
            log.info("=======================================================");
        } else {
            log.info("Admin user already exists. Skipping admin creation.");
        }
    }
}
