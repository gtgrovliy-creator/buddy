FROM node:20-alpine

WORKDIR /app

# Install frontend dependencies
COPY frontend/package*.json ./frontend/
COPY frontend/ ./frontend/
RUN cd frontend && npm install

# Install backend dependencies
COPY backend/package*.json ./backend/
COPY backend/ ./backend/
RUN cd backend && npm install

# Build frontend
RUN cd frontend && npm run build

EXPOSE 8080
CMD ["node", "backend/server.ts"]
