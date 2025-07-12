# Apply Anonymous Session Migration

You need to apply the migration for anonymous session conversion. Here's how:

## Steps:

1. **Go to your Supabase Dashboard**
   - Open https://app.supabase.com
   - Select your MindSift project

2. **Navigate to SQL Editor**
   - Click on "SQL Editor" in the left sidebar

3. **Copy and paste the migration SQL**
   - Copy the entire contents of: `supabase/migrations/20250112_migrate_anon_to_user_sessions.sql`
   - Paste it into the SQL Editor

4. **Run the migration**
   - Click "Run" button
   - You should see "Success" message

5. **Verify the function was created**
   Run this query to verify:
   ```sql
   SELECT routine_name 
   FROM information_schema.routines 
   WHERE routine_name = 'migrate_anon_sessions_to_user';
   ```

## What this migration does:

- Creates a function `migrate_anon_sessions_to_user` that converts anonymous sessions to user sessions
- Migrates chat sessions and messages
- Merges rate limits to prevent quota abuse
- Creates audit logs for compliance
- Creates necessary indexes for performance

## Testing:

After applying the migration, the system will automatically:
1. Detect when anonymous users sign in
2. Call the migration function via API
3. Transfer all their chat history to their account
4. Show message count correctly

## Troubleshooting:

If you see "Could not find the function" error:
- Make sure you ran the entire SQL file
- Check for any error messages in the SQL Editor
- Verify the function exists using the query above

The migration is now ready to use!