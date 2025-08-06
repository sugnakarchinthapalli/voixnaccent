# Voice Assessment Tool

A comprehensive AI-powered voice assessment application built for MediaMint, featuring automated Google Sheets integration, batch processing, and detailed competency scoring.

## Features

### 🔐 Authentication & Security
- Google OAuth integration restricted to @mediamint.com domain
- Row-level security (RLS) in Supabase database
- Secure API key management

### 🤖 AI-Powered Assessment
- Google Gemini API integration for voice analysis
- 6-competency scoring framework:
  - Clarity & Articulation
  - Pace
  - Tone & Modulation
  - Accent Neutrality
  - Confidence & Energy
  - Grammar & Fluency
- Red/Amber/Green color-coded scoring system

### 📊 Automated Processing
- Google Sheets monitoring for new form responses
- Batch processing with max 2 simultaneous assessments
- Queue management with priority system
- Real-time progress tracking

### 📁 Manual Upload Support
- Vocaroo link integration
- File upload capability (requires backend setup)
- Manual candidate entry with immediate processing

### 🎯 Dashboard & Analytics
- Comprehensive assessment results table
- Advanced filtering and search functionality
- CSV export with complete data
- Assessment tracking (Form Response vs Manual)
- Real-time queue status monitoring

## Tech Stack

- **Frontend**: Vite + React + TypeScript
- **Backend**: Supabase (Database, Auth, RLS)
- **AI**: Google Gemini API
- **External APIs**: Google Sheets API
- **Styling**: Tailwind CSS
- **State Management**: React Query (TanStack Query)

## Setup Instructions

### 1. Environment Variables

Create a `.env` file in the root directory:

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Google Gemini API
VITE_GEMINI_API_KEY=your_gemini_api_key

# Google Sheets API
VITE_GOOGLE_SHEETS_API_KEY=your_google_sheets_api_key

# Google OAuth
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id
```

### 2. Database Setup

1. Connect to your Supabase project
2. Run the migration file: `supabase/migrations/create_voice_assessment_schema.sql`
3. This will create all necessary tables with RLS policies

### 3. Google Services Configuration

#### Google Sheets API
1. Enable Google Sheets API in Google Cloud Console
2. Create API credentials
3. Update the sheet ID in `src/services/googleSheetsService.ts`

#### Google OAuth
1. Configure OAuth consent screen in Google Cloud Console
2. Add authorized redirect URIs for your domain
3. Restrict to @mediamint.com domain

#### Google Gemini API
1. Get API key from Google AI Studio
2. Add to environment variables

### 4. Installation & Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Database Schema

### Tables
- **candidates**: Stores candidate information and audio sources
- **assessments**: Contains AI-generated scores and feedback
- **assessment_queue**: Manages batch processing queue
- **processed_sheets_entries**: Tracks processed Google Sheets entries

### Key Features
- Row Level Security (RLS) restricts access to @mediamint.com users
- Immutable `assessed_by` field tracks assessment origin
- Comprehensive indexing for performance
- Foreign key constraints for data integrity

## Usage

### Automated Workflow
1. Google Sheets form responses are monitored automatically
2. New entries create candidate records
3. Assessments are queued and processed in batches
4. Results appear in dashboard with "Form Response" as assessor

### Manual Workflow
1. Click "Manual Upload" in dashboard
2. Enter candidate details
3. Provide Vocaroo link or upload audio file
4. Assessment is queued with high priority
5. Results show current user email as assessor

### Dashboard Features
- **Search**: Find candidates by name, email, or assessor
- **Filter**: By date range, grade, or assessment type
- **Export**: Download filtered results as CSV
- **Real-time Updates**: Queue status and new assessments
- **Detailed View**: Complete competency breakdown and feedback

## Deployment

### Vercel Deployment
1. Connect repository to Vercel
2. Add environment variables in Vercel dashboard
3. Configure domain for OAuth redirect URIs
4. Deploy automatically on push to main branch

### Environment Configuration
- Database: Supabase (automatically scales)
- Authentication: Handled by Supabase Auth
- File Storage: Requires additional setup for file uploads
- Monitoring: Built-in error handling and logging

## Security Considerations

- **Domain Restriction**: Only @mediamint.com accounts can access
- **API Security**: All API keys are environment-based
- **Database Security**: RLS policies prevent unauthorized access
- **Input Validation**: All user inputs are validated and sanitized
- **Audit Trail**: Immutable assessment tracking

## Performance Optimizations

- **Batch Processing**: Max 2 concurrent API calls
- **Rate Limiting**: 3-second delays between requests
- **Database Indexing**: Optimized queries for large datasets
- **Lazy Loading**: Efficient data fetching
- **Caching**: Minimizes redundant API calls

## Monitoring & Maintenance

- **Queue Status**: Real-time processing monitoring
- **Error Handling**: Comprehensive error logging
- **Retry Logic**: Failed assessments are retried automatically
- **Health Checks**: Database connectivity monitoring

## Future Enhancements

- **File Storage**: Direct audio file uploads
- **Advanced Analytics**: Trends and insights dashboard
- **Bulk Operations**: Mass assessment management
- **Integration APIs**: Third-party system integration
- **Mobile Support**: Responsive mobile experience

## Support

For technical support or feature requests, contact the development team.