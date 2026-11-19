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
  -e NODE_ENV=production \
  cervitech-app:latest
```

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
```env
# Application Configuration
NODE_ENV=production
APP_PORT=8000

# MongoDB Configuration
MONGO_ROOT_USERNAME=your_username
MONGO_ROOT_PASSWORD=your_secure_password
MONGO_PORT=27017
MONGODB_URI=mongodb://your_username:your_secure_password@mongodb:27017/cervitech?authSource=admin

# Redis Configuration
REDIS_URL=redis://redis:6379
REDIS_PORT=6379

# JWT Configuration
JWT_SECRET=your_jwt_secret_key

# FCM Configuration
FCM_SERVER_KEY=your_fcm_server_key

# Email Service
SENDGRID_API_KEY=your_sendgrid_api_key
```

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
- Logs are mounted to local `./logs` directory
- Configure backup strategy for MongoDB data

### 3. Scaling
For production, consider:
- Using Docker Swarm or Kubernetes orchestration
- Separating database services to managed cloud services (Atlas, ElastiCache)
- Implementing load balancers
- Using health checks for service monitoring

### 4. Monitoring
- Application logs: `docker-compose logs -f app`
- Database logs: `docker-compose logs -f mongodb`
- Health endpoint: `GET http://localhost:8000/health`

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
