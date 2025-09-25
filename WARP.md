# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

VoixnAccent is an AI-powered voice assessment tool built for MediaMint that evaluates spoken language proficiency using the CEFR (Common European Framework of Reference for Languages) framework. The application features automated Google Sheets integration, batch processing, and comprehensive competency scoring with multilingual support.

## Architecture

### Technology Stack
- **Frontend**: Vite + React 18 + TypeScript
- **Backend**: Supabase (Database, Authentication, Storage)
- **AI/ML**: Google Gemini API for voice analysis
- **External APIs**: Google Sheets API, Google OAuth
- **Styling**: Tailwind CSS
- **State Management**: TanStack React Query
- **Build Tool**: Vite with ESLint for code quality

### Key Application Structure

#### Authentication Flow
- **Staff Users**: Authenticated via Supabase Auth with Google OAuth (restricted to @mediamint.com domain)
- **Candidates**: Use service role authentication to bypass Row Level Security (RLS) for assessment submissions
- **Dual Client Architecture**: Regular Supabase client for dashboard operations, service role client for candidate operations

#### Core Components
- **Dashboard** (`src/components/Dashboard/`): Staff interface for managing assessments, viewing results, and monitoring queue
- **Candidate Assessment** (`src/components/Candidate/`): Public-facing assessment interface with system checks and audio recording
- **Authentication** (`src/components/Auth/`): Google OAuth integration with domain restrictions

#### Service Layer Architecture
- **assessmentService.ts**: Queue management, batch processing (max 4 concurrent), candidate creation
- **geminiService.ts**: CEFR assessment with multilingual support, retry logic, dual audio detection
- **storageService.ts**: Supabase file storage for audio recordings and snapshots
- **monitoringService.ts**: Queue monitoring with adaptive intervals
- **candidateSubmissionService.ts**: Handle audio uploads and processing

#### Database Schema (Supabase)
- **candidates**: Candidate information with assessment link tracking and session expiration
- **assessments**: CEFR-based results with detailed analysis (legacy competency fields removed)
- **assessment_queue**: Batch processing queue with priority and retry logic
- **questions**: Assessment prompts with difficulty levels
- **processed_sheets_entries**: Google Sheets integration tracking

## Common Development Commands

### Setup and Installation
```bash
# Install dependencies
npm install

# Start development server (port 5173 by default)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linting
npm run lint
```

### Environment Configuration
Required `.env` variables:
```bash
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# AI Services
VITE_GEMINI_API_KEY=your_gemini_api_key

# Google Services
VITE_GOOGLE_SHEETS_API_KEY=your_google_sheets_api_key
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id
```

### Database Management
```bash
# Navigate to Supabase directory
cd supabase

# Check migration files
Get-ChildItem migrations

# Apply migrations (through Supabase dashboard or CLI)
# Files are in supabase/migrations/ directory
```

## Development Guidelines

### Code Quality Standards
- **TypeScript**: Strict type checking enabled - avoid `any` types
- **ESLint**: Configured with React hooks and TypeScript rules
- **No Type Errors**: All TypeScript errors must be resolved
- **No Build Errors**: Code must compile successfully
- **No Runtime Errors**: Handle errors gracefully with proper error boundaries
- **No Lint Errors**: Follow established linting rules

### Key Development Patterns

#### Service Role vs Regular Client Usage
```typescript
// Use regular client for authenticated dashboard operations
import { supabase } from './lib/supabase';

// Use service role client for candidate operations (bypasses RLS)
import { supabaseServiceRole } from './lib/supabaseServiceRole';
```

#### Error Handling Pattern
```typescript
// Always include comprehensive error handling with logging
try {
  const result = await apiCall();
  console.log('Success:', result);
  return result;
} catch (error) {
  console.error('Operation failed:', error);
  throw new Error(`Detailed error message: ${error.message}`);
}
```

