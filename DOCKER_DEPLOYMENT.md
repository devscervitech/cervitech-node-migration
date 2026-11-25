# Docker Deployment Guide

## Overview
This project includes Docker configuration for containerized deployment with MongoDB and Redis services.

## Files Included
- **Dockerfile**: Multi-stage build configuration for production deployment
- **docker-compose.yml**: Orchestration configuration for app, MongoDB, and Redis
- **.dockerignore**: Excludes unnecessary files from Docker build context

## Quick Start

### Using Docker Compose (Recommended)
```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop all services
docker-compose down

# Stop and remove all volumes
docker-compose down -v
```

### Using Docker CLI

#### Build the image
```bash
docker build -t cervitech-app:latest .
```

#### Run the container
```bash
docker run -d \
  -p 8000:8000 \
  --name cervitech-app \
  --env-file .env \
  cervitech-app:latest
```
The container needs the startup settings described below (MongoDB and token signing secrets). Without them it logs the error and exits with code 1.

`MONGODB_URI` must be reachable from inside the container. The example URI uses the Compose service name `mongodb`, which only resolves on the Compose network. For a standalone container, either point `MONGODB_URI` at a reachable host (for example MongoDB Atlas), or attach the container to the network where a `mongodb` container runs, e.g. `--network <project>_cervitech-network` (see `docker network ls`). `localhost` inside the container refers to the container itself, not the Docker host.

## Environment Variables Setup

Docker Compose will automatically load environment variables from a `.env` file in the project root directory.

### Step 1: Create .env file
```bash
# Copy the example file
cp .env.example .env

# Edit with your actual values
nano .env  # or use your preferred editor
```

### Step 2: Configure your .env file
`.env.example` is the complete, commented reference. The values below are the ones most deployments need to change.

```env
# Application (required to start)
NODE_ENV=production
# Port the API listens on inside the container
PORT=8000
# Host port docker-compose publishes (mapped to PORT)
APP_PORT=8000
# Exact number of reverse proxies in front of the API (0 = clients connect directly)
TRUST_PROXY_HOPS=0

# MongoDB (required to start: the API exits with code 1 if it cannot connect)
MONGO_ROOT_USERNAME=your_username
MONGO_ROOT_PASSWORD=your_secure_password
MONGO_PORT=27017
MONGODB_URI=mongodb://your_username:your_secure_password@mongodb:27017/cervitech?authSource=admin

# Token signing secrets (required to start: blank values stop startup)
APP_USER_JWT_SECRET=your_app_user_secret
BACKOFFICE_JWT_SECRET=your_backoffice_secret
GENERAL_TOKEN_SECRET=your_general_token_secret

# Backend URL used in email links
BACKEND_URL=https://api.example.com
# Frontend URL used in email links; its origin is the only CORS-allowed browser origin
FRONTEND_URL=https://app.example.com

# Email: Azure Communication Services (required for email delivery)
ACS_CONNECTION_STRING=your_azure_communication_services_connection_string
SENDER_EMAIL=noreply@cervitech.com

# Google Play billing (required to accept purchases)
# Service-account JSON key on a single line
GOOGLE_PLAY_SERVICE_ACCOUNT_KEY=
GOOGLE_PLAY_PACKAGE_NAME=com.cervitech.app
GOOGLE_PLAY_SUBSCRIPTION_IDS=premium_monthly,premium_yearly
```

Keep comments on their own lines. `docker run --env-file` does not strip trailing `# ...` text, so `PORT=8000 # comment` would become part of the value and stop startup.

What each group affects:
- **Application, MongoDB and token signing secrets** are required to start. A missing signing secret or an unreachable database stops startup.
- **Email (ACS):** both values are needed to send email (signup welcome, password-reset OTP, account deletion, monthly reminder). If they are missing, the API still starts and serves requests; only email sends fail, with an `EmailConfigurationError`.
- **Google Play:** all three values are needed to verify and accept purchases. If any is missing, the API still starts; purchases are rejected with `GOOGLE_PLAY_CONFIGURATION_MISSING`, and the subscription-sync job skips its runs.
- **`FRONTEND_URL`:** an invalid value stops startup. If it is unset in production, browsers on other origins cannot call the API (mobile clients are unaffected).
- `.env.example` also contains `JWT_SECRET` and `REDIS_URL`. Current application code does not read either; they are kept pending a decision.

