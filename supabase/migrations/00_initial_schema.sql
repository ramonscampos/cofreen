-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- USERS are managed by Supabase Auth (auth.users), so we rely on that.

-- CARDS Table
create table if not exists public.cards (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references auth.users(id) not null,
    bank_name text not null,
    description text,
    due_day integer not null check (due_day >= 1 and due_day <= 31),
    color text not null default '#000000',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RECURRING TEMPLATES Table
create table if not exists public.recurring_templates (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references auth.users(id) not null,
    kind text not null check (kind in ('incoming', 'expense')),
    description text not null,
    default_amount numeric not null,
    day_of_month integer not null check (day_of_month >= 1 and day_of_month <= 31),
    is_active boolean default true,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- TRANSACTIONS Table
-- Used for real cash flow items (incoming, expense, manual card bill payment)
create table if not exists public.transactions (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references auth.users(id) not null,
    kind text not null check (kind in ('incoming', 'expense')),
    month_ref text not null, -- Format YYYY-MM
    description text not null,
    amount numeric not null,
    paid boolean default false,
    is_recurring boolean default false,
    template_id uuid references public.recurring_templates(id),
    card_id uuid references public.cards(id), -- If set, this is a MANUAL CREDIT CARD BILL payment for that month
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- CARD TRANSACTIONS Table
-- Individual credit card purchases. These do NOT directly affect totals.
-- Aggregated to form virtual bills.
create table if not exists public.card_transactions (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references auth.users(id) not null,
    card_id uuid references public.cards(id) not null,
    month_ref text not null, -- Billing month (YYYY-MM)
    description text not null,
    amount numeric not null,
    installment_total integer,
    installment_current integer,
    plan_id uuid, -- To group installments
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS POLICIES

-- Enable RLS on all tables
alter table public.cards enable row level security;
alter table public.recurring_templates enable row level security;
alter table public.transactions enable row level security;
alter table public.card_transactions enable row level security;

-- Policies for CARDS
create policy "Users can view their own cards" on public.cards
    for select using (auth.uid() = user_id);

create policy "Users can insert their own cards" on public.cards
    for insert with check (auth.uid() = user_id);

create policy "Users can update their own cards" on public.cards
    for update using (auth.uid() = user_id);

create policy "Users can delete their own cards" on public.cards
    for delete using (auth.uid() = user_id);

-- Policies for RECURRING TEMPLATES
create policy "Users can view their own templates" on public.recurring_templates
    for select using (auth.uid() = user_id);

create policy "Users can insert their own templates" on public.recurring_templates
    for insert with check (auth.uid() = user_id);

create policy "Users can update their own templates" on public.recurring_templates
    for update using (auth.uid() = user_id);

create policy "Users can delete their own templates" on public.recurring_templates
    for delete using (auth.uid() = user_id);

-- Policies for TRANSACTIONS
create policy "Users can view their own transactions" on public.transactions
    for select using (auth.uid() = user_id);

create policy "Users can insert their own transactions" on public.transactions
    for insert with check (auth.uid() = user_id);

create policy "Users can update their own transactions" on public.transactions
    for update using (auth.uid() = user_id);

create policy "Users can delete their own transactions" on public.transactions
    for delete using (auth.uid() = user_id);

-- Policies for CARD TRANSACTIONS
create policy "Users can view their own card transactions" on public.card_transactions
    for select using (auth.uid() = user_id);

create policy "Users can insert their own card transactions" on public.card_transactions
    for insert with check (auth.uid() = user_id);

create policy "Users can update their own card transactions" on public.card_transactions
    for update using (auth.uid() = user_id);

create policy "Users can delete their own card transactions" on public.card_transactions
    for delete using (auth.uid() = user_id);
