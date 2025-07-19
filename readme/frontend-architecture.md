# Frontend Component Architecture - Accessibility-First Design

## Overview
Next.js 15 + React 19 component architecture located in `frontend/` directory, optimized for hearing-impaired users with WCAG 2.1 AA compliance.

## Project Structure
```
frontend/
├── src/
│   ├── app/              # Next.js App Router pages
│   ├── components/       # React components
│   │   ├── ui/          # Shadcn UI components
│   │   ├── layout/      # Layout components
│   │   ├── gesture/     # Gesture recognition components
│   │   ├── chat/        # Chat interface components
│   │   └── admin/       # Admin dashboard components
│   ├── hooks/           # Custom React hooks
│   └── lib/            # Utility functions and configurations
├── public/             # Static assets
├── package.json        # Dependencies and scripts
└── Dockerfile         # Container configuration
```

## Core Principles
- **Accessibility First**: Every component designed with screen readers and assistive technology
- **Visual Communication**: Heavy use of visual cues, animations, and clear typography
- **Touch-Friendly**: Large touch targets and gesture-friendly interfaces
- **High Contrast**: Dark/light modes with customizable contrast levels
- **Keyboard Navigation**: Full keyboard accessibility without mouse dependency

## Component Hierarchy

### 1. Layout Components

#### RootLayout (`src/app/layout.tsx`)
```typescript
interface RootLayoutProps {
  children: React.ReactNode
}

// Features:
// - Font loading (Geist Sans/Mono)
// - Theme provider integration
// - Accessibility announcements
// - Meta tags for screen readers
```

#### AccessibilityLayout (`src/components/layout/accessibility-layout.tsx`)
```typescript
interface AccessibilityLayoutProps {
  children: React.ReactNode
  skipLinksTarget?: string
  announcements?: string[]
}

// Features:
// - Skip to content links
// - Live region announcements
// - High contrast toggle
// - Focus management
// - Keyboard navigation indicators
```

#### MainLayout (`src/components/layout/main-layout.tsx`)
```typescript
interface MainLayoutProps {
  children: React.ReactNode
  sidebar?: React.ReactNode
  header?: React.ReactNode
  announcements?: AccessibilityAnnouncement[]
}

// Features:
// - Responsive sidebar navigation
// - Header with accessibility controls
// - Main content area with proper landmarks
// - Footer with additional accessibility options
```

### 2. User Interface Components

#### GestureCapture (`src/components/gesture/gesture-capture.tsx`)
```typescript
interface GestureCaptureProps {
  onGestureRecognized: (data: GestureData) => void
  onError: (error: GestureError) => void
  isActive: boolean
  accessibility: {
    announceGesture: boolean
    showVisualFeedback: boolean
    vibrationEnabled: boolean
  }
}

// Features:
// - MediaPipe hands integration
// - Real-time visual feedback overlay
// - Gesture confidence indicators
// - Accessibility announcements for gesture recognition
// - Camera permission handling with clear instructions
```

#### GestureVisualizer (`src/components/gesture/gesture-visualizer.tsx`)
```typescript
interface GestureVisualizerProps {
  landmarks: HandLandmark[]
  confidence: number
  handedness: 'left' | 'right' | 'both'
  showLabels: boolean
  accessibilityMode: boolean
}

// Features:
// - Hand landmark visualization
// - High contrast bone/joint rendering
// - Confidence score display
// - Alternative text descriptions for screen readers
```

#### QuestionDisplay (`src/components/chat/question-display.tsx`)
```typescript
interface QuestionDisplayProps {
  question: string
  confidence: number
  isProcessing: boolean
  onEdit: (newQuestion: string) => void
  onConfirm: () => void
  accessibility: {
    autoAnnounce: boolean
    showConfidence: boolean
  }
}

// Features:
// - Large, readable text display
// - Confidence indicator with color coding
// - Edit functionality with accessible form controls
// - Voice announcement of recognized text
```

#### AnswerDisplay (`src/components/chat/answer-display.tsx`)
```typescript
interface AnswerDisplayProps {
  answer: string
  sources: DocumentSource[]
  qrCode?: string
  isLoading: boolean
  onFeedback: (feedback: UserFeedback) => void
  accessibility: {
    autoRead: boolean
    showSources: boolean
    qrCodeAlt: string
  }
}

// Features:
// - Progressive text rendering with reading indicators
// - Source citation with accessible links
// - QR code with detailed alt text
// - Audio playback controls (text-to-speech)
// - Feedback buttons with clear labeling
```

