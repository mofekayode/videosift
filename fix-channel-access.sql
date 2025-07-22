-- First, find your user ID (replace with your email)
SELECT id, email FROM users WHERE email = 'your-email@example.com';

-- Check if you have access to this channel
SELECT * FROM user_channels 
WHERE channel_id = '951acaa9-d442-4255-94e8-34be4d6937fa'
AND user_id = 'YOUR-USER-ID-HERE';

-- If no access, grant it:
INSERT INTO user_channels (user_id, channel_id, created_at)
VALUES ('YOUR-USER-ID-HERE', '951acaa9-d442-4255-94e8-34be4d6937fa', NOW())
ON CONFLICT DO NOTHING;

-- Verify it worked
SELECT 
  uc.*,
  c.title as channel_title,
  u.email as user_email
FROM user_channels uc
JOIN channels c ON c.id = uc.channel_id
JOIN users u ON u.id = uc.user_id
WHERE uc.channel_id = '951acaa9-d442-4255-94e8-34be4d6937fa';