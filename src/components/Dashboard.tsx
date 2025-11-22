import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Clock, CheckCircle, XCircle, AlertCircle, RefreshCw, ExternalLink, User, Target, Trash2, MoreHorizontal, Rocket } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  const { user } = useAuth();
  const [runHistory, setRunHistory] = useState<RunHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

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
        // Fetch completed counts from campaigns table for each run
        const runsWithCompletedCounts = await Promise.all(
          data.map(async (run) => {
            if (run.campaign_name) {
              const { data: campaignData } = await supabase
                .from('campaigns')
                .select('completed_count')
                .eq('name', run.campaign_name)
                .eq('user_auth_id', user.id)
                .maybeSingle();

              return {
                ...run,
                lead_count: parseInt(campaignData?.completed_count || '0') || 0
              };
            }
            return run;
          })
        );

        setRunHistory(runsWithCompletedCounts);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Fetch data when user is available
  useEffect(() => {
    if (user?.id) {
      fetchRunHistory();
    }
  }, [user?.id, fetchRunHistory]);

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
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchRunHistory, user?.id]);

  // Manual refresh function
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await fetchRunHistory();
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchRunHistory]);

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
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-background to-blue-500/5" />
        <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-500/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob" />
        <div className="absolute top-0 -right-4 w-72 h-72 bg-blue-500/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000" />
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-500/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000" />
      </div>

      <Navigation />

      {/* Main Container */}
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
        {/* Top Bar - Stats Overview */}
        <div className="mb-6 sm:mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {/* Total Personalized Messages */}
            <Card className="border-2 hover:shadow-2xl hover:shadow-green-500/20 hover:-translate-y-1 transition-all duration-300 backdrop-blur-sm bg-background/80">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 sm:mb-2">
                      Personalized Messages
                    </p>
                    <p className="text-2xl sm:text-3xl font-bold text-green-500">
                      {runHistory.reduce((sum, run) => sum + (run.lead_count || 0), 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
                    <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-green-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Total Campaigns */}
            <Card className="border-2 hover:shadow-2xl hover:shadow-blue-500/20 hover:-translate-y-1 transition-all duration-300 backdrop-blur-sm bg-background/80">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 sm:mb-2">
                      Total Campaigns
                    </p>
                    <p className="text-2xl sm:text-3xl font-bold text-blue-500">
                      {runHistory.length}
                    </p>
                  </div>
                  <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                    <Target className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Latest Campaign */}
            <Card className="border-2 hover:shadow-2xl hover:shadow-primary/20 hover:-translate-y-1 transition-all duration-300 backdrop-blur-sm bg-background/80">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 sm:mb-2">
                      Latest Campaign
                    </p>
                    <p className="text-base sm:text-lg font-bold truncate">
                      {runHistory.length > 0 ? runHistory[0].campaign_name || 'Unnamed' : 'None'}
                    </p>
                  </div>
                  <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors flex-shrink-0">
                    <Rocket className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Main Content - Campaigns Table */}
        <Card className="border-2 backdrop-blur-sm bg-background/80 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300">
          <CardHeader className="border-b bg-muted/30 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-xl sm:text-2xl font-bold">Campaigns</CardTitle>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  {runHistory.length === 0
                    ? 'No campaigns created yet'
                    : `Manage your ${runHistory.length} ${runHistory.length === 1 ? 'campaign' : 'campaigns'}`
                  }
                </p>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <Button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  variant="outline"
                  size="sm"
                  className="hover:shadow-lg hover:shadow-primary/20 transition-all"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </Button>

                {runHistory.length > 0 && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" className="hover:shadow-lg hover:shadow-destructive/20 transition-all">
                        <Trash2 className="h-4 w-4 mr-2" />
                        <span className="hidden sm:inline">Delete All</span>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete All Campaigns</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete ALL {runHistory.length} campaigns?
                          This will permanently delete all campaign data, leads, run history, and personalized messages.
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
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {runHistory.length > 0 ? (
              <div className="divide-y">
                {runHistory.map((run) => (
                  <div
                    key={run.run_id}
                    className="group p-4 sm:p-6 hover:bg-primary/5 hover:shadow-lg hover:shadow-primary/10 transition-all duration-300 cursor-pointer relative overflow-hidden"
                    onClick={() => run.campaign_name && navigate(`/campaign/${encodeURIComponent(run.campaign_name)}`)}
                  >
                    {/* Hover glow effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                    <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-6">
                      {/* Left: Status Icon + Campaign Info */}
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="flex-shrink-0">
                          {getStatusIcon(run.status)}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-lg font-semibold truncate group-hover:text-primary transition-colors">
                              {run.campaign_name || 'Unnamed Campaign'}
                            </h3>
                            <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                          </div>

                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                              <Target className="w-4 h-4" />
                              {run.lead_count ? run.lead_count.toLocaleString() : '0'} leads
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Clock className="w-4 h-4" />
                              {formatTimeAgo(run.created_at)}
                            </span>
                            {run.source && (
                              <span className="flex items-center gap-1.5">
                                <BarChart3 className="w-4 h-4" />
                                {run.source}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Status Badge + Actions */}
                      <div className="flex items-center gap-3">
                        {getStatusBadge(run.status, run.run_id)}

                        <AlertDialog>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
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
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                  <Target className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-2">No campaigns yet</h3>
                <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                  Create your first campaign to start personalizing outreach at scale
                </p>
                <Button onClick={() => navigate('/form')} size="lg">
                  <Rocket className="w-4 h-4 mr-2" />
                  Create Your First Campaign
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}