#### Queue Processing Architecture
The assessment queue uses batch processing with:
- **Maximum 4 concurrent assessments** to avoid API rate limits
- **Adaptive retry logic** with exponential backoff
- **Priority-based processing** (manual uploads get higher priority)
- **Queue monitoring every 3 seconds** when active

### Security Considerations

#### Authentication Boundaries
- **Dashboard routes**: Protected by `AuthWrapper` component
- **Candidate assessment routes**: Public with service role backend authentication
- **RLS Policies**: Supabase Row Level Security restricts data access to @mediamint.com users

#### API Key Management
- All API keys stored as environment variables
- Service role key required for candidate file uploads and database operations
- Graceful fallback when service role key is missing

### Testing Assessment Flow

#### Staff Workflow Testing
1. Login to dashboard with @mediamint.com account
2. Generate assessment link via "Generate Assessment"
3. Verify link format: `/commstest/{sessionId}`
4. Monitor queue status in real-time

#### Candidate Assessment Testing
1. Open assessment link in incognito window
2. Allow camera/microphone permissions
3. Complete system check and audio recording
4. Verify submission without "no audio record found" errors
5. Check assessment appears in dashboard with CEFR results

## Key Architecture Decisions

### Migration from Competency-Based to CEFR System
- **Legacy System**: Used `CompetencyScores` with individual skill ratings (removed)
- **Current System**: CEFR levels (A1-C2) with comprehensive analysis
- **Database**: Legacy `competencies_targeted` fields still exist but unused

### Dual Audio Detection
The Gemini service includes sophisticated dual audio detection to identify:
- Multiple speakers in recordings
- Background conversations or prompting
- Distinguishes from ambient noise

### Batch Processing Design
- **Queue-based processing** prevents API overload
- **Service role operations** bypass RLS for performance
- **Automatic retry logic** handles transient failures
- **Real-time monitoring** provides queue status updates

## Troubleshooting Common Issues

### Assessment Loading Issues
- Verify `VITE_SUPABASE_SERVICE_ROLE_KEY` is correctly configured
- Check candidate assessment pages use `supabaseServiceRole` not regular client
- Ensure service role key has proper permissions in Supabase

### Audio Upload Failures
- Confirm storage bucket `voice-assessments` exists with proper policies
- Verify service role client can write to storage
- Check browser console for storage-related errors
- Ensure CORS is configured for your domain

### CEFR Assessment Failures
- Verify `VITE_GEMINI_API_KEY` is active and has quota
- Check network connectivity to Google AI services
- Monitor retry logic and rate limiting
- Review Gemini API error responses for specific issues

## File Structure Context

```
src/
├── components/
│   ├── Auth/           # Authentication components
│   ├── Candidate/      # Public candidate assessment interface
│   ├── Dashboard/      # Staff dashboard and management
│   ├── Layout/         # Header and layout components
│   └── UI/            # Reusable UI components
├── hooks/             # Custom React hooks
├── lib/               # Supabase clients (regular and service role)
├── services/          # Business logic and API integrations
├── types/             # TypeScript type definitions
└── utils/             # Utility functions (CSV export, PDF, session management)
```

## External Dependencies

### Critical Integrations
- **Supabase**: Database, authentication, file storage, RLS policies
- **Google Gemini**: AI-powered CEFR assessment with multilingual support
- **Google Sheets API**: Automated form response processing
- **Google OAuth**: Domain-restricted authentication
- **TanStack Query**: Data fetching and cache management

### Development Dependencies
- **Vite**: Fast build tool and development server
- **TypeScript**: Static type checking
- **ESLint**: Code quality and consistency
- **Tailwind CSS**: Utility-first styling
- **React Router Dom v7**: Client-side routing

## Performance Optimizations

- **Queue-based processing** prevents API overload
- **Batch operations** with configurable concurrency limits
- **Lazy loading** of assessment data
- **React Query caching** minimizes redundant API calls
- **Service role bypass** of RLS for faster candidate operations
