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

- MotionMRO: projects persist in browser IndexedDB (src/lib/projects.ts) because the spec requires local-only storage; AI agents run via one server function (src/lib/agents.functions.ts) and the client orchestrates the pipeline (src/lib/pipeline.ts) so progress shows live.

- MotionMRO AI: when the user saves an OpenAI token in /admin (localStorage, src/lib/settings.ts) agents call OpenAI directly via the server function; without it no token means AI is blocked with a message — the user requires their own OpenAI account, not the Lovable gateway.
- Video export: final MP4 renders run on a user-hosted render server (render-server/, Node + Puppeteer frame-seeking + FFmpeg or HyperFrames) because the app's Worker can't run ffmpeg; the in-tab recorder (src/lib/recorder.ts) is the fallback. Overlay HTML must expose a GSAP timeline on window.__tl for deterministic seeking; sound effects are WebAudio-synthesized (src/lib/sfx.ts) and rendered to WAV for the server.
- Render queue ownership belongs to the user-hosted Node render-server: persist inputs, metadata and MP4s on disk, acknowledge uploads before rendering, recover queued/running jobs on startup and bound concurrent workers; the browser keeps only local job references and polls progress so closing it cannot stop accepted jobs. Motion IA scenes are sequential full-frame layers over a black video.
- Every paid call (OpenAI tokens, transcription minutes, ElevenLabs characters) is logged per project in IndexedDB (src/lib/costs.ts) with raw units; USD is recomputed from the editable price table at read time so price changes apply retroactively.
