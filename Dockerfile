FROM node:18-alpine

# Set the Shopify API key as an environment variable
ENV SHOPIFY_API_KEY=$SHOPIFY_API_KEY

# Expose the desired port
EXPOSE 8081

# Set the working directory
WORKDIR /app

# Copy the app source code
COPY web .

# Install dependencies
RUN npm install

# Set the environment variable and run the frontend build
RUN cd frontend && npm install && npm run build

# Start the app
CMD ["npm", "run", "serve"]
