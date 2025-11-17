import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Shield, Users, Settings } from 'lucide-react';

interface User {
  id: string;
  email: string;
  first_name?: string;
  is_power_user: boolean;
}

export function AdminPanel() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    checkAdminStatus();
    fetchUsers();
  }, []);

  const checkAdminStatus = async () => {
    try {
      // Temporarily allow admin access for development
      // In production, you should manually set admin roles in the user_roles table
      setIsAdmin(true);
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, email, first_name, is_power_user')
        .order('email');

      if (error) throw error;
      
      setUsers(data.map(profile => ({
        id: profile.user_id,
        email: profile.email || '',
        first_name: profile.first_name || '',
        is_power_user: profile.is_power_user || false
      })));
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: "Error",
        description: "Failed to fetch users",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const togglePowerUser = async (userId: string, enabled: boolean) => {
    try {
      // Use the secure RPC function we created
      const { error } = await supabase.rpc('set_power_user' as any, {
        _user_id: userId,
        _enabled: enabled
      });

      if (error) throw error;

      setUsers(prev => prev.map(user => 
        user.id === userId 
          ? { ...user, is_power_user: enabled }
          : user
      ));

      toast({
        title: "Success",
        description: `Power user status ${enabled ? 'enabled' : 'disabled'} for user`,
      });
    } catch (error) {
      console.error('Error updating power user status:', error);
      toast({
        title: "Error",
        description: "Failed to update power user status. Admin privileges required.",
        variant: "destructive",
      });
    }
  };

  if (!isAdmin) {
    return (
      <Card className="p-8 bg-gradient-surface border-border">
        <CardContent className="text-center">
          <Shield className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">You need admin privileges to access this panel.</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="p-8 bg-gradient-surface border-border">
        <CardContent className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading admin panel...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-gradient-surface border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Admin Panel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-6">
            Manage user permissions and power user access
          </p>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Users className="w-5 h-5" />
              User Management
            </h3>
            
            <div className="space-y-3">
              {users.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-4 border border-border rounded-lg bg-card">
                  <div>
                    <p className="font-medium">{user.first_name || 'Unknown'}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`power-user-${user.id}`} className="text-sm">
                      Power User
                    </Label>
                    <Switch
                      id={`power-user-${user.id}`}
                      checked={user.is_power_user}
                      onCheckedChange={(checked) => togglePowerUser(user.id, checked)}
                    />
                  </div>
                </div>
              ))}
              
              {users.length === 0 && (
                <p className="text-muted-foreground text-center py-4">
                  No users found
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}