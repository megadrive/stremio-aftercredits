
FROM pnpm:latest

WORKDIR /app

COPY ./package.json ./
COPY ./pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm build

EXPOSE 3000
