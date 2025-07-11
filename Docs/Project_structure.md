# Project Structure

## Root Directory

```
mindsift-frontend-v0/
   app/                          # Next.js App Router pages and layouts
      (auth)/                   # Authentication route group
         login/               
         signup/              
      api/                     # API route handlers
         auth/               
         chat/               
         video/              
         channel/            
      watch/                   # Video chat pages
         [id]/               
      channel/                 # Channel chat pages
         [id]/               
      dashboard/               # User dashboard
      globals.css              # Global styles
      layout.tsx               # Root layout
      page.tsx                 # Landing page
      loading.tsx              # Loading UI
   components/                   # Reusable UI components
      ui/                      # shadcn/ui components
         button.tsx          
         input.tsx           
         card.tsx            
         dialog.tsx          
         ...                 
      chat/                    # Chat-specific components
         ChatInterface.tsx   
         MessageBubble.tsx   
         ChatInput.tsx       
         CitationLink.tsx    
      video/                   # Video-specific components
         VideoPlayer.tsx     
         ThumbnailGrid.tsx   
         VideoMetadata.tsx   
      layout/                  # Layout components
         Header.tsx          
         Footer.tsx          
         Sidebar.tsx         
         Navigation.tsx      
      forms/                   # Form components
         URLInput.tsx        
         ChannelForm.tsx     
         FeedbackForm.tsx    
      common/                  # Common components
          LoadingSpinner.tsx  
          ErrorBoundary.tsx   
          ProgressBar.tsx     
          StatusBadge.tsx     
   lib/                         # Utility functions and configurations
      supabase/               # Supabase client and utilities
         client.ts           
         server.ts           
         middleware.ts       
         types.ts            
      clerk/                  # Clerk authentication utilities
         config.ts           
         middleware.ts       
      youtube/                # YouTube API utilities
         api.ts              
         parser.ts           
         transcript.ts       
      openai/                 # OpenAI API utilities
         client.ts           
         embeddings.ts       
         chat.ts             
      email/                  # Email service utilities
         resend.ts           
         templates.ts        
      database/               # Database utilities
         queries.ts          
         mutations.ts        
         types.ts            
      utils.ts                # General utility functions
   hooks/                       # Custom React hooks
      useAuth.ts              # Authentication hook
      useVideo.ts             # Video state management
      useChat.ts              # Chat state management
      useChannel.ts           # Channel state management
      useLocalStorage.ts      # Local storage hook
      useDebounce.ts          # Debounce hook
   services/                    # API service functions
      api.ts                  # Base API configuration
      auth.ts                 # Authentication services
      video.ts                # Video-related services
      chat.ts                 # Chat services
      channel.ts              # Channel services
      user.ts                 # User services
   types/                       # TypeScript type definitions
      auth.ts                 # Authentication types
      video.ts                # Video-related types
      chat.ts                 # Chat types
      channel.ts              # Channel types
      database.ts             # Database types
      api.ts                  # API response types
   context/                     # React Context providers
      AuthContext.tsx         
      TranscriptContext.tsx   
      ThemeContext.tsx        
      ChatContext.tsx         
   styles/                      # Additional styling files
      globals.css             
      components.css          
   public/                      # Static assets
      images/                 
      icons/                  
      favicon.ico             
   Docs/                        # Project documentation
      Bug_tracking.md         
      Implementation.md       
      Project_structure.md    
      UI_UX_doc.md           
      ui.json                 
      youtube-transcript-downloader.md
   rules/                       # Development rules and guidelines
      generate.mdc            
      workflow.mdc            
   tests/                       # Test files
      __mocks__/              
      components/             
      pages/                  
      services/               
      utils/                  
   .env.local                   # Environment variables
   .env.example                 # Example environment variables
   .gitignore                   # Git ignore rules
   next.config.js               # Next.js configuration
   tailwind.config.js           # Tailwind CSS configuration
   tsconfig.json                # TypeScript configuration
   package.json                 # npm dependencies and scripts
   package-lock.json            # npm lockfile
   README.md                    # Project readme
   eslint.config.js             # ESLint configuration
```

## Detailed Structure Explanation

### `/app` Directory (Next.js App Router)
The main application directory using Next.js 13+ App Router structure:

- **Route Groups**: `(auth)` for authentication-related pages
- **Dynamic Routes**: `[id]` for video and channel pages
- **API Routes**: RESTful endpoints for backend functionality
- **Special Files**: `layout.tsx`, `page.tsx`, `loading.tsx`, `error.tsx`

### `/components` Directory
Organized by feature and reusability:

- **`/ui`**: Base UI components from shadcn/ui
- **`/chat`**: Chat-specific functionality components
- **`/video`**: Video player and related components
- **`/layout`**: Page layout and navigation components
- **`/forms`**: Form components with validation
- **`/common`**: Shared utility components

### `/lib` Directory
Core utility functions and configurations:

- **`/supabase`**: Database client and server utilities
- **`/clerk`**: Authentication configuration
- **`/youtube`**: YouTube API integration
- **`/openai`**: LLM and embeddings utilities
- **`/email`**: Email service configuration
- **`/database`**: Database query helpers

### `/hooks` Directory
Custom React hooks for state management:

- **`useAuth`**: User authentication state
- **`useVideo`**: Video playback and metadata
- **`useChat`**: Chat messages and responses
- **`useChannel`**: Channel indexing status
- **Utility hooks**: localStorage, debounce, etc.

### `/services` Directory
API service layer for external integrations:

- **Separation of concerns**: Each service handles specific functionality
- **Error handling**: Centralized error handling for API calls
- **Type safety**: Full TypeScript support for API responses

