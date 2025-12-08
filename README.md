# Learning Platform Backend

A production-ready educational learning platform backend built with Node.js, TypeScript, and Fastify. This system implements a modular monolith architecture supporting video streaming, real-time assessments, file management, multi-channel communication, progress tracking, payment processing, and advanced analytics.

## 🏗️ Architecture Overview

### Modular Monolith Pattern

The application follows a modular monolith architecture where each business domain is self-contained with its own infrastructure, domain, application, and presentation layers, while maintaining the ability to communicate across modules within a single deployable application.

### Domain Modules

- **Users**: Authentication, authorization, user profile management, role-based access control
- **Courses**: Course creation, module and lesson management, course publishing, course discovery
- **Content**: File uploads, video processing, content delivery, CDN integration
- **Assessments**: Quiz and assignment creation, student submissions, grading, feedback
- **Enrollments**: Student-course relationships, progress tracking, certificate generation
- **Communication**: Direct messaging, discussion forums, announcements, real-time chat
- **Notifications**: Multi-channel notification delivery (email, push, in-app), preference management
- **Analytics**: Data aggregation, metrics calculation, reporting, dashboards
- **Payments**: Stripe integration, transaction processing, refunds, subscription management
- **Search**: Elasticsearch integration, full-text search, faceted filtering

### Technology Stack

- **Framework**: Fastify 4.x - High-performance web framework
- **Language**: TypeScript 5.x with strict mode
- **Database**: PostgreSQL 15+ with Drizzle ORM
- **Cache**: Redis 7+ for sessions, API caching, and job queues
- **Search**: Elasticsearch 8+ for full-text search
- **Background Jobs**: BullMQ for async processing
- **Real-time**: Socket.io 4+ with Redis adapter
- **Storage**: AWS S3 with CloudFront CDN
- **Video Processing**: AWS MediaConvert
- **Payments**: Stripe API
- **Email**: SendGrid or AWS SES
- **API**: GraphQL with Apollo Server

## 🚀 Getting Started

### Prerequisites

- Node.js >= 20.0.0
- npm >= 10.0.0
- Docker and Docker Compose (for local development)
- PostgreSQL 15+ (or use Docker)
- Redis 7+ (or use Docker)
- Elasticsearch 8+ (or use Docker)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd learning-platform-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start local development services with Docker**
   ```bash
   npm run docker:up
   ```

   This will start:
   - PostgreSQL on port 5432
   - Redis on port 6379
   - Elasticsearch on port 9200
   - PgAdmin on port 5050 (optional)
   - Redis Commander on port 8081 (optional)

5. **Run database migrations**
   ```bash
   npm run db:migrate
   ```

6. **Start the development server**
   ```bash
   npm run dev
   ```

   The server will start on `http://localhost:3000`

### Docker Services Management

```bash
# Start all services
npm run docker:up

# Stop all services
npm run docker:down

# View logs
npm run docker:logs
```

## 📁 Project Structure

```
learning-platform-backend/
├── src/
│   ├── modules/                    # Domain modules
│   │   ├── users/                  # Users module
│   │   │   ├── infrastructure/     # Data access, external services
│   │   │   ├── domain/             # Business entities, value objects
│   │   │   ├── application/        # Use cases, application services
│   │   │   ├── presentation/       # GraphQL resolvers, REST controllers
│   │   │   └── tests/              # Module-specific tests
│   │   ├── courses/                # Courses module
│   │   ├── content/                # Content module
│   │   ├── assessments/            # Assessments module
│   │   ├── enrollments/            # Enrollments module
│   │   ├── communication/          # Communication module
│   │   ├── notifications/          # Notifications module
│   │   ├── analytics/              # Analytics module
│   │   ├── payments/               # Payments module
│   │   └── search/                 # Search module
│   ├── shared/                     # Shared utilities and types
│   │   ├── types/                  # Common TypeScript types
│   │   ├── utils/                  # Utility functions
│   │   ├── middleware/             # Shared middleware
│   │   └── errors/                 # Error classes
│   ├── infrastructure/             # Infrastructure layer
│   │   ├── database/               # Database configuration
│   │   ├── cache/                  # Redis configuration
│   │   ├── search/                 # Elasticsearch configuration
│   │   ├── storage/                # S3 configuration
│   │   ├── queue/                  # BullMQ configuration
│   │   └── websocket/              # Socket.io configuration
│   ├── config/                     # Application configuration
│   └── index.ts                    # Application entry point
├── migrations/                     # Database migrations
├── tests/                          # Integration and E2E tests
├── scripts/                        # Utility scripts
├── logs/                           # Application logs
├── public/                         # Static assets
├── docker-compose.yml              # Docker services configuration
├── tsconfig.json                   # TypeScript configuration
├── package.json                    # Dependencies and scripts
└── README.md                       # This file
```