### 3. Navigation Components

#### AccessibleNavigation (`src/components/navigation/accessible-navigation.tsx`)
```typescript
interface AccessibleNavigationProps {
  items: NavigationItem[]
  currentPath: string
  collapsible: boolean
  accessibility: {
    skipLinks: boolean
    breadcrumbs: boolean
    landmarks: boolean
  }
}

// Features:
// - Hierarchical navigation with proper ARIA structure
// - Skip links for keyboard users
// - Breadcrumb navigation
// - Visual and screen reader friendly icons
```

#### VoiceNavigation (`src/components/navigation/voice-navigation.tsx`)
```typescript
interface VoiceNavigationProps {
  onCommand: (command: VoiceCommand) => void
  isListening: boolean
  supportedCommands: VoiceCommand[]
}

// Features:
// - Voice command recognition for navigation
// - Visual feedback for voice input
// - Command help and suggestions
// - Fallback for users without voice capability
```

### 4. Form Components

#### AccessibleForm (`src/components/forms/accessible-form.tsx`)
```typescript
interface AccessibleFormProps {
  schema: ZodSchema
  onSubmit: (data: FormData) => void
  accessibility: {
    autoFocus: boolean
    errorAnnouncements: boolean
    fieldDescriptions: boolean
  }
}

// Features:
// - Automatic error announcements
// - Field-level help text
// - Large touch targets
// - Clear focus indicators
// - Progressive enhancement
```

#### FeedbackForm (`src/components/forms/feedback-form.tsx`)
```typescript
interface FeedbackFormProps {
  qnaLogId: string
  onSubmit: (feedback: UserFeedback) => void
  accessibility: {
    ratingMethod: 'stars' | 'buttons' | 'slider'
    includeTextArea: boolean
  }
}

// Features:
// - Multiple rating input methods
// - Large, accessible rating controls
// - Optional text feedback
// - Visual and haptic feedback
```

### 5. Admin Dashboard Components

#### AdminLayout (`src/components/admin/admin-layout.tsx`)
```typescript
interface AdminLayoutProps {
  children: React.ReactNode
  user: AdminUser
  notifications: Notification[]
}

// Features:
// - Role-based component rendering
// - Notification management
// - Quick action shortcuts
// - Accessible data tables and charts
```

#### ValidationQueue (`src/components/admin/validation-queue.tsx`)
```typescript
interface ValidationQueueProps {
  qnaLogs: QnALog[]
  onValidate: (logId: string, status: ValidationStatus) => void
  filters: ValidationFilters
}

// Features:
// - Sortable, filterable data table
// - Bulk validation actions
// - Keyboard shortcuts for common actions
// - Screen reader friendly data presentation
```

#### AnalyticsDashboard (`src/components/admin/analytics-dashboard.tsx`)
```typescript
interface AnalyticsDashboardProps {
  metrics: PerformanceMetrics
  timeRange: TimeRange
  onTimeRangeChange: (range: TimeRange) => void
}

// Features:
// - Accessible chart components (Recharts)
// - Data table alternatives for screen readers
// - Keyboard navigation for chart data
// - High contrast chart themes
```

### 6. Accessibility-Specific Components

#### LiveAnnouncer (`src/components/accessibility/live-announcer.tsx`)
```typescript
interface LiveAnnouncerProps {
  message: string
  priority: 'polite' | 'assertive'
  onAnnounced: () => void
}

// Features:
// - ARIA live region management
// - Message queuing and timing
// - Priority-based announcements
```

#### HighContrastToggle (`src/components/accessibility/high-contrast-toggle.tsx`)
```typescript
interface HighContrastToggleProps {
  currentTheme: 'light' | 'dark' | 'high-contrast'
  onThemeChange: (theme: string) => void
}

// Features:
// - Multiple contrast level options
// - Visual preview of theme changes
// - Keyboard shortcuts for quick switching
```

#### FocusManager (`src/components/accessibility/focus-manager.tsx`)
```typescript
interface FocusManagerProps {
  trapFocus: boolean
  returnFocus: boolean
  initialFocus?: RefObject<HTMLElement>
}

// Features:
// - Focus trap for modals and forms
// - Focus restoration after interactions
// - Skip link functionality
```

