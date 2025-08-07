/**
 * Role-Based Access Control (RBAC) Test Utilities
 * Use these functions to test access control in development/staging
 */

import {
  getServerUser as _getServerUser,
  checkAdminAccess as _checkAdminAccess,
  checkSuperAdminAccess as _checkSuperAdminAccess,
  isAdmin,
  isSuperAdmin,
  hasRoleAccess,
  type ServerUserData,
} from './server-auth'

// Mock user data for testing
export const mockUsers = {
  superAdmin: {
    userId: 1,
    supabaseUserId: 'super-admin-id',
    email: 'superadmin@tunarasa.com',
    firstName: 'Super',
    lastName: 'Admin',
    fullName: 'Super Admin',
    imageUrl: undefined,
    roleId: 1,
    isActive: true,
    role: {
      roleName: 'superadmin',
      permissions: ['*'],
    },
  },
  admin: {
    userId: 2,
    supabaseUserId: 'admin-id',
    email: 'admin@tunarasa.com',
    firstName: 'Admin',
    lastName: 'User',
    fullName: 'Admin User',
    imageUrl: undefined,
    roleId: 2,
    isActive: true,
    role: {
      roleName: 'admin',
      permissions: ['read', 'write'],
    },
  },
  user: {
    userId: 3,
    supabaseUserId: 'user-id',
    email: 'user@example.com',
    firstName: 'Regular',
    lastName: 'User',
    fullName: 'Regular User',
    imageUrl: undefined,
    roleId: 3,
    isActive: true,
    role: {
      roleName: 'user',
      permissions: ['read'],
    },
  },
  inactiveAdmin: {
    userId: 4,
    supabaseUserId: 'inactive-admin-id',
    email: 'inactive@tunarasa.com',
    firstName: 'Inactive',
    lastName: 'Admin',
    fullName: 'Inactive Admin',
    imageUrl: undefined,
    roleId: 2,
    isActive: false,
    role: {
      roleName: 'admin',
      permissions: ['read', 'write'],
    },
  },
}

/**
 * Test role access functions with mock data
 */
export function testRoleAccess() {
  console.log('🧪 Testing Role-Based Access Control...\n')

  const testCases = [
    {
      name: 'SuperAdmin Access Tests',
      user: mockUsers.superAdmin,
      tests: [
        { fn: isAdmin, expected: true, desc: 'Should have admin access' },
        { fn: isSuperAdmin, expected: true, desc: 'Should have superadmin access' },
        {
          fn: (u: ServerUserData) => hasRoleAccess(u, 'superadmin'),
          expected: true,
          desc: 'Should have superadmin role access',
        },
        { fn: (u: ServerUserData) => hasRoleAccess(u, 'admin'), expected: true, desc: 'Should have admin role access' },
        { fn: (u: ServerUserData) => hasRoleAccess(u, 'user'), expected: true, desc: 'Should have user role access' },
      ],
    },
    {
      name: 'Admin Access Tests',
      user: mockUsers.admin,
      tests: [
        { fn: isAdmin, expected: true, desc: 'Should have admin access' },
        { fn: isSuperAdmin, expected: false, desc: 'Should NOT have superadmin access' },
        {
          fn: (u: ServerUserData) => hasRoleAccess(u, 'superadmin'),
          expected: false,
          desc: 'Should NOT have superadmin role access',
        },
        { fn: (u: ServerUserData) => hasRoleAccess(u, 'admin'), expected: true, desc: 'Should have admin role access' },
        { fn: (u: ServerUserData) => hasRoleAccess(u, 'user'), expected: true, desc: 'Should have user role access' },
      ],
    },
    {
      name: 'Regular User Access Tests',
      user: mockUsers.user,
      tests: [
        { fn: isAdmin, expected: false, desc: 'Should NOT have admin access' },
        { fn: isSuperAdmin, expected: false, desc: 'Should NOT have superadmin access' },
        {
          fn: (u: ServerUserData) => hasRoleAccess(u, 'superadmin'),
          expected: false,
          desc: 'Should NOT have superadmin role access',
        },
        {
          fn: (u: ServerUserData) => hasRoleAccess(u, 'admin'),
          expected: false,
          desc: 'Should NOT have admin role access',
        },
        { fn: (u: ServerUserData) => hasRoleAccess(u, 'user'), expected: true, desc: 'Should have user role access' },
      ],
    },
    {
      name: 'Inactive Admin Access Tests',
      user: mockUsers.inactiveAdmin,
      tests: [
        { fn: isAdmin, expected: false, desc: 'Should NOT have admin access (inactive)' },
        { fn: isSuperAdmin, expected: false, desc: 'Should NOT have superadmin access (inactive)' },
        {
          fn: (u: ServerUserData) => hasRoleAccess(u, 'admin'),
          expected: false,
          desc: 'Should NOT have admin role access (inactive)',
        },
      ],
    },
  ]

  let totalTests = 0
  let passedTests = 0

  testCases.forEach(({ name, user, tests }) => {
    console.log(`\n📋 ${name}`)
    console.log(`User: ${user.fullName} (${user.email}) - Role ID: ${user.roleId}`)
    console.log('─'.repeat(50))

    tests.forEach(({ fn, expected, desc }) => {
      totalTests++
      const result = fn(user)
      const passed = result === expected

      if (passed) {
        passedTests++
        console.log(`✅ ${desc}: ${result}`)
      } else {
        console.log(`❌ ${desc}: Expected ${expected}, got ${result}`)
      }
    })
  })

  console.log('\n' + '='.repeat(50))
  console.log(`🧪 Test Results: ${passedTests}/${totalTests} tests passed`)

  if (passedTests === totalTests) {
    console.log('🎉 All RBAC tests passed!')
  } else {
    console.log('⚠️  Some RBAC tests failed. Check the implementation.')
  }

  return { totalTests, passedTests, success: passedTests === totalTests }
}

