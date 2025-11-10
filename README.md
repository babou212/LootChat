# LootChat

A modern chat application built with Spring Boot and Nuxt, featuring real-time messaging capabilities and more.

## 🚀 Technology Stack

### Backend

- **Java 25** with Spring Boot 3.5.7
- **Spring Security** with JWT authentication
- **Spring Data JPA** with PostgreSQL
- **WebSocket** for real-time communication

### Frontend

- **Nuxt 4.2** (Vue.js framework)
- **Nuxt UI** for component library
- **TypeScript** for type safety

### Database

- **PostgreSQL** (containerized via Docker Compose)

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
```

## 🎯 Features

- **User Authentication**: Secure registration and login with JWT tokens
- **Real-time Chat**: WebSocket-based instant messaging
- **User Roles**: Role-based access control
- **Modern UI**: Responsive design with Nuxt UI components

## 📁 Project Structure

```plaintext
LootChat/
├── build.gradle                # Gradle build config
├── settings.gradle             # Gradle settings
├── compose.yaml                # Docker / services configuration
├── gradlew                     # Gradle wrapper (Unix)
├── gradlew.bat                 # Gradle wrapper (Windows)
├── gradle/
│   └── wrapper/                # Wrapper JAR & properties
├── LICENSE
├── README.md
├── src/                        # Spring Boot backend
│   ├── main/
│   │   ├── java/com/lootchat/LootChat/
│   │   │   ├── LootChatApplication.java  # Application entrypoint
│   │   │   ├── controller/               # REST controllers
│   │   │   ├── dto/                      # Data transfer objects
│   │   │   ├── entity/                   # JPA entities
│   │   │   ├── repository/               # Spring Data repositories
│   │   │   ├── security/                 # Security & JWT logic
│   │   │   └── service/                  # Business logic services
│   │   └── resources/
│   │       ├── application.properties    # Backend configuration
│   │       ├── data.sql                  # SQL initialization scripts
│   │       ├── static/                   # Static assets
│   │       └── templates/                # Server-side templates
│   └── test/                             # Backend tests
│       └── java/com/lootchat/LootChat/
│           ├── BCryptTest.java
│           ├── GeneratePasswordHash.java
│           └── LootChatApplicationTests.java
├── frontend/                    # Nuxt 4 application
│   ├── package.json
│   ├── pnpm-lock.yaml
│   ├── pnpm-workspace.yaml
│   ├── nuxt.config.ts
│   ├── tsconfig.json
│   ├── eslint.config.mjs
│   ├── renovate.json            # Renovate bot configuration
│   ├── app/
│   │   ├── app.vue              # Root Vue component
│   │   ├── app.config.ts        # App-level configuration
│   │   ├── error.vue            # Error page component
│   │   ├── assets/
│   │   │   └── css/
│   │   │       └── main.css     # Global styles
│   │   ├── components/
│   │   │   ├── ChannelSidebar.vue
│   │   │   ├── EmojiPicker.vue
│   │   │   ├── GifPicker.vue
│   │   │   ├── Logo.vue
│   │   │   ├── MessageList.vue
│   │   │   └── UserMenu.vue
│   │   ├── composables/         # Front-end composables
│   │   │   └── useAuth.ts
│   │   ├── layouts/
│   │   │   └── default.vue
│   │   ├── middleware/
│   │   │   ├── auth.ts
│   │   │   └── transitions.global.ts
│   │   ├── pages/
│   │   │   ├── index.vue
│   │   │   ├── login.vue
│   │   │   └── profile.vue
│   │   ├── plugins/
│   │   │   └── auth-init.ts
│   │   └── utils/
│   │       └── api.ts
│   ├── server/
│   │   ├── api/                 # Server API endpoints
│   │   ├── routes/
│   │   │   └── auth/            # Auth-related server routes
│   │   └── utils/
│   ├── shared/
│   │   └── types/
│   │       ├── auth.d.ts
│   │       ├── chat.d.ts
│   │       └── user.d.ts
│   ├── stores/
│   │   └── auth.ts              # Pinia auth store
│   ├── patches/                 # Local patch overrides
│   │   └── @nuxt__vite-builder.patch
│   └── public/                  # Public static assets
```

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
