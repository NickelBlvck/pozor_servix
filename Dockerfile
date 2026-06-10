FROM node:24-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY index.html vite.config.js ./
COPY src ./src
COPY locale ./locale
COPY public ./public
RUN npm run build

FROM node:24-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

COPY server.js ./
COPY locale ./locale
COPY --from=build /app/dist ./dist

ENV NODE_ENV=production
ENV PORT=3000
ENV TELEGRAM_NOTIFY_URL=
ENV APP_TIMEZONE=Europe/Moscow
EXPOSE 3000

CMD ["node", "server.js"]