#### GestureAlternative (`src/components/accessibility/gesture-alternative.tsx`)
```typescript
interface GestureAlternativeProps {
  onTextInput: (text: string) => void
  onVoiceInput: (text: string) => void
  supportedMethods: InputMethod[]
}

// Features:
// - Text input fallback for gesture recognition
// - Voice input alternative
// - File upload for sign language videos
// - Copy/paste functionality
```

## Styling Architecture

### Tailwind CSS Configuration
```typescript
// tailwind.config.ts
export default {
  theme: {
    extend: {
      // High contrast colors
      colors: {
        'high-contrast': {
          bg: '#000000',
          text: '#ffffff',
          border: '#ffffff',
          accent: '#ffff00'
        }
      },
      
      // Accessibility-focused spacing
      spacing: {
        'touch-target': '44px', // Minimum touch target size
        'focus-ring': '3px'
      },
      
      // Typography for readability
      fontSize: {
        'a11y-small': ['16px', '24px'],
        'a11y-base': ['18px', '28px'],
        'a11y-large': ['22px', '32px']
      }
    }
  },
  
  // Accessibility plugins
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    // Custom accessibility utilities
  ]
}
```

### CSS Custom Properties
```css
/* src/styles/accessibility.css */
:root {
  --focus-ring-color: #005fcc;
  --focus-ring-width: 3px;
  --touch-target-min: 44px;
  --animation-duration-fast: 150ms;
  --animation-duration-normal: 300ms;
}

/* High contrast mode */
@media (prefers-contrast: high) {
  :root {
    --focus-ring-color: #ffff00;
    --focus-ring-width: 4px;
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

## State Management

### Accessibility Context
```typescript
// src/contexts/accessibility-context.tsx
interface AccessibilityContextType {
  // Theme and contrast
  theme: 'light' | 'dark' | 'high-contrast'
  setTheme: (theme: string) => void
  
  // Screen reader preferences
  announcements: boolean
  setAnnouncements: (enabled: boolean) => void
  
  // Motion preferences
  reducedMotion: boolean
  setReducedMotion: (reduced: boolean) => void
  
  // Input preferences
  preferredInputMethod: 'gesture' | 'text' | 'voice'
  setPreferredInputMethod: (method: string) => void
  
  // Focus management
  focusMode: 'automatic' | 'manual'
  setFocusMode: (mode: string) => void
}
```

### Gesture Recognition State
```typescript
// src/hooks/use-gesture-recognition.ts
interface GestureState {
  isActive: boolean
  isCalibrating: boolean
  confidence: number
  recognizedText: string
  error: GestureError | null
  landmarks: HandLandmark[]
}
```

## Testing Strategy

### Accessibility Testing
```typescript
// src/__tests__/accessibility.test.tsx
describe('Accessibility Tests', () => {
  test('keyboard navigation works for all interactive elements', async () => {
    // Test keyboard navigation flow
  })
  
  test('screen reader announcements are properly triggered', async () => {
    // Test ARIA live regions and labels
  })
  
  test('color contrast meets WCAG AA standards', async () => {
    // Test color contrast ratios
  })
  
  test('focus management works correctly', async () => {
    // Test focus trap and restoration
  })
})
```

### Integration Testing
```typescript
// src/__tests__/gesture-integration.test.tsx
describe('Gesture Recognition Integration', () => {
  test('gesture to text flow works end-to-end', async () => {
    // Mock MediaPipe and test full gesture workflow
  })
  
  test('fallback input methods work when gesture fails', async () => {
    // Test alternative input methods
  })
})
```

## Performance Considerations

### Code Splitting
```typescript
// Dynamic imports for heavy components
const GestureCapture = dynamic(() => import('@/components/gesture/gesture-capture'), {
  loading: () => <GestureCaptureLoading />,
  ssr: false
})

const MediaPipeHands = dynamic(() => import('@/lib/mediapipe'), {
  ssr: false
})
```

### Optimization for Assistive Technology
- Minimize DOM updates during gesture recognition
- Debounce accessibility announcements
- Lazy load non-critical accessibility features
- Optimize for screen reader performance

## Documentation and Guidelines

### Component Documentation
Each component includes:
- Accessibility features and ARIA patterns
- Keyboard interaction patterns
- Screen reader behavior
- High contrast mode support
- Testing recommendations

### Developer Guidelines
- Accessibility checklist for new components
- ARIA pattern reference
- Keyboard interaction standards
- Color contrast requirements
- Testing procedures