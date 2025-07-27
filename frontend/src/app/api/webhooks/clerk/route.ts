import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { Webhook } from 'svix'
import type { WebhookEvent } from '@clerk/nextjs/server'
import { db } from '@/lib/db'

// Type definitions for Clerk webhook event data
interface ClerkUserData {
  id: string
  first_name?: string
  last_name?: string
  email_addresses: Array<{
    id: string
    email_address: string
  }>
  primary_email_address_id: string
  image_url?: string
  last_sign_in_at?: number
  created_at: number
  updated_at?: number
  public_metadata?: Record<string, unknown>
}

interface ClerkWebhookEvent extends Omit<WebhookEvent, 'data'> {
  data: ClerkUserData
}
import { users, userSyncLog, adminInvitations } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

/**
 * Clerk Webhook Handler for User Synchronization
 *
 * Handles Clerk user events and synchronizes them with Supabase database.
 * Supports user.created, user.updated, and user.deleted events.
 *
 * Configuration required:
 * - CLERK_WEBHOOK_SIGNING_SECRET environment variable
 * - Webhook endpoint configured in Clerk Dashboard
 */

const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SIGNING_SECRET

if (!WEBHOOK_SECRET) {
  throw new Error('Missing CLERK_WEBHOOK_SIGNING_SECRET environment variable')
}

// Type-safe webhook secret
const VERIFIED_WEBHOOK_SECRET: string = WEBHOOK_SECRET

