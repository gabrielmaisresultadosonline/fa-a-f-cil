<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

- MotionMRO SaaS stores owner-scoped project JSON and private blobs through cloudRepository on the selected backend; Cloud remains the preview default, while deploy/local.mjs selects an isolated local PostgreSQL/Auth/Storage stack without changing generated clients or copying unowned data.

- MotionMRO AI uses the studio's own OpenAI account through authenticated server functions; admin-saved tokens are AES-GCM encrypted in a service-only table and never returned to clients, so customer accounts cannot expose provider credentials.
- Video export: final MP4 renders run on a user-hosted render server (render-server/, Node + Puppeteer frame-seeking + FFmpeg) because the app's Worker can't run ffmpeg; the app exposes only this FFmpeg server path, with no engine or download-source selectors in the UI. Overlay HTML must expose a GSAP timeline on window.__tl for deterministic seeking; sound effects are WebAudio-synthesized (src/lib/sfx.ts) and rendered to WAV for the server.
- Layer editor timing and uploaded audio persist as owner-scoped Cloud records and private blobs; yt-dlp/UVR media stays owner-scoped on the render server, which creates one filtered WAV mix for both engines so preview and export use identical edits.

- Render queue ownership belongs to the user-hosted Node server: persist inputs and metadata, acknowledge before rendering, recover on startup and bound workers; Cloud stores customer job references, all render/media requests verify Auth and owner, and completed MP4s expire on server timers even with browsers closed.
- Paid OpenAI calls and transcription record raw units server-side per customer, project and generation; admin-only SQL aggregates recalculate USD with the editable price table to avoid trusting browser costs.
- Credit and trial budgets are reserved atomically by service-only database functions; AI endpoints verify an active reservation, bound calls and never accept client-set balances, to prevent concurrent overspending.
- InfinitePay webhooks are notification-only: verify the real order and amount through payment_check before atomic idempotent credit release, because the supplied provider documentation has no webhook signature.
- Persist bounded payment checks on the Node render server with per-order capabilities, never customer session tokens; public verification returns status only and requires the capability, so closing the checkout cannot stop accepted checks.
- Use _authenticated for private studio routes and its nested _admin role gate for administration; every server operation independently validates ownership or role because route gates do not secure endpoints.
- Store an immutable creation-config snapshot with new Motion projects; request viewing and reuse use that snapshot with legacy config fallback so later edits do not erase the original input.
- Build Motion generation briefs through the shared projectBrief helper, excluding organizational names, and append shared creation constraints to every agent's system prompt so metadata stays outside rendered content.
- Apply sceneLayout's idempotent canvas guard to preview, HTML export and server uploads; validate new Motion/Overlay HTML in a sandboxed iframe and allow one logged same-model repair before rejecting it so layout quality is not assumed from model price.
- Scope public-page lighting and motion styles under public-experience; share MotionShowcase for the animated composition so studio styling and account operations remain unchanged.
- Local development tooling must reject remote backend URLs, pass service credentials only to server processes, preserve the local encryption key and keep schema snapshots in deploy/local; development stacks are not VPS production deployments.
- VPS self-hosting uses deploy/vps-install.sh with a Node production build and same-origin Nginx proxy to local Auth/REST/Storage; deploy/configure-domain.sh enables HTTPS and proxies /render/ to the local renderer, keeping privileged keys and backend ports internal.
- After the first install, code updates go through deploy/update-vps.sh (pull, bun install, migrations only when new migration files arrived, production build, restart both services) so operators never hand-run git or build commands that could leave a half-updated server.
- Share Overlay direction and plan normalization in overlayDirection; center new/regenerated compositions and mix full-frame dimming with opaque solid backgrounds, without rewriting saved HTML on load, so smaller models cannot fall back to corner-only plans.
- Browser-generated entity IDs use createId from uuid with cryptographic getRandomValues fallback, because initial HTTP/IP hosting does not expose crypto.randomUUID; security capabilities remain server-generated.
- YouTube downloads use explicit Node/EJS, a loopback-only bgutil PO-token provider (datacenter IPs get bot checks even with cookies) and same-call title extraction; upgrade yt-dlp[default] through VPS tooling, isolate cookie jars per download and sanitize extractor failures so sessions are never exposed or concurrently rewritten.
- The local YouTube companion was removed from the product: the editor downloads YouTube audio only through the server with the admin's configured cookies, and customers add audio by file or microphone. Cookie/browser access never reaches the app or VPS.
- Admin-supplied YouTube sessions stay AES-GCM encrypted in the render server's private state; authenticated role checks protect status/upload/toggle/delete, status never returns secrets, and new uploads require HTTPS or local transport. Disabling overrides legacy environment cookies for future downloads.
- Overlay creation reports real byte progress through owner-authorized signed storage uploads; wait for storage and project confirmation before starting AI, so progress never implies a saved project prematurely.
- Persist optional Overlay observations separately from generated style and forward them to planning, animation and repair, so creative preferences survive regeneration.
- Regeneration percentages reflect milestones, not elapsed time; report 100 only after saving and finalization.
