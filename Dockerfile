# 1. Start with a lightweight Linux machine that already has Node.js v22 installed
FROM node:22-alpine

# 2. Create a folder inside the container where our app will live
WORKDIR /app

# 3. Copy ONLY the package files first (This is a Senior trick to make builds faster)
COPY package.json package-lock.json ./

# 4. Install the dependencies inside the container
RUN npm install --production

# 5. Copy the rest of your code from your laptop into the container
COPY . .

# 6. Expose the port your app runs on
EXPOSE 4000

# 7. The command to start your server
CMD ["node", "server.js"]