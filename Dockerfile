FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install
# RUN npm ci

# Copy application code
COPY . .

# Expose ports
EXPOSE 3000 5173

# Default command (can be overridden in compose)
CMD ["npm", "run", "dev"]

