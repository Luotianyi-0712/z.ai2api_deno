# Use the official Deno image
FROM denoland/deno:1.46.3

# Set working directory
WORKDIR /app

# Copy project files
COPY . .

# Cache dependencies
RUN deno cache --unstable main.ts

# Create non-root user
RUN addgroup --system --gid 1001 deno
RUN adduser --system --uid 1001 --ingroup deno deno

# Change ownership of the app directory
RUN chown -R deno:deno /app

# Switch to non-root user
USER deno

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD deno eval "fetch('http://localhost:8080/').then(r => r.ok ? Deno.exit(0) : Deno.exit(1))"

# Start the application
CMD ["deno", "run", "--allow-net", "--allow-env", "--allow-read", "main.ts"]
