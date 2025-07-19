/**
 * Authentication components using Clerk
 */

'use client'

import { SignIn, SignUp, UserButton, SignInButton, SignUpButton } from '@clerk/nextjs'
import { useUser } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'

/**
 * Sign In component
 */
export function AuthSignIn() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md">
        <SignIn
          appearance={{
            elements: {
              rootBox: 'mx-auto',
              card: 'bg-card border border-border rounded-lg shadow-lg',
            },
          }}
        />
      </div>
    </div>
  )
}

/**
 * Sign Up component
 */
export function AuthSignUp() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md">
        <SignUp
          appearance={{
            elements: {
              rootBox: 'mx-auto',
              card: 'bg-card border border-border rounded-lg shadow-lg',
            },
          }}
        />
      </div>
    </div>
  )
}

/**
 * User profile button
 */
export function AuthUserButton() {
  return (
    <UserButton
      appearance={{
        elements: {
          avatarBox: 'h-8 w-8',
        },
      }}
    />
  )
}

/**
 * Sign in button for guest users
 */
export function AuthSignInButton() {
  return (
    <SignInButton>
      <Button variant="outline">Sign In</Button>
    </SignInButton>
  )
}

/**
 * Sign up button for guest users
 */
export function AuthSignUpButton() {
  return (
    <SignUpButton>
      <Button>Sign Up</Button>
    </SignUpButton>
  )
}

/**
 * Auth status component showing current user or sign in options
 */
export function AuthStatus() {
  const { isSignedIn, user, isLoaded } = useUser()

  if (!isLoaded) {
    return (
      <div className="flex items-center space-x-2">
        <div className="bg-muted h-8 w-8 animate-pulse rounded-full" />
      </div>
    )
  }

  if (!isSignedIn) {
    return (
      <div className="flex items-center space-x-2">
        <AuthSignInButton />
        <AuthSignUpButton />
      </div>
    )
  }

  return (
    <div className="flex items-center space-x-2">
      <span className="text-muted-foreground text-sm">{user?.firstName || user?.emailAddresses[0]?.emailAddress}</span>
      <AuthUserButton />
    </div>
  )
}

/**
 * Admin only wrapper component
 */
export function AdminOnly({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser()

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2"></div>
      </div>
    )
  }

  const userRole = user?.publicMetadata?.role

  if (userRole !== 'admin') {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <h2 className="text-destructive mb-2 text-xl font-semibold">Access Denied</h2>
          <p className="text-muted-foreground">You need admin privileges to access this area.</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
