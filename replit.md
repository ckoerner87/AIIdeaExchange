# How Do You Use AI - Full-Stack Application

## Overview

This is a full-stack web application built to collect and showcase creative AI use cases from the community. Users can submit their AI ideas, vote on others' submissions, and engage through comments. The platform features a submission-gated access model where users must contribute an idea to unlock the full community experience.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **Styling**: Tailwind CSS with shadcn/ui component library
- **Build Tool**: Vite for fast development and optimized builds
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express.js server
- **Language**: TypeScript with ES modules
- **API Design**: RESTful API endpoints
- **Session Management**: Express sessions with PostgreSQL store
- **Authentication**: Passport.js with local strategy and optional Replit OAuth

### Data Storage
- **Database**: PostgreSQL (configured for Neon serverless)
- **ORM**: Drizzle ORM for type-safe database operations
- **Schema Management**: Drizzle Kit for migrations
- **Connection**: Neon serverless driver with WebSocket support

## Key Components

### Database Schema (shared/schema.ts)
- **ideas**: Core content with voting, categorization, and AI grading
- **subscriptions**: Email newsletter management
- **userSessions**: Anonymous session tracking with submission status
- **votes**: Vote tracking with IP-based fraud prevention
- **users**: User accounts (optional authentication)
- **comments**: Threaded commenting system

### Content Management
- **AI Grading**: OpenAI GPT-4o integration for automated idea scoring
- **Content Filtering**: Automated content moderation for submissions and comments
- **Media Support**: Text, link, and media post types (Reddit-style)

### User Experience Features
- **Submission Gate**: Users must submit an idea to access the full community
- **Anonymous Sessions**: Track user activity without requiring accounts
- **Voting System**: Upvote/downvote with spam prevention
- **Social Sharing**: Built-in sharing functionality for ideas

### External Integrations
- **Email Services**: 
  - Beehiiv API for newsletter subscriptions
  - SendGrid for transactional emails
  - Google Sheets for backup email storage
- **Analytics**: Google Analytics 4 integration
- **AI Services**: OpenAI API for content grading

## Data Flow

1. **User Arrival**: Anonymous session created, tracked in localStorage
2. **Idea Submission**: Content validated, AI-graded, stored with session linkage
3. **Access Unlock**: User gains voting and viewing privileges after submission
4. **Community Interaction**: Voting, commenting, and social features become available
5. **Optional Registration**: Users can create accounts for persistent identity

## External Dependencies

### Required Environment Variables
- `DATABASE_URL`: PostgreSQL connection string
- `OPENAI_API_KEY`: For AI grading functionality
- `SESSION_SECRET`: Express session encryption key

### Optional Integrations
- `BEEHIIV_API_KEY` & `BEEHIIV_PUBLICATION_ID`: Newsletter subscriptions
- `SENDGRID_API_KEY`: Email notifications
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` & `GOOGLE_PRIVATE_KEY`: Sheets integration
- `VITE_GA_MEASUREMENT_ID`: Google Analytics tracking
- `REPL_ID` & `ISSUER_URL`: Replit OAuth integration

## Deployment Strategy

### Development
- Uses `tsx` for TypeScript execution
- Vite dev server with HMR for frontend
- PostgreSQL module configured in Replit environment

### Production Build
- Frontend: Vite build to `dist/public`
- Backend: esbuild bundle to `dist/index.js`
- Static asset serving with compression and caching headers
- Auto-scaling deployment target on Replit

### Performance Optimizations
- Lazy loading for non-critical components
- Image optimization and lazy loading
- Gzip compression for all responses
- Aggressive caching for static assets
- Database query optimization with proper indexing

## User Preferences

Preferred communication style: Simple, everyday language.

## Changelog

Changelog:
- June 14, 2025. Initial setup