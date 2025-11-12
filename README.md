# LootChat

A modern chat application built with Spring Boot and Nuxt, featuring real-time messaging capabilities and more.

## 🚀 Technology Stack

### Backend

- **Java 21** with Spring Boot 3.5.7
- **Spring Security** with JWT authentication
- **Spring Data JPA** with PostgreSQL
- **WebSocket** for real-time communication

### Frontend

- **Nuxt 4.2** (Vue.js framework)
- **Nuxt UI** for component library
- **TypeScript** for type safety

### Database

- **PostgreSQL** (containerized via Docker Compose)

### Messaging

- **Apache Kafka** (containerized via Docker Compose)

## 📋 Prerequisites

- Java 25 JDK
- Node.js 18+ (recommended: latest LTS)
- pnpm 10.19.0+
- Docker and Docker Compose
- PostgreSQL (or use Docker Compose setup)

## 🛠️ Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/LootChat.git
cd LootChat
```

### 2. Database Setup

Start the PostgreSQL database using Docker Compose:

```bash
docker-compose up -d
```

Or set up environment variables for an existing PostgreSQL instance:

```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=lootchat
```

### 3. Backend Setup

The backend uses Gradle for dependency management:

```bash
# Make gradlew executable (Unix-based systems)
chmod +x gradlew

# Build the project
./gradlew build

# Run the application
./gradlew bootRun
```

The backend API will be available at `http://localhost:8080`

#### Kafka (Local)

The repo includes a single-node Kafka broker via Docker Compose. When running the backend locally, Spring Boot will connect to `localhost:9092` by default. To override, set:

```env
KAFKA_BOOTSTRAP_SERVERS=localhost:9092
```

Publish a test message via the backend endpoint:

```bash
curl -X POST http://localhost:8080/api/kafka/publish \
  -H 'Content-Type: application/json' \
  -d '{"message":"hello from LootChat"}'
```

This sends to the default topic `lootchat.chat.messages`. Check backend logs for consumer output.

### 4. Frontend Setup

Navigate to the frontend directory and install dependencies:

```bash
cd frontend
pnpm install

# Run development server
pnpm dev
```

The frontend will be available at `http://localhost:3000`

## ⚙️ Configuration

### Backend Configuration

Edit as needed `src/main/resources/application.properties`:

```properties
# Database
spring.datasource.url=jdbc:postgresql://localhost:5432/lootchat
spring.datasource.username=postgres
spring.datasource.password=postgres

# JWT Secret (Change in production!)
jwt.secret=your-secret-key
jwt.expiration=86400000

# Kafka
spring.kafka.bootstrap-servers=localhost:9092
spring.kafka.consumer.group-id=lootchat-dev-group
app.kafka.topics.chat=lootchat.chat.messages
```

### Admin User Setup

On first boot, the application automatically creates a default admin user if no admin exists. Configure the admin credentials via environment variables:

```env
ADMIN_USERNAME=admin
ADMIN_EMAIL=admin@lootchat.local
ADMIN_PASSWORD=ChangeMe123!
ADMIN_FIRST_NAME=System
ADMIN_LAST_NAME=Administrator
```

**⚠️ IMPORTANT**:

- Change the default admin password immediately after first login
- In production, always set secure credentials via environment variables
- The admin user is only created once on first boot if no admin exists

Default credentials (development):

- Username: `admin`
- Password: `admin123` (dev) or `ChangeMe123!` (prod)

## 🎯 Features

- **User Authentication**: Secure registration and login with JWT tokens
- **Real-time Chat**: WebSocket-based instant messaging
- **User Roles**: Role-based access control
- **Admin Invites**: Admins can invite users via one time links
- **Modern UI**: Responsive design with Nuxt UI components

## 🔧 Development

### Running Tests

Backend tests:

```bash
./gradlew test
```

Frontend type checking:

```bash
cd frontend
pnpm typecheck
```

Frontend linting:

```bash
cd frontend
pnpm lint
```

### Building for Production

Backend:

```bash
./gradlew build
```

Frontend:

```bash
cd frontend
pnpm build
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the GNU General Public License v3.0 (GPL-3.0).

See the `LICENSE` file for the full text.

Copyright (c) 2025 babou212
