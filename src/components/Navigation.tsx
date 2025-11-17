import { Button } from '@/components/ui/button';
import { LogOut, BarChart3, Home } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate, useLocation } from 'react-router-dom';

export function Navigation() {
  const { userProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();


  const isOnDashboard = location.pathname === '/dashboard';
  const isOnHome = location.pathname === '/';

  return (
    <div className="w-full border-b border-border bg-card/80 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-6">
            <h1 className="font-clash text-xl font-bold text-thirteen-purple">
              THIRTEEN AI
            </h1>
            
            {/* Navigation Tabs */}
            <div className="flex items-center gap-2">
              <Button
                variant={isOnHome ? "default" : "ghost"}
                size="sm"
                onClick={() => navigate('/')}
                className="flex items-center gap-2"
              >
                <Home className="w-4 h-4" />
                New Campaign
              </Button>
              <Button
                variant={isOnDashboard ? "default" : "ghost"}
                size="sm"
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2"
              >
                <BarChart3 className="w-4 h-4" />
                Dashboard
              </Button>
            </div>
          </div>

          {/* User Info and Sign Out */}
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={signOut}
              className="flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}