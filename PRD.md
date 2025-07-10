# Product Requirements Document

## 1. Vision

A frictionless web app that lets any user paste a YouTube URL and immediately chat with the video. Logged‑in users can queue a full channel for indexing and receive an email once the channel is ready for conversational search. The early product focuses on speed, clean design, and accurate timestamp citations. Future phases will layer in multi‑channel search, multimodal scene detection, and enterprise controls, but this PRD covers only **Stage A** (single video chat) and **Stage B** (single channel chat).

## 2. Guiding Principles

* Ship the smallest thing that feels magical within seven seconds of paste.
* Avoid user confusion by giving relentless feedback during every async task.
* Pure web, built with Next.js and TypeScript.

## 3. Success Targets

| Metric                                     | Week 4 Target               |
| ------------------------------------------ | --------------------------- |
| Day‑seven retention for free video chat    | 10 percent                  |
| Time to first answer after paste           | < 7 s P95                   |
| Channel index completion notification time | < 30 m P95                  |
| Paid conversion once credits launch        | 2 percent of weekly actives |

## 4. Personas

1. **Speed‑reader**: learner who binge‑watches tech talks and wants rapid recall.
2. **Creator‑librarian**: YouTuber who needs to answer fan questions without re‑watching old uploads.

## 5. Functional Requirements

### Stage A: Single Video Chat

* Landing page hero has two clearly labeled fields: **Paste YouTube link** and **Ask your first question**. The right side of the hero shows a prominent **"Log in to search entire channels & save chats"** call‑to‑action button. When a URL is pasted we instantly fetch the video title and thumbnail via YouTube oEmbed, display them for confirmation, check Supabase for a cached transcript, and show a progress bar if we need to download. Under the fields we surface clickable suggestion bubbles such as *"Summarize this video"* or *"Give me the key takeaways"* to reduce friction.
* Accept any public YouTube URL, extract VideoID, request transcript via YouTube API. Fallback to `youtu.be` short links.
* Show skeleton loader and progress spinner to reassure the user while the transcript downloads.
* Present split‑screen route `/watch/{id}` once transcript loads.

  * **Left pane**: embedded YouTube player set to `start=0`, width 50 percent.
  * **Right pane**: chat thread using shadcn Message and Input components.
  * Under the player render a horizontal scroll list of thumbnail snapshots at citation timestamps.
  * Clicking a thumbnail seeks the player and highlights the border of that thumbnail with a border color
* **One‑video rule**: the free session can hold exactly one active video at a time; the header bar shows a subtle banner *"Multi‑video search coming soon"*.
* Each answer from GPT‑4o includes inline numeric citations like `[1]` which map to timestamps in `hh:mm:ss` format and highlight the matching thumbnail.

### Stage B: Channel Chat

* After Google login via Clerk a **Add Channel** dialog accepts either channel URL or ChannelID.

* On submit: create row in `channel_queue` table with status `pending`.

* Background worker (Vercel Cron) pulls queue, fetches video list, retrieves transcripts, stores embeddings in Supabase `video_chunk` table.

* On finish send templated email via Resend API with link `/channel/{id}`.

* Channel chat page reuses split layout. Left pane shows playlist sidebar and currently selected video. Right pane chat searches across all transcripts for the channel using embeddings + GPT‑3.5‑turbo for first month to reduce cost.

* **One‑channel rule**: each user may queue and chat with only one channel concurrently until multi‑channel search is released. Banner identical to video flow hints at the upcoming feature.

* Rate limits: one free channel per user, max two hundred videos or twenty hours whichever first.

* After Google login via Clerk a **Add Channel** dialog accepts either channel URL or ChannelID.

* On submit: create row in `channel_queue` table with status `pending`.

* Background worker (Vercel Cron) pulls queue, fetches video list, retrieves transcripts, stores embeddings in Supabase `video_chunk` table.

* On finish send templated email via Resend API with link `/channel/{id}`.

