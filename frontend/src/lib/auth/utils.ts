/**
 * Authentication utilities for Clerk integration
 */

import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

/**
 * Get the current user's authentication token
 */
export async function getAuthToken(): Promise<string | null> {
  try {
    const { getToken } = await auth()
    return await getToken()
  } catch (error) {
    console.error('Error getting auth token:', error)
    return null
  }
}

/**
 * Check if the current user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const { userId } = await auth()
    return !!userId
  } catch (error) {
    console.error('Error checking authentication:', error)
    return false
  }
}

/**
 * Check if the current user has admin role
 */
export async function isAdmin(): Promise<boolean> {
  try {
    const { sessionClaims } = await auth()
    const userRole = sessionClaims?.metadata?.role
    return userRole === 'admin'
  } catch (error) {
    console.error('Error checking admin status:', error)
    return false
  }
}

/**
 * Get the current user's session information
 */
export async function getCurrentUser() {
  try {
    const { userId, sessionClaims } = await auth()

    if (!userId) {
      return null
    }

    return {
      id: userId,
      role: sessionClaims?.metadata?.role || 'user',
      email: sessionClaims?.email,
      name: sessionClaims?.name,
    }
  } catch (error) {
    console.error('Error getting current user:', error)
    return null
  }
}

/**
 * Require authentication and optionally admin role
 */
export async function requireAuth(adminOnly = false) {
  const authenticated = await isAuthenticated()

  if (!authenticated) {
    redirect('/sign-in')
  }

  if (adminOnly) {
    const hasAdminRole = await isAdmin()
    if (!hasAdminRole) {
      redirect('/unauthorized')
    }
  }
}

/**
 * Get authorization headers for API requests
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getAuthToken()

  if (!token) {
    return {}
  }

  return {
    Authorization: `Bearer ${token}`,
  }
}
