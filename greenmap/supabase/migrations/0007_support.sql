-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ GreenMap · 0007 · Customer service: refunds, feedback, support chat   ║
-- ║ Consumer support layer for the buyer app. order_ref is the mock order ║
-- ║ id (components/consumer/demo-consumer.ts) until real orders land.      ║
-- ║ Safe to re-run: IF NOT EXISTS + drop-policy/create.                    ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- ── refund_requests ──────────────────────────────────────────────────────
-- A customer opens these; they always start 'pending'. Approval is a
-- seller/admin decision made OUTSIDE the app — enforced below by RLS
-- (insert forced to 'pending', and NO update policy), so neither the
-- customer nor the AI assistant can ever self-approve a refund.
create table if not exists public.refund_requests (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  order_ref  text not null,
  item       text not null default '',
  farm       text not null default '',
  kind       text not null check (kind in ('refund', 'return')),
  reason     text not null default '',
  status     text not null default 'pending'
               check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);
create index if not exists refund_requests_user_created_idx
  on public.refund_requests (user_id, created_at desc);

-- ── order_feedback ───────────────────────────────────────────────────────
create table if not exists public.order_feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  order_ref  text not null,
  listing_id text,
  rating     integer not null check (rating between 1 and 5),
  comment    text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists order_feedback_user_created_idx
  on public.order_feedback (user_id, created_at desc);

-- ── support_messages ─────────────────────────────────────────────────────
-- Two threads per customer: 'seller' (simulated seller auto-replies) and
-- 'admin' (real Gemini triage). sender labels who "spoke"; every row is
-- owned by the customer (user_id) so RLS stays simple. `intent` stores the
-- AI's classification of the customer's issue on the admin thread.
create table if not exists public.support_messages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  thread      text not null check (thread in ('seller', 'admin')),
  order_ref   text,
  seller_name text,
  sender      text not null check (sender in ('customer', 'seller', 'ai')),
  body        text not null,
  intent      text,
  created_at  timestamptz not null default now()
);
create index if not exists support_messages_thread_idx
  on public.support_messages (user_id, thread, created_at);

-- ── RLS: every row is customer-owned; the customer reads + writes its own ─
alter table public.refund_requests  enable row level security;
alter table public.order_feedback   enable row level security;
alter table public.support_messages enable row level security;

-- refund_requests: read own, open own (pending only), cancel own. NO update
-- policy on purpose → the client can never move status to 'approved'.
drop policy if exists "refunds_select_own" on public.refund_requests;
create policy "refunds_select_own" on public.refund_requests
  for select using (auth.uid() = user_id);

drop policy if exists "refunds_insert_pending" on public.refund_requests;
create policy "refunds_insert_pending" on public.refund_requests
  for insert with check (auth.uid() = user_id and status = 'pending');

drop policy if exists "refunds_delete_own" on public.refund_requests;
create policy "refunds_delete_own" on public.refund_requests
  for delete using (auth.uid() = user_id);

-- order_feedback: read + leave own.
drop policy if exists "feedback_select_own" on public.order_feedback;
create policy "feedback_select_own" on public.order_feedback
  for select using (auth.uid() = user_id);

drop policy if exists "feedback_insert_own" on public.order_feedback;
create policy "feedback_insert_own" on public.order_feedback
  for insert with check (auth.uid() = user_id);

-- support_messages: read + write own threads (customer, ai and simulated
-- seller rows all belong to the customer's thread).
drop policy if exists "support_msg_select_own" on public.support_messages;
create policy "support_msg_select_own" on public.support_messages
  for select using (auth.uid() = user_id);

drop policy if exists "support_msg_insert_own" on public.support_messages;
create policy "support_msg_insert_own" on public.support_messages
  for insert with check (auth.uid() = user_id);
