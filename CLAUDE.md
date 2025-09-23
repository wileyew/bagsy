# Claude AI Assistant Guidelines for Bagsy Development

## 🎯 **Project Overview**
Bagsy is an AI-powered space booking platform built with React, TypeScript, Vite, and Supabase. The application enables users to list, discover, and book various types of storage spaces (garages, driveways, warehouses, etc.) with AI-enhanced features.

## 🏗️ **Architecture & Tech Stack**

### **Frontend**
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 5.x
- **Styling**: Tailwind CSS + shadcn/ui components
- **State Management**: React Context + Custom hooks
- **Routing**: React Router (implied from structure)

### **Backend & Database**
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth with Google OAuth
- **File Storage**: Supabase Storage buckets
- **Real-time**: Supabase real-time subscriptions

### **AI Services**
- **Primary**: OpenAI GPT-4o for analysis and recommendations
- **Request Management**: Custom retry logic with exponential backoff
- **Features**: Photo analysis, pricing optimization, smart scheduling, marketing content

### **Deployment**
- **Platform**: AWS Amplify
- **Environment**: Production and staging configurations

## 🔧 **Key Development Patterns**

### **File Structure**
```
src/
├── components/          # Reusable UI components
│   ├── auth/           # Authentication components
│   ├── spaces/         # Space-related components
│   └── ui/             # shadcn/ui components
├── contexts/           # React Context providers
├── hooks/              # Custom React hooks
├── integrations/       # External service integrations
├── lib/                # Utility libraries and services
├── pages/              # Route components
└── types/              # TypeScript type definitions
```

### **AI Service Architecture**
- **Centralized Request Manager**: `openai-request-manager.ts`
- **Service Layer**: Individual AI services with retry logic
- **Fallback System**: Mock data when API fails
- **Request Limiting**: Maximum 2 requests per session

### **Database Schema**
- **Spaces**: Core space listings with AI-enhanced data
- **Users**: User profiles and preferences
- **Bookings**: Reservation management
- **AI Analytics**: AI-generated insights and recommendations

## 🚀 **Development Workflow**

### **Getting Started**
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run linting
npm run lint
```

### **Environment Variables**
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_OPENAI_API_KEY=your_openai_api_key
VITE_SCRAPINGBEE_API_KEY=your_scrapingbee_key
```

### **Database Migrations**
- Located in `supabase/migrations/`
- Use Supabase CLI for local development
- Run migrations before deploying

## 🧠 **AI Integration Guidelines**

### **Request Management**
- **Always use** `openaiRequestManager.executeWithRetry()` for API calls
- **Maximum 2 attempts** per request with exponential backoff
- **Smart error handling**: Quota errors vs network errors
- **Fallback to mock data** when API fails

### **AI Service Pattern**
```typescript
// ✅ Correct pattern
async someAIMethod(): Promise<Result> {
  try {
    return await openaiRequestManager.executeWithRetry(async () => {
      // API call logic here
      const response = await fetch(/* ... */);
      return processResponse(response);
    }, 'Context Name');
  } catch (error) {
    // Fallback to mock data
    return this.fallbackMethod();
  }
}
```

### **Available AI Services**
- **AI Service**: Photo analysis and space listing generation
- **AI Recommendations**: Personalized user recommendations
- **Smart Scheduling**: Availability optimization and demand prediction
- **Marketing Content**: SEO content and social media generation
- **Web Scraping**: Market research and competitor analysis

## 🔍 **Debugging & Testing**

### **Debug Utilities**
- **Component Debugger**: `createComponentDebugger()` for service logging
- **Console Logging**: Comprehensive logging throughout AI services
- **Request Tracking**: Detailed request/response logging

### **Testing Strategy**
- **Unit Tests**: Individual service methods
- **Integration Tests**: AI service interactions
- **Manual Testing**: Browser console test suite available
- **Mock Data**: Comprehensive fallback data for all services

### **Common Issues & Solutions**

#### **Infinite Network Calls**
- **Cause**: Improper retry logic implementation
- **Solution**: Use centralized request manager with proper slot reservation

#### **API Quota Exceeded**
- **Cause**: Too many requests in short time
- **Solution**: Request limiting (2 per session) + fallback to mock data

#### **Build Failures**
- **Cause**: TypeScript errors or missing dependencies
- **Solution**: Run `npm run build` to identify issues, fix TypeScript errors

## 📋 **Code Quality Standards**

### **TypeScript**
- **Strict Mode**: Enabled for type safety
- **Interface Definitions**: Comprehensive type definitions
- **Error Handling**: Proper error types and handling

### **Component Patterns**
- **Functional Components**: Use React hooks
- **Custom Hooks**: Extract reusable logic
- **Context Providers**: For global state management
- **shadcn/ui**: Consistent UI component library

### **AI Service Patterns**
- **Error Boundaries**: Graceful degradation
- **Fallback Data**: Always provide mock alternatives
- **Logging**: Comprehensive debug information
- **Performance**: Efficient request management

## 🚀 **Deployment Considerations**

### **AWS Amplify**
- **Build Settings**: Configured in `amplify.yml`
- **Environment Variables**: Set in Amplify console
- **Redirects**: Handled in `_redirects` file

### **Supabase**
- **Database Migrations**: Run before deployment
- **Storage Buckets**: Configure policies properly
- **RLS Policies**: Enable row-level security

### **Performance Optimization**
- **Bundle Size**: Monitor with Vite build analysis
- **API Calls**: Limited to prevent quota issues
- **Caching**: Implement appropriate caching strategies

## 🎯 **Common Development Tasks**

### **Adding New AI Features**
1. Create service in `src/lib/`
2. Implement retry logic with `openaiRequestManager`
3. Add fallback mock data
4. Create UI components
5. Add comprehensive logging

### **Database Schema Changes**
1. Create migration in `supabase/migrations/`
2. Update TypeScript types
3. Test locally with Supabase CLI
4. Deploy migration

### **UI Component Development**
1. Use shadcn/ui components as base
2. Follow Tailwind CSS patterns
3. Implement responsive design
4. Add proper TypeScript types

## 🔗 **Useful Resources**

- **Supabase Docs**: https://supabase.com/docs
- **Vite Guide**: https://vitejs.dev/guide/
- **Tailwind CSS**: https://tailwindcss.com/docs
- **shadcn/ui**: https://ui.shadcn.com/
- **OpenAI API**: https://platform.openai.com/docs

## 📞 **Support & Troubleshooting**

### **When Things Go Wrong**
1. Check browser console for errors
2. Verify environment variables
3. Test AI services individually
4. Check Supabase dashboard for database issues
5. Review request manager logs

### **Performance Issues**
1. Monitor network tab for excessive API calls
2. Check request manager status
3. Verify fallback mechanisms work
4. Review bundle size and loading times

---

**Remember**: Always use the centralized request manager for AI calls, implement proper fallbacks, and maintain comprehensive logging for debugging.
