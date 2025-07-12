-- Add device tracking columns to chat_sessions
ALTER TABLE chat_sessions 
ADD COLUMN IF NOT EXISTS device_fingerprint TEXT,
ADD COLUMN IF NOT EXISTS client_ip TEXT,
ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Create index for device fingerprint lookups
CREATE INDEX IF NOT EXISTS idx_chat_sessions_device_fingerprint 
ON chat_sessions(device_fingerprint) 
WHERE device_fingerprint IS NOT NULL;

-- Create index for IP lookups
CREATE INDEX IF NOT EXISTS idx_chat_sessions_client_ip 
ON chat_sessions(client_ip) 
WHERE client_ip IS NOT NULL;

-- Create a table to track suspicious activity
CREATE TABLE IF NOT EXISTS suspicious_activity (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_type TEXT NOT NULL, -- 'multiple_devices', 'rapid_requests', 'cleared_storage'
  identifier TEXT NOT NULL, -- IP, device_fingerprint, or anon_id
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for suspicious activity lookups
CREATE INDEX IF NOT EXISTS idx_suspicious_activity_identifier 
ON suspicious_activity(identifier);

CREATE INDEX IF NOT EXISTS idx_suspicious_activity_created_at 
ON suspicious_activity(created_at);

-- Function to check for suspicious anonymous user activity
CREATE OR REPLACE FUNCTION check_suspicious_anon_activity(
  p_ip TEXT,
  p_device_fingerprint TEXT,
  p_anon_id TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_device_count INTEGER;
  v_ip_sessions_today INTEGER;
  v_different_anon_ids INTEGER;
BEGIN
  -- Check how many different devices from same IP today
  SELECT COUNT(DISTINCT device_fingerprint) INTO v_device_count
  FROM chat_sessions
  WHERE client_ip = p_ip
    AND created_at >= CURRENT_DATE
    AND device_fingerprint IS NOT NULL;
  
  -- Check total sessions from this IP today
  SELECT COUNT(*) INTO v_ip_sessions_today
  FROM chat_sessions
  WHERE client_ip = p_ip
    AND created_at >= CURRENT_DATE;
  
  -- Check how many different anon_ids from same device
  SELECT COUNT(DISTINCT anon_id) INTO v_different_anon_ids
  FROM chat_sessions
  WHERE device_fingerprint = p_device_fingerprint
    AND created_at >= CURRENT_DATE
    AND anon_id IS NOT NULL;
  
  -- Flag as suspicious if:
  -- 1. More than 3 devices from same IP in one day
  -- 2. More than 50 sessions from same IP in one day  
  -- 3. More than 5 different anon_ids from same device in one day
  IF v_device_count > 3 OR v_ip_sessions_today > 50 OR v_different_anon_ids > 5 THEN
    -- Log suspicious activity
    INSERT INTO suspicious_activity (activity_type, identifier, details)
    VALUES (
      CASE 
        WHEN v_device_count > 3 THEN 'multiple_devices'
        WHEN v_ip_sessions_today > 50 THEN 'rapid_requests'
        ELSE 'cleared_storage'
      END,
      p_ip,
      jsonb_build_object(
        'ip', p_ip,
        'device_fingerprint', p_device_fingerprint,
        'anon_id', p_anon_id,
        'device_count', v_device_count,
        'ip_sessions_today', v_ip_sessions_today,
        'different_anon_ids', v_different_anon_ids
      )
    );
    
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;