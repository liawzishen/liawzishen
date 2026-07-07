-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ GreenMap · 0008 · Seller side of customer service + stock            ║
-- ║ Lets a grower read and act on support items for farms they OWN, and   ║
-- ║ manage per-listing stock. Builds on 0007. Safe to re-run.             ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- order_feedback needs the farm name so a seller can find feedback for their
-- own listings (refund_requests and support_messages already carry it).
alter table public.order_feedback
  add column if not exists farm text not null default '';

-- ── Seller access, keyed on farm ownership ───────────────────────────────
-- A grower may touch a support row only when they own a farm whose name
-- matches the row's denormalised farm/seller_name. This is how the seller
-- (a different user from the customer) sees the customer's conversation
-- without any service-role backdoor.

-- refund_requests: seller reads their farm's requests and may APPROVE/REJECT
-- them (the power the AI assistant deliberately does NOT have).
drop policy if exists "refunds_select_seller" on public.refund_requests;
create policy "refunds_select_seller" on public.refund_requests
  for select using (
    exists (
      select 1 from public.farms f
      where f.user_id = auth.uid() and f.name = refund_requests.farm
    )
  );

drop policy if exists "refunds_update_seller" on public.refund_requests;
create policy "refunds_update_seller" on public.refund_requests
  for update using (
    exists (
      select 1 from public.farms f
      where f.user_id = auth.uid() and f.name = refund_requests.farm
    )
  )
  with check (status in ('approved', 'rejected'));

-- support_messages: seller reads their farm's 'seller' threads and may post
-- replies (sender = 'seller') into them.
drop policy if exists "support_msg_select_seller" on public.support_messages;
create policy "support_msg_select_seller" on public.support_messages
  for select using (
    thread = 'seller'
    and exists (
      select 1 from public.farms f
      where f.user_id = auth.uid() and f.name = support_messages.seller_name
    )
  );

drop policy if exists "support_msg_insert_seller" on public.support_messages;
create policy "support_msg_insert_seller" on public.support_messages
  for insert with check (
    sender = 'seller'
    and exists (
      select 1 from public.farms f
      where f.user_id = auth.uid() and f.name = support_messages.seller_name
    )
  );

-- order_feedback: seller reads feedback for their farm.
drop policy if exists "feedback_select_seller" on public.order_feedback;
create policy "feedback_select_seller" on public.order_feedback
  for select using (
    exists (
      select 1 from public.farms f
      where f.user_id = auth.uid() and f.name = order_feedback.farm
    )
  );

-- ── listing_stock: per-listing availability, seller-managed ──────────────
-- listing_id is the mock marketplace id (components/sales/demo-listings.ts).
-- seller_farm ties each row to the owning farm for RLS + display.
create table if not exists public.listing_stock (
  listing_id  text primary key,
  seller_farm text not null,
  in_stock    boolean not null default true,
  qty         integer not null default 0 check (qty >= 0),
  updated_at  timestamptz not null default now()
);

alter table public.listing_stock enable row level security;

-- Every shopper can see availability.
drop policy if exists "stock_select_all" on public.listing_stock;
create policy "stock_select_all" on public.listing_stock
  for select to authenticated using (true);

-- Only the owning grower writes it.
drop policy if exists "stock_write_seller" on public.listing_stock;
create policy "stock_write_seller" on public.listing_stock
  for all using (
    exists (
      select 1 from public.farms f
      where f.user_id = auth.uid() and f.name = listing_stock.seller_farm
    )
  )
  with check (
    exists (
      select 1 from public.farms f
      where f.user_id = auth.uid() and f.name = listing_stock.seller_farm
    )
  );
