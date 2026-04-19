<p align="center">
  <a href="https://www.medusajs.com">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://user-images.githubusercontent.com/59018053/229103275-b5e482bb-4601-46e6-8142-244f531cebdb.svg">
    <source media="(prefers-color-scheme: light)" srcset="https://user-images.githubusercontent.com/59018053/229103726-e5b529a3-9b3f-4970-8a1f-c6af37f087bf.svg">
    <img alt="Medusa logo" src="https://user-images.githubusercontent.com/59018053/229103726-e5b529a3-9b3f-4970-8a1f-c6af37f087bf.svg">
    </picture>
  </a>
</p>
<h1 align="center">
  Medusa
</h1>

<h4 align="center">
  <a href="https://docs.medusajs.com">Documentation</a> |
  <a href="https://www.medusajs.com">Website</a>
</h4>

<p align="center">
  Building blocks for digital commerce
</p>

## Project Onboarding

If you are joining this repository, start with [docs/project-onboarding.md](../docs/project-onboarding.md) for a practical explanation of the backend, storefront, and POS app.

<p align="center">
  <a href="https://github.com/medusajs/medusa/blob/master/CONTRIBUTING.md">
    <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat" alt="PRs welcome!" />
  </a>
    <a href="https://www.producthunt.com/posts/medusa"><img src="https://img.shields.io/badge/Product%20Hunt-%231%20Product%20of%20the%20Day-%23DA552E" alt="Product Hunt"></a>
  <a href="https://discord.gg/xpCwq3Kfn8">
    <img src="https://img.shields.io/badge/chat-on%20discord-7289DA.svg" alt="Discord Chat" />
  </a>
  <a href="https://twitter.com/intent/follow?screen_name=medusajs">
    <img src="https://img.shields.io/twitter/follow/medusajs.svg?label=Follow%20@medusajs" alt="Follow @medusajs" />
  </a>
</p>

## Compatibility

This starter is compatible with versions >= 2 of `@medusajs/medusa`. 

## Getting Started

Visit the [Quickstart Guide](https://docs.medusajs.com/learn/installation) to set up a server.

Visit the [Docs](https://docs.medusajs.com/learn/installation#get-started) to learn more about our system requirements.

For full backend documentation, see `backend/docs/README.md`.

## Staging

Use the staging compose stack to run the backend with a production-like service topology.

1. Create or update `backend/.env.staging` with your secrets and service URLs.
2. Start the stack with:

   ```bash
   docker-compose -f docker-compose.staging.yml up --build
   ```

3. The backend will be available at `http://localhost:9000` and Ragflow at `http://localhost:8080`.

4. Enable telemetry in staging by setting `ENABLE_OTEL=true` and configuring `OTEL_EXPORTER`.

## Production

Use the production compose stack for VPS deployment on Hetzner or any Linux host.

1. Create or update `backend/.env.prod` with your production domain values, secrets, and API keys.
2. Add the required GitHub secrets for deployment:
   - `VPS_HOST`
   - `VPS_USER`
   - `VPS_SSH_KEY`
   - `VPS_DEPLOY_PATH`
   - `VPS_KNOWN_HOSTS`
3. Deploy using the production compose stack:

   ```bash
   docker-compose -f docker-compose.prod.yml up --build -d
   ```

4. On GitHub, the production deploy workflow is available at `.github/workflows/backend-prod-deploy.yml` and runs on pushes to `main`.

5. The backend is reverse-proxied through Nginx on port `80`. Your public API and admin entry points are served by the same proxied backend endpoint.

## Media Storage

Shared POS media is stored in Cloudflare R2. The mobile app still caches captured files locally for offline work, but the backend upload endpoint writes the permanent copy to object storage and stores the returned URL in product, profile, and receipt records.

Set these variables in your backend environment before using shared image uploads:

- `CLOUDFLARE_R2_ACCOUNT_ID`
- `CLOUDFLARE_R2_ACCESS_KEY_ID`
- `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
- `CLOUDFLARE_R2_BUCKET_NAME`
- `CLOUDFLARE_R2_PUBLIC_BASE_URL`
- `CLOUDFLARE_R2_ENDPOINT` (optional; defaults to `https://<account-id>.r2.cloudflarestorage.com`)

`CLOUDFLARE_R2_PUBLIC_BASE_URL` should be the public host that serves your media, for example a custom domain such as `https://media.example.com`.

### Blue/green deployment

The prod stack uses a blue/green deployment model:

- `backend_blue` and `backend_green` are both defined in `docker-compose.prod.yml`.
- `deploy/bluegreen-deploy.sh` builds the next inactive color, boots it, waits for a healthy `/health` response, then switches traffic via Nginx.
- The previous color remains available until the switch is complete, so rollback can happen without downtime.

### Rollback strategy

Use `deploy/rollback.sh` to move traffic back to the previously active color if the new release is unhealthy or broken.

- The rollback script brings the previous backend back online if needed.
- It updates `deploy/nginx/active-backend.conf` and reloads Nginx.
- The old container remains available after deployment so rollback is fast.

## Admin link exposure

To expose admin access correctly in production:

- Set `ADMIN_CORS` and `AUTH_CORS` in `backend/.env.prod` to your admin UI domain.
- Set `STORE_CORS` to your storefront domain.
- Use `ADMIN_URL=https://your-admin.example.com` in `backend/.env.prod` as a reference for your admin UI host.
- Medusa backend API requests are served from `https://your-backend.example.com`; admin UI should connect to that host through CORS.

## What is Medusa

Medusa is a set of commerce modules and tools that allow you to build rich, reliable, and performant commerce applications without reinventing core commerce logic. The modules can be customized and used to build advanced ecommerce stores, marketplaces, or any product that needs foundational commerce primitives. All modules are open-source and freely available on npm.

Learn more about [Medusa’s architecture](https://docs.medusajs.com/learn/introduction/architecture) and [commerce modules](https://docs.medusajs.com/learn/fundamentals/modules/commerce-modules) in the Docs.

## Build with AI Agents

### Claude Code Plugin

If you use AI agents like Claude Code, check out the [medusa-dev Claude Code plugin](https://github.com/medusajs/medusa-claude-plugins).

### Other Agents

If you use AI agents other than Claude Code, copy the [skills directory](https://github.com/medusajs/medusa-claude-plugins/tree/main/plugins/medusa-dev/skills) into your agent's relevant `skills` directory.

### MCP Server

You can also add the MCP server `https://docs.medusajs.com/mcp` to your AI agents to answer questions related to Medusa. The `medusa-dev` Claude Code plugin includes this MCP server by default.

## Community & Contributions

The community and core team are available in [GitHub Discussions](https://github.com/medusajs/medusa/discussions), where you can ask for support, discuss roadmap, and share ideas.

Join our [Discord server](https://discord.com/invite/medusajs) to meet other community members.

## Other channels

- [GitHub Issues](https://github.com/medusajs/medusa/issues)
- [Twitter](https://twitter.com/medusajs)
- [LinkedIn](https://www.linkedin.com/company/medusajs)
- [Medusa Blog](https://medusajs.com/blog/)
