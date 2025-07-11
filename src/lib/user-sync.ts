import { currentUser } from '@clerk/nextjs/server';
import { createUser, getUserByClerkId } from './database';

export async function ensureUserExists() {
  try {
    const user = await currentUser();
    
    if (!user) {
      console.log('🔒 No authenticated user found');
      return null;
    }

    // Check if user exists in Supabase
    const existingUser = await getUserByClerkId(user.id);
    
    if (existingUser) {
      console.log('✅ User already exists in Supabase:', existingUser.id);
      return existingUser;
    }

    // Create user in Supabase
    const primaryEmail = user.emailAddresses.find(email => 
      email.emailAddress
    )?.emailAddress;
    
    if (!primaryEmail) {
      console.error('❌ No email address found for user');
      return null;
    }

    console.log('👤 Creating user in Supabase:', user.id);
    const newUser = await createUser(user.id, primaryEmail);
    
    if (newUser) {
      console.log('✅ User created successfully:', newUser.id);
      return newUser;
    } else {
      console.error('❌ Failed to create user in Supabase');
      return null;
    }
  } catch (error) {
    console.error('❌ Error ensuring user exists:', error);
    return null;
  }
}

export async function syncUserOnSignIn() {
  return ensureUserExists();
}