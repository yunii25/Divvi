# Supabase Schema Setup

Run the following SQL in your Supabase SQL Editor to set up the necessary tables.

## 1. Profiles Table (for Users)
This table stores user information and supports soft deletion.

```sql
-- Create a profiles table
CREATE TABLE public.profiles (
  id SERIAL PRIMARY KEY,
  auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  status INTEGER DEFAULT 1, -- 1 for active, 0 for soft-deleted
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile." ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = auth_id);

CREATE POLICY "Users can update own profile." ON public.profiles
  FOR UPDATE USING (auth.uid() = auth_id);

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (auth_id, email, full_name, avatar_url)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

## 2. Friends Table
Updated to use integer IDs and support soft delete if needed.

```sql
CREATE TABLE public.friends (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  avatar TEXT,
  status INTEGER DEFAULT 1, -- 1 for active, 0 for soft-deleted
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own friends." ON public.friends
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own friends." ON public.friends
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own friends." ON public.friends
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own friends." ON public.friends
  FOR DELETE USING (auth.uid() = user_id);
```

## 3. Expenses Table
Updated to use integer IDs.

```sql
CREATE TABLE public.expenses (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  description TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  payer_id INTEGER REFERENCES public.friends(id),
  date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  splits JSONB NOT NULL,
  split_type TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own expenses." ON public.expenses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own expenses." ON public.expenses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own expenses." ON public.expenses
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own expenses." ON public.expenses
  FOR DELETE USING (auth.uid() = user_id);
```
