-- Allow authenticated users to insert their own profile row when it does not exist.
-- The website ensures every authenticated user has a profiles record (onboarding flow);
-- if a trigger (e.g. handle_new_user) did not create it, the client can insert once.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