/**
 * Test dashboard access scenarios
 */
export function testDashboardAccess() {
  console.log('\n🏠 Testing Dashboard Access Scenarios...\n')

  const scenarios = [
    {
      user: mockUsers.superAdmin,
      shouldAccess: true,
      reason: 'SuperAdmin has full dashboard access',
    },
    {
      user: mockUsers.admin,
      shouldAccess: true,
      reason: 'Admin has dashboard access',
    },
    {
      user: mockUsers.user,
      shouldAccess: false,
      reason: 'Regular user should be redirected to unauthorized',
    },
    {
      user: mockUsers.inactiveAdmin,
      shouldAccess: false,
      reason: 'Inactive admin should be denied access',
    },
    {
      user: null,
      shouldAccess: false,
      reason: 'Unauthenticated user should be redirected to sign-in',
    },
  ]

  scenarios.forEach(({ user, shouldAccess, reason }) => {
    const hasAccess = user ? isAdmin(user) : false
    const icon = hasAccess === shouldAccess ? '✅' : '❌'
    const userInfo = user ? `${user.fullName} (role_id: ${user.roleId})` : 'Unauthenticated'

    console.log(`${icon} ${userInfo}`)
    console.log(`   Expected: ${shouldAccess ? 'ALLOW' : 'DENY'} | Actual: ${hasAccess ? 'ALLOW' : 'DENY'}`)
    console.log(`   Reason: ${reason}\n`)
  })
}

/**
 * Generate RBAC documentation
 */
export function generateRBACDocumentation() {
  return `
# Role-Based Access Control (RBAC) Documentation

## Role Hierarchy

### SuperAdmin (role_id: 1)
- Full system access
- Can manage all users and admins
- Can invite new admins
- Can access all dashboard features
- Can modify system settings

### Admin (role_id: 2)  
- Limited dashboard access
- Can view analytics and data
- Cannot manage other users
- Cannot invite new admins
- Cannot modify system settings

### User (role_id: 3)
- No admin dashboard access
- Standard user features only
- Redirected to unauthorized page when accessing admin areas

## Implementation

### Middleware Protection (/middleware.ts)
- Checks user authentication status
- Validates role_id for dashboard routes
- Redirects unauthorized users to /unauthorized

### Client-Side Protection
- AdminOnly component wraps protected areas
- useAdminAccess hook for conditional rendering
- Real-time role validation with Supabase

### Server-Side Protection
- requireAdminAccess() for server components
- requireSuperAdminAccess() for super-admin only areas
- Type-safe role checking utilities

## Protected Routes

### Dashboard Routes (/dashboard/*)
- Requires: role_id 1 or 2
- Protection: Middleware + AdminOnly component
- Fallback: Redirect to /unauthorized

### Admin Routes (/admin/*)
- Requires: role_id 1 or 2  
- Protection: Middleware + Server-side checks
- Fallback: Redirect to /unauthorized

## Security Features

1. **Double Protection**: Both middleware and component-level checks
2. **Real-time Validation**: Session-based role verification
3. **Graceful Fallbacks**: User-friendly error pages
4. **Type Safety**: TypeScript interfaces for all role data
5. **Audit Trail**: Comprehensive logging of access attempts

## Testing

Run the test functions to validate RBAC implementation:
- testRoleAccess() - Tests all role permission functions
- testDashboardAccess() - Tests dashboard access scenarios
`
}

// Export test runner for development use
if (process.env.NODE_ENV === 'development') {
  console.log('🔐 RBAC Test Utilities Loaded')
  console.log('Available functions: testRoleAccess(), testDashboardAccess(), generateRBACDocumentation()')
}
