# LootChat

A modern, real-time chat application built with Java 25 (Spring Boot) and Nuxt 4 (Vue 3).

---

## 🚀 Key Tech Features

- **Java 25 LTS** & Spring Boot 3.5
- **Nuxt 4.2 (Vue 3, TypeScript)**
- **WebSocket + STOMP** for instant messaging
- **Apache Kafka** for scalable message delivery
- **PostgreSQL**
- **Redis** for caching/session
- **JWT Authentication** (Spring Security)
- **Role-based Access Control**
- **Admin Invite System**
- **Modern UI** with Nuxt UI
- **Kubernetes** for reliable performant deployments
- **FluxCD** for GitOPS 
- **Docker Compose** for full stack orchestration

---

## ⚡ Quick Start

1. **Clone & Setup**

   ```bash
   git clone https://github.com/yourusername/LootChat.git
   cd LootChat
   ```

2. **Start Services**

   ```bash
   docker compose -f compose-production.yaml up -d
   ```

3. **Configure Email (Optional)**

   Copy `.env.example` to `.env` and set your SMTP credentials:

   ```bash
   MAIL_HOST=smtp.gmail.com
   MAIL_PORT=587
   MAIL_USERNAME=your-email@gmail.com
   MAIL_PASSWORD=your-app-password
   ```

   For Gmail, create an [App Password](https://support.google.com/accounts/answer/185833).

---

## 📝 Features

- Registration/login with email confirmation
- Forgotten password resetting with OTP
- Real-time message retrieval
- Channel & user management
- Admin invites for user registrations
- Responsive, modern UI
- Email notifications
- Voice chat
- Screen Sharing

---

## 🛠️ Tech Stack

- **Backend:** Java 25, Spring Boot, Kafka, PostgreSQL, Redis
- **Frontend:** Nuxt 4, Vue 3, TypeScript, Nuxt UI
- **DevOps:** Docker, Kubernetes, FluxCD (GitOps), GitHub Actions

---

### Kubernetes + FluxCD (Production)

For production GitOps deployment with automatic updates:

1. See [Kubernetes Deployment Guide](DEPLOYMENT.md) for cluster setup
2. See [Flux GitOps Setup](flux/SETUP.md) for automated deployments

With Flux:
- Push code → GitHub Actions builds images → Flux auto-deploys
- No manual `kubectl` commands needed
- Git as the source of truth

---

## 📄 License

GPL-3.0. See `LICENSE` for details.

Copyright (c) 2025 babou212
