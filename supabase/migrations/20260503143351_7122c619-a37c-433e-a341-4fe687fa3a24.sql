
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Documents
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  filename TEXT,
  upload_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending',
  stage TEXT NOT NULL DEFAULT 'parsing',
  raw_text TEXT,
  page_count INTEGER DEFAULT 0,
  error_message TEXT
);
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view own documents" ON public.documents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert own documents" ON public.documents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update own documents" ON public.documents FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "delete own documents" ON public.documents FOR DELETE USING (auth.uid() = user_id);

-- Requirements
CREATE TABLE public.requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  req_id TEXT NOT NULL,
  req_text TEXT NOT NULL,
  original_text TEXT,
  type TEXT NOT NULL DEFAULT 'Unknown',
  nfr_subtype TEXT,
  confidence NUMERIC NOT NULL DEFAULT 0,
  ambiguity_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  actor TEXT,
  action TEXT,
  status TEXT NOT NULL DEFAULT 'Valid',
  priority TEXT NOT NULL DEFAULT 'Medium',
  suggested_rewrite TEXT,
  is_edited BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX requirements_doc_idx ON public.requirements(doc_id);
ALTER TABLE public.requirements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view own requirements" ON public.requirements FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.documents d WHERE d.id = doc_id AND d.user_id = auth.uid())
);
CREATE POLICY "insert own requirements" ON public.requirements FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.documents d WHERE d.id = doc_id AND d.user_id = auth.uid())
);
CREATE POLICY "update own requirements" ON public.requirements FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.documents d WHERE d.id = doc_id AND d.user_id = auth.uid())
);
CREATE POLICY "delete own requirements" ON public.requirements FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.documents d WHERE d.id = doc_id AND d.user_id = auth.uid())
);

-- Auto-create profile trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
