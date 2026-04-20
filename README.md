# ArhamChat

## Project Overview
ArhamChat is a mobile-first chat application built with React, Capacitor, and Supabase. It provides email/password authentication, conversation and message views, and realtime message delivery using Supabase Realtime.

## Tech Stack
- React
- Vite
- Capacitor
- Supabase
- React Router
- JavaScript

## Supabase Setup
1. Create a new project in the [Supabase Dashboard](https://supabase.com/dashboard).
2. Open the project and go to `SQL Editor`.
3. Run `supabase/start-chat-setup.sql` in the Supabase SQL Editor to create the core tables, triggers, policies, and realtime setup used by the app.
4. Go to `Database` -> `Replication` and make sure Realtime is enabled for the `messages` table.
5. Go to `Project Settings` -> `API`.
6. Copy the `Project URL` and `anon public` key for local development.

### SQL Schema
```sql
create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique,
  full_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  content text not null check (char_length(trim(content)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_conversation_participants_user_id
  on public.conversation_participants (user_id);

create index if not exists idx_conversation_participants_conversation_id
  on public.conversation_participants (conversation_id);

create index if not exists idx_messages_conversation_id_created_at
  on public.messages (conversation_id, created_at);

alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "Users can read participant profiles in shared conversations" on public.profiles;
create policy "Users can read participant profiles in shared conversations"
on public.profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.conversation_participants current_user_cp
    join public.conversation_participants target_cp
      on current_user_cp.conversation_id = target_cp.conversation_id
    where current_user_cp.user_id = auth.uid()
      and target_cp.user_id = profiles.id
  )
);

drop policy if exists "Users can read their conversation memberships" on public.conversation_participants;
create policy "Users can read their conversation memberships"
on public.conversation_participants
for select
to authenticated
using (
  exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = conversation_participants.conversation_id
      and cp.user_id = auth.uid()
  )
);

drop policy if exists "Users can read their conversations" on public.conversations;
create policy "Users can read their conversations"
on public.conversations
for select
to authenticated
using (
  exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = conversations.id
      and cp.user_id = auth.uid()
  )
);

drop policy if exists "Users can read messages in their conversations" on public.messages;
create policy "Users can read messages in their conversations"
on public.messages
for select
to authenticated
using (
  exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = messages.conversation_id
      and cp.user_id = auth.uid()
  )
);

drop policy if exists "Users can insert messages in their conversations" on public.messages;
create policy "Users can insert messages in their conversations"
on public.messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = messages.conversation_id
      and cp.user_id = auth.uid()
  )
);

alter publication supabase_realtime add table public.messages;
```

### Notes
- The app expects each authenticated user to have a matching row in `public.profiles`.
- `messages` must be part of the `supabase_realtime` publication for realtime updates to work.

## Local Development
1. Clone the repository:
```bash
git clone <your-repository-url>
cd ArhamChat
```

2. Install dependencies:
```bash
npm install
```

3. Create a local environment file:
```bash
cp .env.example .env
```

4. Add your Supabase credentials to `.env`.

5. Start the development server:
```bash
npm run dev
```

## Building the Android APK
1. Build the web app:
```bash
npm run build
```

2. Sync the web build into the Android project:
```bash
npx cap sync android
```

3. Open the Android project in Android Studio:
```bash
npx cap open android
```

4. In Android Studio, build the APK using:
`Build` -> `Build Bundle(s) / APK(s)` -> `Build APK(s)`

## Environment Variables
- `VITE_SUPABASE_URL`
  Supabase project URL used to initialize the frontend client.

- `VITE_SUPABASE_ANON_KEY`
  Supabase anonymous public API key used by the client app for authenticated requests.
