import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { Webhook } from 'svix';
import { createUser, getUserByClerkId } from '@/lib/database';

const CLERK_WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

interface ClerkWebhookEvent {
  type: string;
  data: {
    id: string;
    email_addresses: Array<{
      email_address: string;
      id: string;
    }>;
    first_name?: string;
    last_name?: string;
    created_at: number;
    updated_at: number;
  };
}

export async function POST(request: NextRequest) {
  if (!CLERK_WEBHOOK_SECRET) {
    console.error('❌ CLERK_WEBHOOK_SECRET is not set');
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    );
  }

  const headersList = await headers();
  const svixId = headersList.get('svix-id');
  const svixTimestamp = headersList.get('svix-timestamp');
  const svixSignature = headersList.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.error('❌ Missing required Svix headers');
    return NextResponse.json(
      { error: 'Missing required headers' },
      { status: 400 }
    );
  }

  const body = await request.text();
  const wh = new Webhook(CLERK_WEBHOOK_SECRET);

  let event: ClerkWebhookEvent;

  try {
    event = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkWebhookEvent;
  } catch (err) {
    console.error('❌ Error verifying webhook:', err);
    return NextResponse.json(
      { error: 'Invalid webhook signature' },
      { status: 400 }
    );
  }

  console.log('📧 Received Clerk webhook:', event.type);

  try {
    switch (event.type) {
      case 'user.created':
        await handleUserCreated(event.data);
        break;
      case 'user.updated':
        await handleUserUpdated(event.data);
        break;
      case 'user.deleted':
        await handleUserDeleted(event.data);
        break;
      default:
        console.log(`⚠️ Unhandled webhook type: ${event.type}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleUserCreated(data: ClerkWebhookEvent['data']) {
  console.log('👤 Creating user in Supabase:', data.id);
  
  const primaryEmail = data.email_addresses.find(email => 
    email.email_address
  )?.email_address;
  
  if (!primaryEmail) {
    console.error('❌ No email address found for user');
    return;
  }

  try {
    const user = await createUser(data.id, primaryEmail);
    if (user) {
      console.log('✅ User created successfully:', user.id);
    } else {
      console.error('❌ Failed to create user in Supabase');
    }
  } catch (error) {
    console.error('❌ Error creating user:', error);
  }
}

async function handleUserUpdated(data: ClerkWebhookEvent['data']) {
  console.log('📝 User updated:', data.id);
  
  // Check if user exists in Supabase
  const existingUser = await getUserByClerkId(data.id);
  
  if (!existingUser) {
    // User doesn't exist, create them
    console.log('🔄 User not found in Supabase, creating...');
    await handleUserCreated(data);
    return;
  }

  const primaryEmail = data.email_addresses.find(email => 
    email.email_address
  )?.email_address;

  if (primaryEmail && primaryEmail !== existingUser.email) {
    console.log('📧 User email changed, updating...');
    // Note: You'd need to implement updateUser function in database.ts
    // await updateUser(data.id, { email: primaryEmail });
  }
}

async function handleUserDeleted(data: ClerkWebhookEvent['data']) {
  console.log('🗑️ User deleted:', data.id);
  // Note: You'd need to implement deleteUser function in database.ts
  // await deleteUser(data.id);
}