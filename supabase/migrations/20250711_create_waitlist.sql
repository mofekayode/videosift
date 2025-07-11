-- Create waitlist table
CREATE TABLE waitlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  user_id TEXT, -- Clerk user ID if signed in
  position INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX idx_waitlist_email ON waitlist(email);
CREATE INDEX idx_waitlist_user_id ON waitlist(user_id);
CREATE INDEX idx_waitlist_position ON waitlist(position);

-- Add RLS policies
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Policy for users to see their own waitlist entry
CREATE POLICY "Users can view their own waitlist entry" ON waitlist
  FOR SELECT USING (
    email = auth.jwt()->>'email' OR 
    user_id = auth.jwt()->>'sub'
  );

-- Policy for inserting new waitlist entries
CREATE POLICY "Anyone can join waitlist" ON waitlist
  FOR INSERT WITH CHECK (true);

-- Function to automatically set position when inserting
CREATE OR REPLACE FUNCTION set_waitlist_position()
RETURNS TRIGGER AS $$
BEGIN
  -- Set position to next available number
  SELECT COALESCE(MAX(position), 0) + 1 INTO NEW.position FROM waitlist;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to set position automatically
CREATE TRIGGER set_waitlist_position_trigger
  BEFORE INSERT ON waitlist
  FOR EACH ROW
  EXECUTE FUNCTION set_waitlist_position();

-- Function to update updated_at on changes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER update_waitlist_updated_at
  BEFORE UPDATE ON waitlist
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();