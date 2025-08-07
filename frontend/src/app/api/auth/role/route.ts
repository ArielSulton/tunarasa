import { NextRequest, NextResponse } from 'next/server'
import { determineUserRole, ensureRolesExist } from '@/lib/services/role-management'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Ensure roles exist before determining user role
    await ensureRolesExist()

    // Determine the appropriate role for the user
    const roleId = await determineUserRole(email)

    return NextResponse.json({ roleId }, { status: 200 })
  } catch (error) {
    console.error('Error determining user role:', error)
    return NextResponse.json({ error: 'Failed to determine user role' }, { status: 500 })
  }
}