* Channel chat page reuses split layout. Left pane shows playlist sidebar and currently selected video. Right pane chat searches across all transcripts for the channel using embeddings + GPT‑3.5 turbo for first month to reduce cost.

* Rate limits: one free channel per user, max two hundred videos or twenty hours whichever first.

## 6. System Design

### Frontend

* Next.js App Router, TSX.
* shadcn ui components, custom theme tokens for dark and light use **Docs/ui.json**.
* React context `TranscriptContext` caching current video transcript to avoid extra trips.

### Backend

* **Platform**: Supabase MCP project ID `zsuulzczbhgrfjtocwfy` (Postgres + Edge Functions + Storage + Cron).
* **Data storage**: Postgres tables listed below with `pgvector` enabled.
* **Edge functions** deployed on Supabase for:

  * `POST /api/ingest/video` returns jobID.
  * `POST /api/chat` expects `{videoId | channelId, messages[]}` returns LLM response with citations.
* **Caching / Memory strategy**

  * *Single‑video*: full transcript chunks are loaded into React state for the active session, then dropped after 30 minutes idle.
  * *Single‑channel*: on first query we stream only the top chunks from Postgres into a per‑user LRU (in‑memory Map or Redis `transcript:{videoId}`) with 24‑hour TTL. We never keep more than five videos' chunks resident per user.
  * **Redis** (Supabase Realtime KV) used for hot transcripts; everything else lives in Postgres.
* **Background channel crawler** runs via Supabase scheduled function every two minutes, respects YouTube quota and bulk‑inserts chunks.

### LLM Guide – how the bot thinks – how the bot thinks

#### Single‑video mode

1. We keep the last three messages so the bot stays in the loop.
2. We run a lightning‑fast vector search over the transcript, grab the twenty snippets that score highest, and label each with its `hh:mm:ss` timestamp.
3. We wrap those snippets in a tight prompt that tells GPT‑4o: "Stick to the text. Cite timestamps. Keep it friendly."
4. GPT‑4o replies in plain language, sprinkling square‑bracket citations like `[01:12]` wherever it references the video.
5. On our side we match those citations back to their snippets, pop mini‑thumbnails under the player, and if you click one the video jumps while the chat says something like "Jumped to 01:12 – what next?"

#### Single‑channel mode

Same party, bigger guest list. The search now sweeps every transcript in the chosen channel. Answers still cite exact times **and** the video title so you can dive straight in. We're limiting it to one channel at a time to keep costs sane and prompts snappy – multi‑channel is on deck.

---

## 7. Data Model (Supabase) (Supabase)

```sql
users (id, email)
video (id, youtube_id, title, duration)
channel (id, youtube_channel_id, title, owner_user_id)
video_chunk (id, video_id, channel_id, start_sec, text, embedding vector)
channel_queue (id, channel_id, status, requested_by, requested_at, finished_at)
```

## 8. Error Handling & Feedback

* Any transcript fetch >10 s shows progress bar with message *Still grabbing transcript…*.
* Failures add a toast *Transcript unavailable, join wait‑list to auto retry*.
* Channel indexing status chip appears next to channel name: pending, processing, ready.

## 9. Security & Compliance

* All user data scoped by RLS in Supabase.
* Only store YouTube video IDs, no raw private data.

## 10. Roadmap Placeholder (not detailed here)

* Stage C multi‑channel RAG
* Stage D multimodal scene search
* Stage E uploads and enterprise

## 11. Out of Scope for this PRD

* Chrome extension
* Slack or other integrations

##

## 12. Developer Resources

* **Docs/youtube-transcript-downloader.md** – step‑by‑step commands for pulling and caching YouTube transcripts when the API fails or has no captions.
* **Docs/ui.json** – master design tokens and component layout spec consumed by our code‑gen scripts to produce shadcn‑based React components.

Keep these two files in sync with any schema changes to avoid front‑end drift or transcript crawler bugs.