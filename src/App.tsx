import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/contexts/auth-context';
import { Toaster } from '@/components/ui/toaster';
import Index from '@/pages/Index';
import MyListings from '@/pages/MyListings';
import MyBookings from '@/pages/MyBookings';
import AIAgentHelp from '@/pages/AIAgentHelp';
import AuthCallback from '@/pages/AuthCallback';
import NotFound from '@/pages/NotFound';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/my-listings" element={<MyListings />} />
          <Route path="/my-bookings" element={<MyBookings />} />
          <Route path="/ai-agent-help" element={<AIAgentHelp />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Toaster />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
