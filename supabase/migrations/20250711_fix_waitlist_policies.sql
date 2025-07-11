-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own waitlist entry" ON waitlist;
DROP POLICY IF EXISTS "Anyone can join waitlist" ON waitlist;

-- Create simpler policies that work with Clerk auth
-- Allow anyone to insert into waitlist (public access for joining)
CREATE POLICY "Allow public to join waitlist" ON waitlist
  FOR INSERT WITH CHECK (true);

-- Allow anyone to read from waitlist (for checking position)
-- In production, you might want to restrict this more
CREATE POLICY "Allow public to read waitlist" ON waitlist
  FOR SELECT USING (true);

-- Allow updates for admin operations (optional)
CREATE POLICY "Allow public to update waitlist" ON waitlist
  FOR UPDATE USING (true);