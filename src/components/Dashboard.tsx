import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Clock, DollarSign, Zap, CheckCircle, XCircle, AlertCircle, RefreshCw, ExternalLink, User, TrendingUp, Target, Award, Trash2, MoreHorizontal } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Navigation } from './Navigation';


interface RunHistory {
  run_id: string;
  status: string;
  created_at: string;
  lead_count: number | null;
  source: string;
  campaign_name: string | null;
}

export function Dashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, signOut } = useAuth();
  const [stats, setStats] = useState({
    totalMessages: 0,
    hoursSaved: 0,
    moneySaved: 0,
  });
  const [runHistory, setRunHistory] = useState<RunHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Get user profile data
  const [userProfile, setUserProfile] = useState<any>(null);

  // Fetch user metrics from Supabase
  const fetchClientMetrics = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('Client Metrics')
        .select('num_personalized_leads,hours_saved,money_saved')
        .eq('user_auth_id', user.id);

      if (error) {
        console.error('Error fetching client metrics:', error);
        return;
      }

      if (data && data.length > 0) {
        // Aggregate data from multiple rows
        const aggregated = data.reduce((acc, row) => ({
          totalMessages: acc.totalMessages + parseInt(row.num_personalized_leads || '0'),
          hoursSaved: acc.hoursSaved + parseInt(row.hours_saved || '0'),
          moneySaved: acc.moneySaved + parseInt(row.money_saved || '0'),
        }), { totalMessages: 0, hoursSaved: 0, moneySaved: 0 });

        setStats(aggregated);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  }, [user?.id]);

  // Fetch run history from Supabase for current user
  const fetchRunHistory = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('AGA Runs Progress')
        .select('*')
        .eq('user_auth_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error fetching run history:', error);
        return;
      }

      if (data) {
        setRunHistory(data);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Fetch user profile
  const fetchUserProfile = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        return;
      }

      setUserProfile(data);
    } catch (error) {
      console.error('Error:', error);
    }
  }, [user?.id]);

  // Fetch data when user is available
  useEffect(() => {
    if (user?.id) {
      fetchUserProfile();
      fetchClientMetrics();
      fetchRunHistory();
    }
  }, [user?.id, fetchUserProfile, fetchClientMetrics, fetchRunHistory]);

  // Set up real-time subscription for run updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('run-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'AGA Runs Progress'
        },
        (payload) => {
          console.log('Run update received:', payload);
          fetchRunHistory(); // Refetch all runs when any update occurs
          fetchClientMetrics(); // Also refetch metrics when runs update
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchRunHistory, fetchClientMetrics, user?.id]);

  // Manual refresh function
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([fetchClientMetrics(), fetchRunHistory()]);
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchClientMetrics, fetchRunHistory]);

  // Delete campaign function
  const deleteCampaign = async (campaignName: string, runId: string) => {
    if (!user) return;

    try {
      // First, find the campaign by name and user
      const { data: campaignData, error: campaignError } = await supabase
        .from('campaigns')
        .select('id')
        .eq('name', campaignName)
        .eq('user_auth_id', user.id)
        .maybeSingle();

      if (campaignError) {
        console.error('Error finding campaign:', campaignError);
        toast({
          title: "Delete Failed",
          description: "Could not find campaign to delete.",
          variant: "destructive",
        });
        return;
      }

      if (!campaignData) {
        toast({
          title: "Campaign Not Found",
          description: "The campaign may have already been deleted.",
          variant: "destructive",
        });
        return;
      }

      // Delete from AGA Runs Progress first (this is what Dashboard shows)
      const { error: runError } = await supabase
        .from('AGA Runs Progress')
        .delete()
        .eq('run_id', runId);

      if (runError) {
        console.error('Error deleting run:', runError);
      }

      // Delete campaign leads (will cascade delete, but being explicit)
      const { error: leadsError } = await supabase
        .from('campaign_leads')
        .delete()
        .eq('campaign_id', campaignData.id);

      if (leadsError) {
        console.error('Error deleting campaign leads:', leadsError);
      }

      // Delete the campaign itself
      const { error: campaignDeleteError } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', campaignData.id);

      if (campaignDeleteError) {
        console.error('Error deleting campaign:', campaignDeleteError);
        toast({
          title: "Delete Failed",
          description: "Failed to delete campaign. Please try again.",
          variant: "destructive",
        });
        return;
      }

      // Update local state immediately for better UX
      setRunHistory(prev => prev.filter(run => run.run_id !== runId));

      toast({
        title: "Campaign Deleted",
        description: `"${campaignName}" has been permanently deleted.`,
      });

      // Refresh data to ensure consistency
      await handleRefresh();

    } catch (error) {
      console.error('Unexpected error during deletion:', error);
      toast({
        title: "Delete Failed", 
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    }
  };


  // Delete all campaigns function
  const deleteAllCampaigns = async () => {
    if (!user) return;

    try {
      // Get all campaigns for the user
      const { data: userCampaigns, error: fetchError } = await supabase
        .from('campaigns')
        .select('id, name')
        .eq('user_auth_id', user.id);

      if (fetchError) {
        console.error('Error fetching campaigns:', fetchError);
        toast({
          title: "Delete Failed",
          description: "Could not fetch campaigns to delete.",
          variant: "destructive",
        });
        return;
      }

      if (!userCampaigns || userCampaigns.length === 0) {
        toast({
          title: "No Campaigns",
          description: "No campaigns found to delete.",
        });
        return;
      }

      const campaignIds = userCampaigns.map(c => c.id);
      const campaignCount = userCampaigns.length;

      // Delete from AGA Runs Progress for all user's campaigns
      const { error: runError } = await supabase
        .from('AGA Runs Progress')
        .delete()
        .in('campaign_name', userCampaigns.map(c => c.name));

      if (runError) {
        console.error('Error deleting runs:', runError);
      }

      // Delete all campaign leads for user's campaigns
      const { error: leadsError } = await supabase
        .from('campaign_leads')
        .delete()
        .in('campaign_id', campaignIds);

      if (leadsError) {
        console.error('Error deleting campaign leads:', leadsError);
      }

      // Delete all campaigns for the user
      const { error: campaignError } = await supabase
        .from('campaigns')
        .delete()
        .eq('user_auth_id', user.id);

      if (campaignError) {
        console.error('Error deleting campaigns:', campaignError);
        toast({
          title: "Delete Failed",
          description: "Failed to delete all campaigns. Please try again.",
          variant: "destructive",
        });
        return;
      }

      // Clear local state immediately
      setRunHistory([]);
      setStats({
        totalMessages: 0,
        hoursSaved: 0,
        moneySaved: 0,
      });

      toast({
        title: "All Campaigns Deleted",
        description: `Successfully deleted ${campaignCount} campaigns and all associated data.`,
      });

      // Refresh data to ensure consistency
      await handleRefresh();

    } catch (error) {
      console.error('Unexpected error during bulk deletion:', error);
      toast({
        title: "Delete Failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'processing':
        return <AlertCircle className="w-4 h-4 text-warning animate-pulse" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-destructive" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string, runId: string) => {
    const variants = {
      completed: 'bg-success/20 text-success-foreground border-success/20',
      processing: 'bg-warning/20 text-warning-foreground border-warning/20',
      failed: 'bg-destructive/20 text-destructive-foreground border-destructive/20'
    };
    
    // Special case for "check instantly campaign" - make it a clickable link
    if (status.toLowerCase() === 'check instantly campaign') {
      return (
        <a
          href={`https://app.instantly.ai/app/campaign/${runId}/leads`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/20 text-primary-foreground border border-primary/20 hover:bg-primary/30 transition-colors cursor-pointer"
        >
          Check Instantly Campaign
        </a>
      );
    }
    
    return (
      <Badge className={variants[status as keyof typeof variants]}>
        {status}
      </Badge>
    );
  };

  const formatTimeAgo = (dateString: string | null) => {
    if (!dateString) {
      return 'Just now';
    }
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return 'Unknown';
    }
    
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) {
      return 'Just now';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}h ago`;
    } else {
      return `${Math.floor(diffInMinutes / 1440)}d ago`;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <Navigation />
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Loading your dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="p-4 sm:p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Analytics Dashboard</h2>
                <p className="text-muted-foreground mt-1 text-sm sm:text-base">
                  Track your AI-powered growth acceleration
                </p>
              </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="w-4 h-4" />
                <span>{user?.email}</span>
              </div>
              <Button 
                onClick={handleRefresh} 
                disabled={isRefreshing}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
          </div>
        </div>


        {/* Enhanced Stats Cards */}
        <TooltipProvider>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8">
            {/* Total Messages Card */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Card className="bg-gradient-surface border-border shadow-card metric-card-hover group cursor-pointer">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Personalized Messages
                    </CardTitle>
                    <div className="p-2 bg-purple-500/20 rounded-lg group-hover:bg-purple-500/30 transition-colors">
                      <Zap className="h-4 w-4 text-purple-400" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-2xl sm:text-3xl font-bold text-purple-400">
                      {stats.totalMessages.toLocaleString()}
                    </div>
                    <Separator />
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs bg-purple-500/20 text-purple-300 border-purple-500/30">
                        <TrendingUp className="w-3 h-3 mr-1" />
                        Generated
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Across all campaigns
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent>
                <p>AI-generated personalized messages for all your campaigns</p>
              </TooltipContent>
            </Tooltip>

            {/* Hours Saved Card */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Card className="bg-gradient-surface border-border shadow-card metric-card-hover group cursor-pointer">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Hours Saved
                    </CardTitle>
                    <div className="p-2 bg-blue-500/20 rounded-lg group-hover:bg-blue-500/30 transition-colors">
                      <Clock className="h-4 w-4 text-blue-400" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-2xl sm:text-3xl font-bold text-blue-400">
                      {stats.hoursSaved.toLocaleString()}
                    </div>
                    <Separator />
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs bg-blue-500/20 text-blue-300 border-blue-500/30">
                        <Clock className="w-3 h-3 mr-1" />
                        Time Saved
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        vs Manual Outreach
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent>
                <p>Time saved using AGA vs manual personalization</p>
              </TooltipContent>
            </Tooltip>

            {/* Money Saved Card */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Card className="bg-gradient-surface border-border shadow-card metric-card-hover group cursor-pointer sm:col-span-2 lg:col-span-1">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Money Saved
                    </CardTitle>
                    <div className="p-2 bg-green-500/20 rounded-lg group-hover:bg-green-500/30 transition-colors">
                      <DollarSign className="h-4 w-4 text-green-400" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-2xl sm:text-3xl font-bold text-green-400">
                      ${stats.moneySaved.toLocaleString()}
                    </div>
                    <Separator />
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs border-green-500/30 text-green-300 bg-green-500/10">
                        <Award className="w-3 h-3 mr-1" />
                        Savings
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Estimated cost reduction
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent>
                <p>Estimated cost savings compared to hiring team members</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>

        {/* Enhanced Run History */}
        <Card className="bg-gradient-surface border-border shadow-card">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3 text-foreground">
              <div className="p-2 bg-primary/10 rounded-lg">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              Recent Activity
              <div className="ml-auto flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {runHistory.length} runs
                </Badge>
                
                {/* Delete All Campaigns Button */}
                {runHistory.length > 0 && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="destructive"
                        size="sm"
                        className="h-7 px-2 text-xs"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Delete All
                      </Button>
                    </AlertDialogTrigger>
                    
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete All Campaigns</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete ALL {runHistory.length} campaigns? 
                          This will permanently delete:
                          <br />• All campaign data
                          <br />• All associated leads 
                          <br />• All run history
                          <br />• All personalized messages
                          <br /><br />
                          <strong>This action cannot be undone.</strong>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={deleteAllCampaigns}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete All Campaigns
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </CardTitle>
            <Separator />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {runHistory.map((run, index) => (
                <TooltipProvider key={run.run_id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div 
                        className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 rounded-xl bg-gradient-to-r from-muted/20 to-muted/10 border border-border/30 gap-3 sm:gap-4 hover:from-muted/30 hover:to-muted/20 hover:border-primary/20 transition-all duration-200 cursor-pointer group"
                        onClick={() => run.campaign_name && navigate(`/campaign/${encodeURIComponent(run.campaign_name)}`)}
                      >
                        {/* Left side - Campaign info */}
                        <div className="flex items-center gap-4">
                          <div className="flex-shrink-0 relative">
                            {getStatusIcon(run.status)}
                            {index < runHistory.length - 1 && (
                              <div className="absolute top-8 left-1/2 transform -translate-x-1/2 w-px h-6 bg-border/30" />
                            )}
                          </div>
                          
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <span className="font-semibold text-foreground text-base group-hover:text-primary transition-colors truncate">
                                {run.campaign_name || 'Unnamed Campaign'}
                              </span>
                              <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Target className="w-3 h-3" />
                                <span>{run.lead_count ? run.lead_count.toLocaleString() : '0'} leads</span>
                              </div>
                              <Separator orientation="vertical" className="h-4" />
                              <span>{formatTimeAgo(run.created_at)}</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Right side - Status and Actions */}
                        <div className="flex items-center gap-3 self-start sm:self-center">
                          {getStatusBadge(run.status, run.run_id)}
                          
                          {/* Delete Button */}
                          <AlertDialog>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem className="text-destructive focus:text-destructive cursor-pointer">
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete Campaign
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            
                            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{run.campaign_name || 'Unnamed Campaign'}"? 
                                  This will permanently delete the campaign and all its leads. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => run.campaign_name && deleteCampaign(run.campaign_name, run.run_id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete Campaign
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Click to view campaign details</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
}