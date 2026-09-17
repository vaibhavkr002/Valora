-- ============================================================================
-- ENHANCE ADDRESSES SCHEMA MIGRATION
-- Adds optional columns to public.addresses for smart India address support
-- Safe and idempotent: uses ADD COLUMN IF NOT EXISTS
-- ============================================================================

DO $$
BEGIN
    -- Add district if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'addresses' AND column_name = 'district'
    ) THEN
        ALTER TABLE public.addresses ADD COLUMN district TEXT;
    END IF;

    -- Add post_office if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'addresses' AND column_name = 'post_office'
    ) THEN
        ALTER TABLE public.addresses ADD COLUMN post_office TEXT;
    END IF;

    -- Add locality if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'addresses' AND column_name = 'locality'
    ) THEN
        ALTER TABLE public.addresses ADD COLUMN locality TEXT;
    END IF;

    -- Add email if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'addresses' AND column_name = 'email'
    ) THEN
        ALTER TABLE public.addresses ADD COLUMN email TEXT;
    END IF;
END $$;

-- Update RLS policies to ensure authenticated users can insert and manage their addresses
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'addresses' AND policyname = 'Users can view own addresses'
    ) THEN
        CREATE POLICY "Users can view own addresses" ON public.addresses
            FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'addresses' AND policyname = 'Users can insert own addresses'
    ) THEN
        CREATE POLICY "Users can insert own addresses" ON public.addresses
            FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'addresses' AND policyname = 'Users can update own addresses'
    ) THEN
        CREATE POLICY "Users can update own addresses" ON public.addresses
            FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'addresses' AND policyname = 'Users can delete own addresses'
    ) THEN
        CREATE POLICY "Users can delete own addresses" ON public.addresses
            FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

