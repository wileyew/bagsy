# 🏠 Bagsy - AI-Powered Space Booking Platform

> **Find, list, and book the perfect storage space in seconds with AI-enhanced features.**

[![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?style=flat-square&logo=vite)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.x-06B6D4?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)

## 🎯 **Overview**

Bagsy is a modern, AI-powered platform that revolutionizes space rental by connecting property owners with people who need storage space. Whether it's a garage, driveway, warehouse, or custom space, Bagsy uses advanced AI to optimize listings, pricing, and user experience.

### **Key Features**

- 🤖 **AI-Powered Analysis**: Automatic photo analysis and listing generation
- 💰 **Smart Pricing**: Dynamic pricing optimization based on market data
- 📅 **Smart Scheduling**: Optimal availability windows and demand prediction
- 📢 **Marketing Content**: AI-generated SEO content and social media posts
- 🔍 **Market Research**: Web scraping for competitive analysis
- 📊 **Analytics**: Predictive insights and performance optimization
- 🔐 **Secure Authentication**: Google OAuth integration
- 📱 **Responsive Design**: Mobile-first, modern UI

## 🏗️ **Architecture**

### **Tech Stack**

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | React 18 + TypeScript | Modern, type-safe UI |
| **Build Tool** | Vite 5.x | Fast development and building |
| **Styling** | Tailwind CSS + shadcn/ui | Consistent, responsive design |
| **Backend** | Supabase | Database, auth, storage, real-time |
| **AI Services** | OpenAI GPT-4o | Photo analysis, content generation |
| **Deployment** | AWS Amplify | Scalable cloud hosting |

## 🚀 **Quick Start**

### **Prerequisites**

- Node.js 18+ and npm
- Supabase account and project
- OpenAI API key (optional - falls back to mock data)

### **Installation**

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd bagsy
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Configure your `.env.local`:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_OPENAI_API_KEY=your_openai_api_key
   VITE_SCRAPINGBEE_API_KEY=your_scrapingbee_key
   ```

4. **Start development server**
   ```bash
npm run dev
```

5. **Open in browser**
   ```
   http://localhost:8080
   ```

## 📁 **Project Structure**

```
bagsy/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── auth/           # Authentication components
│   │   ├── spaces/         # Space listing components
│   │   └── ui/             # shadcn/ui components
│   ├── contexts/           # React Context providers
│   ├── hooks/              # Custom React hooks
│   ├── integrations/       # External service integrations
│   │   └── supabase/       # Supabase client & types
│   ├── lib/                # Core services and utilities
│   │   ├── ai-service.ts   # Main AI service
│   │   ├── openai-request-manager.ts  # Request management
│   │   └── *.ts           # Other AI services
│   ├── pages/              # Route components
│   └── types/              # TypeScript definitions
├── supabase/
│   ├── migrations/         # Database migrations
│   └── config.toml         # Supabase configuration
├── public/                 # Static assets
└── dist/                   # Build output
```

## 🧠 **AI Features**

### **1. Photo Analysis**
- Automatic space type detection
- Dimension estimation
- Feature extraction
- Pricing suggestions

### **2. Smart Pricing**
- Market-based optimization
- Demand pattern analysis
- Competitive positioning
- Revenue maximization

### **3. Smart Scheduling**
- Optimal availability windows
- Demand forecasting
- Peak hour identification
- Dynamic pricing adjustments

### **4. Marketing Content**
- SEO-optimized titles and descriptions
- Social media content generation
- Email campaign templates
- Listing optimization suggestions

### **5. Market Research**
- Competitor analysis
- Price trend monitoring
- Market positioning
- Competitive advantages

## 🔧 **Development**

### **Available Scripts**

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

### **AI Service Development**

When adding new AI features:

1. **Create service in `src/lib/`**
2. **Use the request manager pattern**:
   ```typescript
   import { openaiRequestManager } from './openai-request-manager';
   
   async myAIFeature(): Promise<Result> {
     try {
       return await openaiRequestManager.executeWithRetry(async () => {
         // Your AI API call here
         const response = await fetch(/* ... */);
         return processResponse(response);
       }, 'My AI Feature');
     } catch (error) {
       // Fallback to mock data
       return this.fallbackMethod();
     }
   }
   ```
3. **Add comprehensive fallback data**
4. **Include detailed logging**
5. **Test with and without API keys**

## 🚀 **Deployment**

### **AWS Amplify**

1. **Connect repository** to Amplify
2. **Set environment variables** in Amplify console
3. **Configure build settings** (already in `amplify.yml`)
4. **Deploy** automatically on push to main

### **Environment Variables**

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_SUPABASE_URL` | Supabase project URL | ✅ |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key | ✅ |
| `VITE_OPENAI_API_KEY` | OpenAI API key | ❌ (falls back to mock) |
| `VITE_SCRAPINGBEE_API_KEY` | Web scraping service key | ❌ (falls back to mock) |

## 🧪 **Testing**

### **Current Testing Strategy**

- **Manual Testing**: Browser console test suite
- **AI Service Testing**: Built-in retry mechanism testing
- **Fallback Testing**: Mock data verification
- **Integration Testing**: End-to-end user flows

### **Test the AI Features**

```javascript
// In browser console
retryTestSuite.runAllTests()  // Test retry mechanism
```

## 📈 **Performance**

### **Optimizations**

- **Request Limiting**: Maximum 2 AI requests per session
- **Retry Logic**: Smart exponential backoff
- **Fallback System**: Instant mock data when API fails
- **Bundle Optimization**: Tree-shaking and code splitting
- **Caching**: Efficient data caching strategies

## 🤝 **Contributing**

### **Development Guidelines**

1. **Follow TypeScript strict mode**
2. **Use the centralized request manager** for AI calls
3. **Implement comprehensive fallbacks**
4. **Add detailed logging** for debugging
5. **Test with and without API keys**
6. **Follow existing code patterns**

## 📞 **Support & Troubleshooting**

### **Common Issues**

#### **Build Failures**
```bash
npm run build  # Check for TypeScript errors
npm run lint   # Fix linting issues
```

#### **AI Services Not Working**
1. Check API keys in environment variables
2. Verify fallback data is working
3. Check browser console for errors
4. Test retry mechanism: `retryTestSuite.runAllTests()`

#### **Database Issues**
1. Check Supabase connection
2. Verify migrations are applied
3. Check RLS policies
4. Review database logs

## 📄 **License**

This project is licensed under the MIT License.

## 🙏 **Acknowledgments**

- **OpenAI** for GPT-4o API
- **Supabase** for backend infrastructure
- **shadcn/ui** for beautiful components
- **Tailwind CSS** for utility-first styling
- **Vite** for fast development experience

---

**Built with ❤️ using modern web technologies and AI**

For more detailed development guidelines, see [CLAUDE.md](CLAUDE.md)