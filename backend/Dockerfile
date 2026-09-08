# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY shared/package.json shared/package.json
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY . .
RUN npm run build:shared
RUN npm run db:generate --workspace=backend
RUN npm run build --workspace=backend
RUN npm prune --omit=dev

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S lms && adduser -S lms -G lms
COPY --chown=lms:lms --from=build /app/package.json /app/package-lock.json ./
COPY --chown=lms:lms --from=build /app/node_modules ./node_modules
COPY --chown=lms:lms --from=build /app/backend/package.json ./backend/package.json
COPY --chown=lms:lms --from=build /app/backend/prisma.config.ts ./backend/prisma.config.ts
COPY --chown=lms:lms --from=build /app/backend/dist ./backend/dist
COPY --chown=lms:lms --from=build /app/backend/prisma ./backend/prisma
COPY --chown=lms:lms --from=build /app/backend/src/generated ./backend/src/generated
COPY --chown=lms:lms --from=build /app/shared/package.json ./shared/package.json
COPY --chown=lms:lms --from=build /app/shared/dist ./shared/dist
COPY --chown=lms:lms backend/docker-entrypoint.sh ./backend/docker-entrypoint.sh
RUN chmod +x ./backend/docker-entrypoint.sh
USER lms
EXPOSE 4000
ENTRYPOINT ["./backend/docker-entrypoint.sh"]
CMD ["npm", "run", "start:prod", "--workspace=backend"]
