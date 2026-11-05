# Входът — продукционен образ
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npx next build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /app ./
EXPOSE 3000
# прилага схемата при старт, после пуска сървъра
CMD ["sh", "-c", "npx prisma db push --skip-generate && npx next start -p $PORT"]
