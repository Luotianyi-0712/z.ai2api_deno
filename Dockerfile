FROM denoland/deno:alpine-1.46.3

WORKDIR /app

COPY . .

RUN deno cache main.ts

EXPOSE 8080

CMD ["deno", "run", "--allow-env", "--allow-net", "--allow-read", "main.ts"]