export async function POST(req: NextRequest) {
  try {
    // Get headers for webhook verification
    const headerPayload = await headers()
    const svix_id = headerPayload.get('svix-id')
    const svix_timestamp = headerPayload.get('svix-timestamp')
    const svix_signature = headerPayload.get('svix-signature')

    if (!svix_id || !svix_timestamp || !svix_signature) {
      return NextResponse.json({ error: 'Missing required Svix headers' }, { status: 400 })
    }

    // Get the raw body
    const payload = await req.text()

    // Create webhook instance and verify payload
    const wh = new Webhook(VERIFIED_WEBHOOK_SECRET)
    let evt: ClerkWebhookEvent

    try {
      evt = wh.verify(payload, {
        'svix-id': svix_id,
        'svix-timestamp': svix_timestamp,
        'svix-signature': svix_signature,
      }) as ClerkWebhookEvent
    } catch (err) {
      console.error('Error verifying webhook:', err)
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 })
    }

    // Process the webhook event
    const eventType = evt.type

    // Type-safe user ID extraction
    const clerkUserId = typeof evt.data.id === 'string' ? evt.data.id : String(evt.data.id ?? '')

    if (!clerkUserId) {
      console.error('Missing user ID in webhook event')
      return NextResponse.json({ error: 'Missing user ID' }, { status: 400 })
    }

    console.log(`Processing Clerk webhook: ${eventType} for user ${clerkUserId}`)

    // Log the sync attempt
    await logSyncAttempt(clerkUserId, eventType, evt.data as unknown as Record<string, unknown>, 'success')

    // Handle different event types
    switch (eventType) {
      case 'user.created':
        await handleUserCreated(evt)
        break
      case 'user.updated':
        await handleUserUpdated(evt)
        break
      case 'user.deleted':
        await handleUserDeleted(evt)
        break
      default:
        console.log(`Unhandled webhook event type: ${eventType}`)
    }

    return NextResponse.json({
      message: 'Webhook processed successfully',
      eventType,
      userId: clerkUserId,
    })
  } catch (error) {
    console.error('Error processing webhook:', error)

    // Try to log the error if we have the data
    try {
      const payload = await req.text()
      const data = JSON.parse(payload)
      if (data.data?.id) {
        await logSyncAttempt(
          data.data.id,
          data.type,
          data.data,
          'failed',
          error instanceof Error ? error.message : 'Unknown error',
        )
      }
    } catch {
      // Silent fail for logging attempt
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Handle user.created event from Clerk
 */
async function handleUserCreated(evt: ClerkWebhookEvent) {
  const user = evt.data
  const {
    id: clerkUserId,
    first_name,
    last_name,
    email_addresses,
    image_url,
    last_sign_in_at,
    created_at,
    public_metadata,
  } = user

  // Get primary email
  const primaryEmail = email_addresses?.find((email) => email.id === user.primary_email_address_id)?.email_address

  if (!primaryEmail) {
    throw new Error('No primary email found for user')
  }

  // Check if user was invited as admin
  const invitation = await db
    .select()
    .from(adminInvitations)
    .where(and(eq(adminInvitations.email, primaryEmail), eq(adminInvitations.status, 'pending')))
    .limit(1)

  // Determine role based on invitation or default
  let roleId = 3 // Default user role
  let invitedBy = null
  let invitedAt = null

  if (invitation.length > 0) {
    const inv = invitation[0]
    roleId = inv.role === 'superadmin' ? 1 : inv.role === 'admin' ? 2 : 3
    invitedBy = inv.invitedBy
    invitedAt = inv.createdAt

    // Mark invitation as accepted
    await db
      .update(adminInvitations)
      .set({
        status: 'accepted',
        acceptedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(adminInvitations.invitationId, inv.invitationId))
  }

  // Check if this is the first user (should be superadmin)
  const existingUsers = await db.select().from(users).limit(1)
  if (existingUsers.length === 0) {
    roleId = 1 // Make first user superadmin
  }

  // Create user in database
  const fullName = [first_name, last_name].filter(Boolean).join(' ')

  await db.insert(users).values({
    clerkUserId: String(clerkUserId),
    email: primaryEmail,
    firstName: first_name ?? null,
    lastName: last_name ?? null,
    fullName: fullName || null,
    imageUrl: image_url ?? null,
    roleId,
    lastSignInAt: last_sign_in_at ? new Date(last_sign_in_at) : null,
    emailVerified: primaryEmail ? true : false,
    clerkMetadata: public_metadata ?? {},
    invitedBy,
    invitedAt,
    invitationAcceptedAt: invitedBy ? new Date() : null,
    createdAt: new Date(created_at),
    updatedAt: new Date(),
  })

  console.log(`User created in database: ${clerkUserId} with role ${roleId}`)
}

/**
 * Handle user.updated event from Clerk
 */
async function handleUserUpdated(evt: ClerkWebhookEvent) {
  const user = evt.data
  const {
    id: clerkUserId,
    first_name,
    last_name,
    email_addresses,
    image_url,
    last_sign_in_at,
    updated_at,
    public_metadata,
  } = user

  // Get primary email
  const primaryEmail = email_addresses?.find((email) => email.id === user.primary_email_address_id)?.email_address

  if (!primaryEmail) {
    throw new Error('No primary email found for user')
  }

  // Update user in database
  const fullName = [first_name, last_name].filter(Boolean).join(' ')

  await db
    .update(users)
    .set({
      email: primaryEmail,
      firstName: first_name ?? null,
      lastName: last_name ?? null,
      fullName: fullName || null,
      imageUrl: image_url ?? null,
      lastSignInAt: last_sign_in_at ? new Date(last_sign_in_at) : null,
      emailVerified: primaryEmail ? true : false,
      clerkMetadata: public_metadata ?? {},
      updatedAt: updated_at ? new Date(updated_at) : new Date(),
    })
    .where(eq(users.clerkUserId, String(clerkUserId)))

  console.log(`User updated in database: ${clerkUserId}`)
}

/**
 * Handle user.deleted event from Clerk
 */
async function handleUserDeleted(evt: ClerkWebhookEvent) {
  const { id: clerkUserId } = evt.data

  // Soft delete user by marking as inactive
  await db
    .update(users)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(users.clerkUserId, String(clerkUserId)))

  console.log(`User soft deleted in database: ${clerkUserId}`)
}

/**
 * Log sync attempt for monitoring and debugging
 */
async function logSyncAttempt(
  clerkUserId: string,
  eventType: string,
  clerkPayload: Record<string, unknown>,
  syncStatus: 'success' | 'failed' | 'retry',
  errorMessage?: string,
) {
  try {
    await db.insert(userSyncLog).values({
      clerkUserId,
      eventType,
      syncStatus,
      errorMessage: errorMessage ?? null,
      clerkPayload,
      createdAt: new Date(),
    })
  } catch (error) {
    console.error('Failed to log sync attempt:', error)
  }
}
