import { auth, currentUser } from '@clerk/nextjs/server';
import { getUserByClerkId } from './database';

export interface UserInfo {
  userId: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  imageUrl?: string;
  clerkId: string;
  supabaseId?: string;
}

export async function getCurrentUserInfo(): Promise<UserInfo | null> {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return null;
    }

    // Get full user details from Clerk
    const user = await currentUser();
    
    if (!user) {
      return null;
    }

    // Get primary email
    const primaryEmail = user.emailAddresses.find(email => 
      email.emailAddress
    )?.emailAddress || 'unknown@email.com';

    // Try to get Supabase user ID
    let supabaseId: string | undefined;
    try {
      const supabaseUser = await getUserByClerkId(user.id);
      supabaseId = supabaseUser?.id;
    } catch (error) {
      console.error('Failed to get Supabase user:', error);
    }

    return {
      userId: user.id,
      clerkId: user.id,
      email: primaryEmail,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 
            user.username || 
            primaryEmail.split('@')[0],
      firstName: user.firstName || undefined,
      lastName: user.lastName || undefined,
      username: user.username || undefined,
      imageUrl: user.imageUrl || undefined,
      supabaseId
    };
  } catch (error) {
    console.error('Failed to get current user info:', error);
    return null;
  }
}

export async function getBasicUserInfo(): Promise<{ userId: string; email?: string } | null> {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return null;
    }

    // For performance, just return the userId if we don't need full details
    return { userId };
  } catch (error) {
    console.error('Failed to get basic user info:', error);
    return null;
  }
}