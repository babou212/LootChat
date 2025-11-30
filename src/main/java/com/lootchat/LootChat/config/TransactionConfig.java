package com.lootchat.LootChat.config;

import jakarta.persistence.EntityManagerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.orm.jpa.JpaTransactionManager;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;

/**
 * Transaction Manager Configuration.
 * 
 * Configures the JPA transaction manager as the primary transaction manager.
 * This is necessary because we also have a Kafka transaction manager,
 * and Spring needs to know which one to use by default.
 * 
 * - JPA Transaction Manager (Primary): Used for database operations
 * - Kafka Transaction Manager: Used for Kafka transactional messaging
 */
@Configuration
@EnableTransactionManagement
public class TransactionConfig {

    /**
     * JPA Transaction Manager for database operations.
     * Marked as @Primary so it's used by default for @Transactional annotations.
     */
    @Bean
    @Primary
    public PlatformTransactionManager transactionManager(EntityManagerFactory entityManagerFactory) {
        JpaTransactionManager transactionManager = new JpaTransactionManager();
        transactionManager.setEntityManagerFactory(entityManagerFactory);
        return transactionManager;
    }
}
