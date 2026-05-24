FROM mcr.microsoft.com/playwright:v1.59.1-jammy

WORKDIR /app

# Install dependencies first for better Docker layer caching.
COPY package*.json ./
RUN npm ci

# Copy project files.
COPY . .

# Ensure containerized runs are headless/CI-friendly by default.
ENV CI=true

# Default command: run Playwright test suite.
CMD ["npx", "playwright", "test"]