## 🛠️ Development

### Available Scripts

```bash
# Development
npm run dev              # Start development server with hot reload

# Building
npm run build            # Compile TypeScript to JavaScript

# Production
npm start                # Start production server

# Code Quality
npm run lint             # Run ESLint
npm run lint:fix         # Fix ESLint errors
npm run format           # Format code with Prettier
npm run format:check     # Check code formatting

# Testing
npm test                 # Run tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Run tests with coverage

# Database
npm run db:generate      # Generate database migrations
npm run db:migrate       # Run database migrations
npm run db:studio        # Open Drizzle Studio (database GUI)

# Docker
npm run docker:up        # Start Docker services
npm run docker:down      # Stop Docker services
npm run docker:logs      # View Docker logs
```

### Code Style

This project uses:
- **ESLint** for code linting with TypeScript-specific rules
- **Prettier** for code formatting
- **Strict TypeScript** configuration for type safety

### Testing Strategy

The project implements a dual testing approach:

1. **Unit Tests**: Verify specific examples, edge cases, and error conditions
2. **Property-Based Tests**: Verify universal properties that should hold across all inputs
3. **Integration Tests**: Test complete workflows and API endpoints
4. **End-to-End Tests**: Simulate real user scenarios

## 🔒 Security

- JWT-based authentication with access and refresh tokens
- bcrypt password hashing with cost factor 12
- Role-based access control (RBAC)
- Input validation using JSON Schema
- SQL injection prevention through parameterized queries
- XSS protection through HTML sanitization
- Rate limiting per IP and authenticated user
- HTTPS enforcement with TLS 1.2+
- Sensitive data redaction in logs

## 📊 Monitoring and Observability

- Structured logging with Winston
- Request logging with unique request IDs
- Health check endpoints
- Performance metrics tracking
- Error tracking and alerting
- CloudWatch integration for production

## 🚢 Deployment

### Environment Configuration

The application supports multiple environments:
- **Development**: Local development with hot reload
- **Staging**: Pre-production testing environment
- **Production**: Production environment with optimizations

### Infrastructure as Code

Use Terraform or CloudFormation to provision AWS resources:
- EC2 or ECS for application hosting
- RDS for PostgreSQL
- ElastiCache for Redis
- Elasticsearch Service
- S3 for file storage
- CloudFront for CDN
- MediaConvert for video processing

### CI/CD Pipeline

The deployment pipeline includes:
1. Linting and code quality checks
2. Unit and integration tests
3. Security scanning
4. Docker image building
5. Deployment to target environment
6. Health checks and smoke tests
7. Automatic rollback on failure

## 📝 API Documentation

- **GraphQL Playground**: Available at `/graphql` (development only)
- **REST API Docs**: Available at `/docs` (if enabled)

## 🤝 Contributing

1. Follow the established code style and architecture patterns
2. Write tests for new features
3. Update documentation as needed
4. Ensure all tests pass before submitting
5. Follow the modular monolith architecture principles

## 📄 License

MIT

## 🆘 Support

For issues and questions, please open an issue in the repository.
