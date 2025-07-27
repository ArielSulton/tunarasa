import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { appSettings, users } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

/**
 * Service Configuration API
 *
 * Manages global service mode settings:
 * - full_llm_bot: Direct LLM responses (default)
 * - human_cs_support: Route to admin queue for human CS support
 */

const SERVICE_MODE_KEY = 'service_mode'

export async function GET() {
  try {
    // Get current service mode setting
    const setting = await db.select().from(appSettings).where(eq(appSettings.settingKey, SERVICE_MODE_KEY)).limit(1)

    const serviceMode = setting.length > 0 ? setting[0].settingValue : 'full_llm_bot'

    return NextResponse.json({
      success: true,
      serviceMode,
      description:
        serviceMode === 'full_llm_bot'
          ? 'Users receive direct LLM responses'
          : 'Users are routed to human customer support queue',
    })
  } catch (error) {
    console.error('Error fetching service configuration:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    // Check authentication and admin role
    const user = await currentUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized - User not authenticated' }, { status: 401 })
    }

    // Check if user is admin or superadmin
    const dbUser = await db
      .select()
      .from(users)
      .where(and(eq(users.clerkUserId, user.id), eq(users.isActive, true)))
      .limit(1)

    if (dbUser.length === 0) {
      return NextResponse.json({ error: 'User not found in database' }, { status: 404 })
    }

    const userRole = dbUser[0].roleId
    if (userRole !== 1 && userRole !== 2) {
      // Not superadmin or admin
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    const body = await req.json()
    const { serviceMode } = body

    // Validate service mode
    if (!serviceMode || !['full_llm_bot', 'human_cs_support'].includes(serviceMode)) {
      return NextResponse.json(
        {
          error: 'Invalid service mode. Must be "full_llm_bot" or "human_cs_support"',
        },
        { status: 400 },
      )
    }

    // Update or insert service mode setting
    const existingSetting = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.settingKey, SERVICE_MODE_KEY))
      .limit(1)

    if (existingSetting.length > 0) {
      // Update existing setting
      await db
        .update(appSettings)
        .set({
          settingValue: serviceMode,
          updatedBy: dbUser[0].userId,
          updatedAt: new Date(),
        })
        .where(eq(appSettings.settingKey, SERVICE_MODE_KEY))
    } else {
      // Insert new setting
      await db.insert(appSettings).values({
        settingKey: SERVICE_MODE_KEY,
        settingValue: serviceMode,
        settingType: 'string',
        description: 'Global service mode for chat system',
        isPublic: true, // Can be read by non-admin users
        updatedBy: dbUser[0].userId,
      })
    }

    const modeDescription =
      serviceMode === 'full_llm_bot'
        ? 'Users will receive direct LLM responses'
        : 'Users will be routed to human customer support queue'

    return NextResponse.json({
      success: true,
      message: 'Service mode updated successfully',
      serviceMode,
      description: modeDescription,
      updatedBy: user.emailAddresses[0]?.emailAddress || user.id,
      updatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error updating service configuration:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Initialize default service mode setting
 */
export async function PUT() {
  try {
    // Check authentication and superadmin role
    const user = await currentUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized - User not authenticated' }, { status: 401 })
    }

    // Check if user is superadmin
    const dbUser = await db
      .select()
      .from(users)
      .where(and(eq(users.clerkUserId, user.id), eq(users.isActive, true)))
      .limit(1)

    if (dbUser.length === 0 || dbUser[0].roleId !== 1) {
      return NextResponse.json({ error: 'Forbidden - SuperAdmin access required' }, { status: 403 })
    }

    // Check if service mode setting already exists
    const existingSetting = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.settingKey, SERVICE_MODE_KEY))
      .limit(1)

    if (existingSetting.length > 0) {
      return NextResponse.json({
        success: true,
        message: 'Service mode setting already exists',
        serviceMode: existingSetting[0].settingValue,
        alreadyExists: true,
      })
    }

    // Initialize default service mode
    await db.insert(appSettings).values({
      settingKey: SERVICE_MODE_KEY,
      settingValue: 'full_llm_bot',
      settingType: 'string',
      description: 'Global service mode for chat system',
      isPublic: true,
      updatedBy: dbUser[0].userId,
    })

    return NextResponse.json({
      success: true,
      message: 'Service mode initialized successfully',
      serviceMode: 'full_llm_bot',
      description: 'Users will receive direct LLM responses (default mode)',
    })
  } catch (error) {
    console.error('Error initializing service configuration:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