### `/types` Directory
TypeScript type definitions:

- **Domain types**: Video, Chat, Channel, User entities
- **API types**: Request/response interfaces
- **Database types**: Supabase generated types
- **Utility types**: Generic helper types

### `/context` Directory
React Context providers for global state:

- **AuthContext**: User authentication state
- **TranscriptContext**: Video transcript caching
- **ThemeContext**: Dark/light mode toggle
- **ChatContext**: Chat session management

## File Naming Conventions

### React Components
- **PascalCase**: `VideoPlayer.tsx`, `ChatInterface.tsx`
- **Descriptive names**: Component purpose should be clear
- **File extension**: `.tsx` for components, `.ts` for utilities

### API Routes
- **kebab-case**: `video-metadata.ts`, `channel-queue.ts`
- **RESTful naming**: GET, POST, PUT, DELETE methods
- **Nested structure**: `/api/video/[id]/transcript.ts`

### Utility Functions
- **camelCase**: `parseYouTubeUrl`, `formatTimestamp`
- **Descriptive names**: Function purpose should be clear
- **Pure functions**: Avoid side effects where possible

### Database Files
- **snake_case**: Following PostgreSQL conventions
- **Descriptive names**: Table and column purposes clear
- **Consistent prefixes**: `video_`, `channel_`, `user_`

## Module Organization Patterns

### Barrel Exports
```typescript
// /components/index.ts
export { VideoPlayer } from './video/VideoPlayer';
export { ChatInterface } from './chat/ChatInterface';
export { Button } from './ui/button';
```

### Service Layer Pattern
```typescript
// /services/video.ts
export class VideoService {
  static async getMetadata(videoId: string) { }
  static async getTranscript(videoId: string) { }
  static async processVideo(videoId: string) { }
}
```

### Hook Pattern
```typescript
// /hooks/useVideo.ts
export function useVideo(videoId: string) {
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Hook logic here
  
  return { video, loading, error, refetch };
}
```

## Configuration File Locations

### Environment Configuration
- **`.env.local`**: Local development environment variables
- **`.env.example`**: Template for required environment variables
- **Supabase**: Database URL, anon key, service role key
- **Clerk**: Public key, secret key, webhook secrets
- **APIs**: YouTube API key, OpenAI API key, Resend API key

### Build Configuration
- **`next.config.js`**: Next.js build and runtime configuration
- **`tailwind.config.js`**: Tailwind CSS customization
- **`tsconfig.json`**: TypeScript compiler options
- **`eslint.config.js`**: Code linting rules

### Package Management
- **`package.json`**: Dependencies, scripts, and metadata
- **`package-lock.json`**: Exact dependency versions
- **Node.js version**: Specified in `.nvmrc` or `engines` field

## Asset Organization

### Static Assets (`/public`)
- **Images**: Logo, icons, placeholder images
- **Icons**: SVG icons for UI components
- **Fonts**: Custom web fonts if needed
- **Manifest**: PWA manifest file

### Styles (`/styles`)
- **Global styles**: CSS reset, typography, utilities
- **Component styles**: Component-specific CSS
- **Tailwind**: Primary styling framework
- **CSS variables**: Theme tokens and custom properties

## Documentation Placement

### Code Documentation
- **JSDoc comments**: For functions and classes
- **README files**: In major directories
- **Type annotations**: Comprehensive TypeScript types
- **API documentation**: Generated from code comments

### Project Documentation (`/Docs`)
- **Implementation.md**: Technical implementation plan
- **Project_structure.md**: This file
- **UI_UX_doc.md**: Design system and user experience
- **Bug_tracking.md**: Issue tracking and resolution

## Build and Deployment Structure

### Development Environment
- **Local development**: `npm run dev`
- **Type checking**: `npm run type-check`
- **Linting**: `npm run lint`
- **Testing**: `npm run test`

### Production Build
- **Build process**: `npm run build`
- **Static export**: `npm run export` (if needed)
- **Deployment**: Automated via Vercel or similar platform
- **Environment variables**: Production-specific configuration

### CI/CD Pipeline
- **GitHub Actions**: Automated testing and deployment
- **Quality gates**: Tests, linting, type checking
- **Deployment**: Automatic deployment on merge to main
- **Environment promotion**: Dev � Staging � Production

## Environment-Specific Configurations

### Development
- **Hot reload**: Next.js development server
- **Debug mode**: Console logging and error details
- **Mock data**: Testing with fake data
- **Local database**: Development Supabase instance

### Staging
- **Production build**: Optimized for performance
- **Real APIs**: Connected to staging services
- **Testing**: End-to-end testing environment
- **Monitoring**: Basic performance monitoring

### Production
- **Optimized build**: Minified and compressed
- **CDN**: Static asset delivery
- **Monitoring**: Full observability stack
- **Security**: Rate limiting, CORS, CSP headers

## Development Workflow

### Getting Started
1. **Clone repository**: `git clone <repo-url>`
2. **Install dependencies**: `npm install`
3. **Set up environment**: Copy `.env.example` to `.env.local`
4. **Configure services**: Set up Supabase, Clerk, and API keys
5. **Run development server**: `npm run dev`

### Code Organization Guidelines
- **Single responsibility**: Each file has one clear purpose
- **Consistent structure**: Follow established patterns
- **Documentation**: Comment complex logic and decisions
- **Testing**: Write tests for critical functionality
- **Version control**: Meaningful commit messages and PR descriptions

---

*This project structure is designed to scale with the application while maintaining clear separation of concerns and developer productivity.*