### Step 3: Start services
```bash
docker-compose up -d
```

**Important**: Never commit `.env` to version control. It's already in `.dockerignore`.

## Production Deployment Tips

### 1. Security
- Use strong credentials for MongoDB (change defaults in docker-compose.yml)
- Implement secrets management (Docker Secrets or Kubernetes Secrets)
- Use environment-specific configuration files
- Don't commit `.env.prod` to version control

### 2. Volumes & Persistence
- MongoDB and Redis data persist in named volumes
- The API writes no files: logs go to stdout/stderr as structured JSON, so there is no log volume. View them with `docker compose logs -f app`, and configure retention or shipping in your container runtime or log collector
- Configure backup strategy for MongoDB data

### 3. Scaling
For production, consider:
- Using Docker Swarm or Kubernetes orchestration
- Separating database services to managed cloud services (Atlas, ElastiCache)
- Implementing load balancers
- Using health checks for service monitoring

### 4. Monitoring
- Application logs (stdout/stderr): `docker compose logs -f app`
- Database logs: `docker-compose logs -f mongodb`
- Liveness: `GET http://localhost:8000/health` returns 200 while the process serves HTTP. It checks no dependencies (the server only starts listening after MongoDB has connected).

### 5. Health checks, ports and runtime user
- The image's `HEALTHCHECK` runs `node dist/healthcheck.js`, which calls `GET /health` on `$PORT` (default 8000). It fails on connection errors, timeouts (3s) and any non-200 status, and allows a 30s start period.
- A failing healthcheck marks the container `unhealthy`. Plain Docker does not restart it for that; restarts depend on your orchestrator or restart policy.
- The API listens on `PORT` (default 8000). docker-compose publishes it on host port `APP_PORT` (default 8000).
- The container runs as the unprivileged `node` user. Application files are root-owned and read-only to it; logs go to stdout.
- Both stages use the same `node:<major>-alpine` base. The runtime stage applies `apk upgrade` (Alpine security fixes published after the base image was built) and removes npm, npx, corepack and yarn after installing production dependencies, so they are not available inside the running container. Use `node` directly, e.g. `docker exec -it cervitech-app node -e "..."`.
- If MongoDB is unreachable at startup, the process logs the error and exits with code 1 instead of idling.
- `SIGTERM` (`docker stop`) closes the HTTP server and the MongoDB connection, then exits.

## Troubleshooting

### Port already in use
```bash
# Change port mappings in docker-compose.yml
# Or kill existing process: lsof -ti:8000 | xargs kill
```

### Database connection issues
```bash
# Verify MongoDB is running
docker-compose ps

# Check MongoDB logs
docker-compose logs mongodb
```

### Container exits immediately
```bash
# View error logs
docker logs cervitech-app

# Or with compose
docker-compose logs app
```

## Building for Different Environments

### Development
```bash
docker build -t cervitech-app:dev --target builder .
```

### Production
```bash
docker build -t cervitech-app:prod .
```

### With Build Arguments
```bash
docker build --build-arg NODE_ENV=production -t cervitech-app:prod .
```

## Registry Deployment

### Push to Docker Hub
```bash
docker tag cervitech-app:latest yourusername/cervitech-app:latest
docker push yourusername/cervitech-app:latest
```

### Pull and Run
```bash
docker pull yourusername/cervitech-app:latest
docker run -d -p 8000:8000 yourusername/cervitech-app:latest
```

## Additional Resources
- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Node.js Docker Best Practices](https://github.com/nodejs/docker-node/blob/main/docs/README.md)
