import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Download, Filter, AlertTriangle, Users, Mail, Building, Globe, MessageSquare, List, LayoutList, Trash2, MoreHorizontal, ChevronLeft, ChevronRight, Phone, MapPin, RotateCcw, CheckCircle, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Particles } from '@/components/ui/particles';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface Campaign {
  id: string;
  name: string;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
  lead_count: number | null;
  completed_count: string | null;
  source: string | null;
  user_id: string;
  custom_prompt: string | null;
  personalization_strategy: string | null;
  instantly_campaign_id: string | null;
}

interface AGARunProgress {
  run_id: string;
  client_id: string | null;
  campaign_name: string | null;
  source: string | null;
  status: string;
  lead_count: number | null;
  created_at: string;
  updated_at: string;
}

interface Lead {
  id: string;
  campaign_id: string | null;
  lead_data: any;
  personalized_message?: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export function SimplifiedCampaignPage() {
  const { campaignName } = useParams<{ campaignName: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [agaRunStatus, setAgaRunStatus] = useState<AGARunProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'grid'>('cards');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [leadsPerPage, setLeadsPerPage] = useState(20);

  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return 'Not available';
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? 'Not available' : date.toLocaleDateString();
  };

  const fetchCampaignData = useCallback(async () => {
    if (!campaignName || !user) {
      console.log('Missing campaignName or user:', { campaignName, user: !!user });
      return;
    }
    
    try {
      console.log('Searching for campaign:', decodeURIComponent(campaignName), 'for user:', user.id);
      
      // Query campaigns for this specific user only
      const { data: campaignData, error: campaignError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('name', decodeURIComponent(campaignName))
        .eq('user_auth_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      console.log('Campaign query result:', { campaignData, campaignError });

      if (campaignError) {
        console.error('Error fetching campaign:', campaignError);
        toast({
          title: "Error",
          description: "Campaign not found or you don't have access to it.",
          variant: "destructive",
        });
        navigate('/dashboard');
        return;
      }

      if (!campaignData) {
        toast({
          title: "Campaign Not Found",
          description: "This campaign doesn't exist or you don't have access to it.",
          variant: "destructive",
        });
        navigate('/dashboard');
        return;
      }

      setCampaign(campaignData);

      // Fetch AGA run status for this campaign
      const { data: agaRunData, error: agaRunError } = await supabase
        .from('AGA Runs Progress')
        .select('*')
        .eq('campaign_name', decodeURIComponent(campaignName))
        .eq('user_auth_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (agaRunError) {
        console.error('Error fetching AGA run status:', agaRunError);
      } else if (agaRunData) {
        setAgaRunStatus(agaRunData as AGARunProgress);
      }

      // Fetch campaign leads
      if (campaignData?.id) {
        const { data: leadsData, error: leadsError } = await supabase
          .from('campaign_leads')
          .select('*')
          .eq('campaign_id', campaignData.id)
          .order('created_at', { ascending: false });

        if (leadsError) {
          console.error('Error fetching leads:', leadsError);
        } else {
          setLeads(leadsData || []);
        }
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }, [campaignName, user, navigate, toast]);

  // Fetch campaign data when user is available
  useEffect(() => {
    if (user) {
      fetchCampaignData();
    }
  }, [user, fetchCampaignData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchCampaignData();
    setIsRefreshing(false);
  };

  const exportToCsv = async () => {
    if (!campaign || leads.length === 0) {
      toast({
        title: "No Data",
        description: "No leads available for export.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Prepare CSV data
      const csvHeaders = [
        'First Name', 'Last Name', 'Company', 'Website', 'Email', 
        'LinkedIn URL', 'Company LinkedIn URL', 'Location', 'Company Headcount', 'Company Industry', 
        'Phone Number', 'Personalized Sentence'
      ];
      const csvRows = leads.flatMap(lead => {
        const leadDataArray = Array.isArray(lead.lead_data) ? lead.lead_data : [lead.lead_data];
        return leadDataArray.map((data: any) => {
          const firstName = data?.first_name || '';
          const lastName = data?.last_name || '';
          
          return [
            firstName || 'N/A',
            lastName || 'N/A',
            data?.company || data?.organization || 'N/A',
            data?.company_url || data?.website || data?.company_website || 'N/A',
            data?.email || 'N/A',
            data?.linkedin_url || 'N/A',
            data?.company_linkedin_url || 'N/A',
            data?.location || 'N/A',
            data?.company_headcount || 'N/A',
            data?.company_industry || 'N/A',
            data?.phone_number || 'N/A',
            data?.personalized_message || lead.personalized_message || 'Not generated'
          ];
        });
      });

      const csvContent = [csvHeaders, ...csvRows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${campaign.name}_leads.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export Complete",
        description: `Exported ${csvRows.length} leads to CSV file.`,
      });
    } catch (error) {
      console.error('Error exporting:', error);
      toast({
        title: "Export Failed",
        description: "An error occurred while exporting the data.",
        variant: "destructive",
      });
    }
  };

  // Delete campaign function
  const deleteCampaign = async () => {
    if (!campaign || !user) return;

    try {
      // Delete campaign leads first (cascade should handle this, but being explicit)
      const { error: leadsError } = await supabase
        .from('campaign_leads')
        .delete()
        .eq('campaign_id', campaign.id);

      if (leadsError) {
        console.error('Error deleting campaign leads:', leadsError);
      }

      // Delete from AGA Runs Progress
      const { error: runError } = await supabase
        .from('AGA Runs Progress')
        .delete()
        .eq('campaign_name', campaign.name);

      if (runError) {
        console.error('Error deleting run:', runError);
      }

      // Delete the campaign itself
      const { error: campaignError } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', campaign.id);

      if (campaignError) {
        console.error('Error deleting campaign:', campaignError);
        toast({
          title: "Delete Failed",
          description: "Failed to delete campaign. Please try again.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Campaign Deleted",
        description: `"${campaign.name}" has been permanently deleted.`,
      });

      // Navigate back to dashboard
      navigate('/dashboard');

    } catch (error) {
      console.error('Unexpected error during deletion:', error);
      toast({
        title: "Delete Failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Rerun campaign function
  const rerunCampaign = async () => {
    if (!campaign || !user) return;

    try {
      // Get the campaign's webhook payload
      const { data: campaignData, error: campaignError } = await supabase
        .from('campaigns')
        .select('webhook_payload')
        .eq('id', campaign.id)
        .single();

      if (campaignError) {
        console.error('Error finding campaign:', campaignError);
        toast({
          title: "Rerun Failed",
          description: "Could not find campaign data for rerun.",
          variant: "destructive",
        });
        return;
      }

      if (!campaignData || !campaignData.webhook_payload) {
        toast({
          title: "No Webhook Data",
          description: "This campaign doesn't have webhook payload data to rerun.",
          variant: "destructive",
        });
        return;
      }

      // Update the webhook payload to set rerun = true
      const updatedPayload = {
        ...campaignData.webhook_payload,
        rerun: true
      };

      // Determine webhook URL based on user ID
      const webhookUrl = user.id === '264444f9-68de-4a4a-a7f1-b337389c1a00'
        ? 'https://primary-production-6226d.up.railway.app/webhook/lucas-live-environment'
        : 'https://primary-production-6226d.up.railway.app/webhook/latest-dev';

      // Convert the payload to FormData for webhook submission
      const formData = new FormData();

      // Add all payload fields to FormData
      Object.keys(updatedPayload).forEach(key => {
        const value = updatedPayload[key];
        if (value !== null && value !== undefined) {
          if (typeof value === 'object' && !Array.isArray(value)) {
            formData.append(key, JSON.stringify(value));
          } else {
            formData.append(key, String(value));
          }
        }
      });

      const response = await fetch(webhookUrl, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Webhook failed with status: ${response.status}`);
      }

      toast({
        title: "Campaign Rerun Started",
        description: `"${campaign.name}" has been rerun successfully.`,
      });

      // Refresh the campaign data
      await handleRefresh();

    } catch (error) {
      console.error('Unexpected error during rerun:', error);
      toast({
        title: "Rerun Failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Pagination helper functions
  const getFilteredLeads = () => {
    return leads.filter(lead => {
      if (!lead.lead_data) return false;
      const leadDataArray = Array.isArray(lead.lead_data) ? lead.lead_data : [lead.lead_data];
      return leadDataArray.some(data => data && Object.keys(data).length > 0);
    }).flatMap((lead) => {
      const leadDataArray = Array.isArray(lead.lead_data) ? lead.lead_data : [lead.lead_data];
      return leadDataArray.filter(data => data && Object.keys(data).length > 0).map((data: any, index: number) => ({
        ...lead,
        leadData: data,
        uniqueId: `${lead.id}-${index}`
      }));
    });
  };

  const getPaginatedLeads = () => {
    const filteredLeads = getFilteredLeads();
    const startIndex = (currentPage - 1) * leadsPerPage;
    const endIndex = startIndex + leadsPerPage;
    return filteredLeads.slice(startIndex, endIndex);
  };

  const getTotalPages = () => {
    const filteredLeads = getFilteredLeads();
    return Math.ceil(filteredLeads.length / leadsPerPage);
  };

  const getTotalLeads = () => {
    return getFilteredLeads().length;
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to top of leads section
    const leadsSection = document.getElementById('leads-section');
    if (leadsSection) {
      leadsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleLeadsPerPageChange = (value: string) => {
    setLeadsPerPage(parseInt(value));
    setCurrentPage(1); // Reset to first page when changing page size
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      'completed': 'bg-success/20 text-success-foreground border-success/20',
      'processing': 'bg-warning/20 text-warning-foreground border-warning/20',
      'Processing Leads': 'bg-warning/20 text-warning-foreground border-warning/20',
      'failed': 'bg-destructive/20 text-destructive-foreground border-destructive/20',
      'Completed': 'bg-success/20 text-success-foreground border-success/20',
      'Failed': 'bg-destructive/20 text-destructive-foreground border-destructive/20'
    };
    
    return (
      <Badge className={variants[status as keyof typeof variants] || 'bg-muted/20 text-muted-foreground'}>
        {status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading campaign data...</p>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Campaign not found.</p>
          <Button onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated Background - Same as Dashboard */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-background to-blue-500/5" />
        <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-500/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob" />
        <div className="absolute top-0 -right-4 w-72 h-72 bg-blue-500/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000" />
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-500/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000" />
      </div>

      {/* Particle field effects */}
      <Particles
        className="absolute inset-0"
        quantity={150}
        ease={50}
        staticity={30}
        color="#a855f7"
        size={0.6}
      />

      <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto relative z-10">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate('/dashboard')}
          className="mb-4 sm:mb-6 hover:shadow-lg hover:shadow-primary/20 transition-all"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        {/* Header Section */}
        <div className="mb-6 sm:mb-8">
          <Card className="glass-strong glass-hover">
            <CardHeader className="glass-table-header p-4 sm:p-6">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 sm:gap-6">
                {/* Left: Campaign Name & Status */}
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    <h1 className="text-2xl sm:text-3xl font-bold">{campaign.name}</h1>
                    {getStatusBadge(agaRunStatus?.status || campaign.status || 'unknown')}
                    {(agaRunStatus?.status || campaign.status || '').includes('500') && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={rerunCampaign}
                        className="border-orange-500 text-orange-500 hover:bg-orange-500/10 hover:shadow-lg hover:shadow-orange-500/20 transition-all"
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Rerun
                      </Button>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Created {formatDate(campaign.created_at)} • {campaign.source || 'Unknown source'}
                  </p>
                </div>

                {/* Right: Actions */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    size="sm"
                    className="hover:shadow-lg hover:shadow-primary/20 transition-all"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">Refresh</span>
                  </Button>

                  <Button onClick={exportToCsv} size="sm" className="hover:shadow-lg hover:shadow-primary/20 transition-all">
                    <Download className="w-4 h-4 mr-2" />
                    <span className="hidden sm:inline">Export</span>
                  </Button>

                  <AlertDialog>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="hover:shadow-lg hover:shadow-primary/20 transition-all">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <AlertDialogTrigger asChild>
                          <DropdownMenuItem className="text-destructive focus:text-destructive cursor-pointer">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Campaign
                          </DropdownMenuItem>
                        </AlertDialogTrigger>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "{campaign.name}"?
                          This will permanently delete the campaign and all its leads ({campaign.lead_count || 0} leads).
                          This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={deleteCampaign}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete Campaign
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardHeader>

            {/* Stats Grid */}
            <CardContent className="p-4 sm:p-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg glass-card glass-hover hover:shadow-purple-500/20 hover:-translate-y-1">
                  <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                    <Users className="h-5 w-5 sm:h-6 sm:w-6 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                      Total Leads
                    </p>
                    <p className="text-xl sm:text-2xl font-bold">{campaign.lead_count || 0}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg glass-card glass-hover hover:shadow-green-500/20 hover:-translate-y-1">
                  <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-green-500/10 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-green-500" />
                  </div>
                  <div>
                    <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                      Completed
                    </p>
                    <p className="text-xl sm:text-2xl font-bold">{parseInt(campaign.completed_count || '0')}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg glass-card glass-hover hover:shadow-blue-500/20 hover:-translate-y-1">
                  <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                    <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                      Source
                    </p>
                    <p className="text-base sm:text-lg font-semibold capitalize">{campaign.source || 'Unknown'}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Leads Section */}
        <Card className="glass-strong glass-hover">
          <CardHeader className="glass-table-header p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-2xl font-bold">Campaign Leads</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {getTotalLeads()} {getTotalLeads() === 1 ? 'lead' : 'leads'} in this campaign
                </p>
              </div>

              <ToggleGroup
                type="single"
                value={viewMode}
                onValueChange={(value) => value && setViewMode(value as 'cards' | 'grid')}
                className="border rounded-lg"
              >
                <ToggleGroupItem value="cards" aria-label="Card view" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                  <LayoutList className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="grid" aria-label="List view" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                  <List className="h-4 w-4" />
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {getTotalLeads() > 0 ? (
              <div className="p-6">
                {/* Pagination Controls */}
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">
                      Showing {Math.min((currentPage - 1) * leadsPerPage + 1, getTotalLeads())}-{Math.min(currentPage * leadsPerPage, getTotalLeads())} of {getTotalLeads()} leads
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    {/* Leads per page selector */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Show:</span>
                      <Select value={leadsPerPage.toString()} onValueChange={handleLeadsPerPageChange}>
                        <SelectTrigger className="w-20 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="20">20</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Page navigation */}
                    {getTotalPages() > 1 && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        
                        <span className="text-sm text-muted-foreground px-2">
                          Page {currentPage} of {getTotalPages()}
                        </span>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={currentPage === getTotalPages()}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                <div id="leads-section">
                {viewMode === 'cards' ? (
                  // Card View
                  <div className="grid gap-6">
                    {getPaginatedLeads().map((paginatedLead) => (
                        <Card
                          key={paginatedLead.uniqueId}
                          className="glass-card glass-hover"
                        >
                          <CardContent className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                              {/* Name */}
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                  <Mail className="w-4 h-4" />
                                  Contact
                                </div>
                                <div className="font-semibold text-foreground text-lg">
                                  {`${paginatedLead.leadData?.first_name || ''} ${paginatedLead.leadData?.last_name || ''}`.trim() || 'N/A'}
                                </div>
                              </div>

                              {/* Company */}
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                  <Building className="w-4 h-4" />
                                  Company
                                </div>
                                <div className="font-medium text-foreground">
                                  {paginatedLead.leadData?.company || paginatedLead.leadData?.organization || 'N/A'}
                                </div>
                              </div>

                              {/* Website */}
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                  <Globe className="w-4 h-4" />
                                  Website
                                </div>
                                <div>
                                  {(() => {
                                    const websiteUrl = paginatedLead.leadData?.company_url || paginatedLead.leadData?.website || paginatedLead.leadData?.company_website;
                                    if (!websiteUrl) {
                                      return <span className="text-muted-foreground text-sm">N/A</span>;
                                    }
                                    
                                    try {
                                      // Try to create URL object to validate and get hostname
                                      const urlObj = new URL(websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`);
                                      return (
                                        <a 
                                          href={urlObj.href} 
                                          target="_blank" 
                                          rel="noopener noreferrer" 
                                          className="text-primary hover:text-primary/80 hover:underline transition-colors text-sm font-medium flex items-center gap-1"
                                        >
                                          {urlObj.hostname}
                                          <Globe className="w-3 h-3" />
                                        </a>
                                      );
                                    } catch (error) {
                                      // If URL is invalid, just show as plain text
                                      return (
                                        <span className="text-sm text-muted-foreground" title="Invalid URL format">
                                          {websiteUrl}
                                        </span>
                                      );
                                    }
                                  })()}
                                </div>
                              </div>

                              {/* Email */}
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                  <Mail className="w-4 h-4" />
                                  Email
                                </div>
                                <div className="font-medium text-foreground">
                                  {paginatedLead.leadData?.email ? (
                                    <a 
                                      href={`mailto:${paginatedLead.leadData.email}`}
                                      className="text-primary hover:text-primary/80 hover:underline transition-colors"
                                    >
                                      {paginatedLead.leadData.email}
                                    </a>
                                  ) : (
                                    <span className="text-muted-foreground">N/A</span>
                                  )}
                                </div>
                              </div>

                              {/* LinkedIn */}
                              {paginatedLead.leadData?.linkedin_url && (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                    <Users className="w-4 h-4" />
                                    LinkedIn
                                  </div>
                                  <div>
                                    <a 
                                      href={paginatedLead.leadData.linkedin_url.startsWith('http') ? paginatedLead.leadData.linkedin_url : `https://${paginatedLead.leadData.linkedin_url}`}
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className="text-primary hover:text-primary/80 hover:underline transition-colors text-sm font-medium flex items-center gap-1"
                                    >
                                      View Profile
                                      <Users className="w-3 h-3" />
                                    </a>
                                  </div>
                                </div>
                              )}

                              {/* Company LinkedIn */}
                              {paginatedLead.leadData?.company_linkedin_url && (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                    <Building className="w-4 h-4" />
                                    Company LinkedIn
                                  </div>
                                  <div>
                                    <a 
                                      href={paginatedLead.leadData.company_linkedin_url.startsWith('http') ? paginatedLead.leadData.company_linkedin_url : `https://${paginatedLead.leadData.company_linkedin_url}`}
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className="text-primary hover:text-primary/80 hover:underline transition-colors text-sm font-medium flex items-center gap-1"
                                    >
                                      View Company
                                      <Building className="w-3 h-3" />
                                    </a>
                                  </div>
                                </div>
                              )}

                              {/* Location */}
                              {paginatedLead.leadData?.location && (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                    <MapPin className="w-4 h-4" />
                                    Location
                                  </div>
                                  <div className="font-medium text-foreground text-sm">
                                    {paginatedLead.leadData.location}
                                  </div>
                                </div>
                              )}

                              {/* Company Headcount */}
                              {paginatedLead.leadData?.company_headcount && (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                    <Building className="w-4 h-4" />
                                    Headcount
                                  </div>
                                  <div className="font-medium text-foreground text-sm">
                                    {paginatedLead.leadData.company_headcount} employees
                                  </div>
                                </div>
                              )}

                              {/* Company Industry */}
                              {paginatedLead.leadData?.company_industry && (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                    <Building className="w-4 h-4" />
                                    Industry
                                  </div>
                                  <div className="font-medium text-foreground text-sm">
                                    {paginatedLead.leadData.company_industry}
                                  </div>
                                </div>
                              )}

                              {/* Phone Number */}
                              {paginatedLead.leadData?.phone_number && (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                    <Phone className="w-4 h-4" />
                                    Phone
                                  </div>
                                  <div className="font-medium text-foreground text-sm">
                                    <a 
                                      href={`tel:${paginatedLead.leadData.phone_number}`}
                                      className="text-primary hover:text-primary/80 hover:underline transition-colors"
                                    >
                                      {paginatedLead.leadData.phone_number}
                                    </a>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Personalized Message */}
                            {(paginatedLead.leadData?.personalized_message || paginatedLead.personalized_message) && (
                              <>
                                <Separator className="my-4" />
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                                    <MessageSquare className="w-4 h-4" />
                                    Personalized Message
                                  </div>
                                  <div className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg p-4 border border-primary/20">
                                    <p className="text-sm leading-relaxed text-foreground">
                                      {paginatedLead.leadData?.personalized_message || paginatedLead.personalized_message}
                                    </p>
                                  </div>
                                </div>
                              </>
                            )}
                          </CardContent>
                        </Card>
                    ))}
                  </div>
                ) : (
                  // List View
                  <div className="space-y-2">
                    {getPaginatedLeads().map((paginatedLead) => (
                        <div
                          key={paginatedLead.uniqueId}
                          className="glass-table-row flex items-center justify-between p-4 rounded-lg group"
                        >
                          {/* Left side - Main info */}
                          <div className="flex items-center gap-6 flex-1 min-w-0">
                            {/* Name */}
                            <div className="min-w-0 flex-shrink-0">
                              <div className="font-semibold text-foreground group-hover:text-purple-400 transition-colors">
                                {`${paginatedLead.leadData?.first_name || ''} ${paginatedLead.leadData?.last_name || ''}`.trim() || 'N/A'}
                              </div>
                            </div>

                            {/* Company */}
                            <div className="min-w-0 flex-shrink-0">
                              <div className="text-sm text-muted-foreground">
                                {paginatedLead.leadData?.company || paginatedLead.leadData?.organization || 'No company'}
                              </div>
                            </div>

                            {/* Email */}
                            <div className="min-w-0 flex-1">
                              {paginatedLead.leadData?.email ? (
                                <a 
                                  href={`mailto:${paginatedLead.leadData.email}`}
                                  className="text-primary hover:text-primary/80 hover:underline transition-colors text-sm flex items-center gap-1 truncate"
                                >
                                  <Mail className="w-3 h-3 flex-shrink-0" />
                                  <span className="truncate">{paginatedLead.leadData.email}</span>
                                </a>
                              ) : (
                                <span className="text-muted-foreground text-sm">No email</span>
                              )}
                            </div>

                            {/* Website */}
                            <div className="min-w-0 flex-shrink-0">
                              {(() => {
                                const websiteUrl = paginatedLead.leadData?.company_url || paginatedLead.leadData?.website || paginatedLead.leadData?.company_website;
                                if (websiteUrl) {
                                  try {
                                    const urlObj = new URL(websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`);
                                    return (
                                      <a 
                                        href={urlObj.href} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="text-primary hover:text-primary/80 hover:underline transition-colors text-sm flex items-center gap-1"
                                      >
                                        <Globe className="w-3 h-3" />
                                        <span>{urlObj.hostname}</span>
                                      </a>
                                    );
                                  } catch (error) {
                                    return <span className="text-muted-foreground text-sm">Invalid URL</span>;
                                  }
                                }
                                return <span className="text-muted-foreground text-sm">No website</span>;
                              })()}
                            </div>
                          </div>

                          {/* Right side - Status */}
                          <div className="flex-shrink-0 ml-4">
                            {paginatedLead.leadData?.personalized_message || paginatedLead.personalized_message ? (
                              <Badge className="bg-green-500/20 text-green-300 border-green-500/30 text-xs">
                                <MessageSquare className="w-3 h-3 mr-1" />
                                Ready
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-yellow-500/30 text-yellow-400 bg-yellow-500/10 text-xs">
                                <MessageSquare className="w-3 h-3 mr-1" />
                                Pending
                              </Badge>
                            )}
                          </div>
                        </div>
                    ))}
                  </div>
                )}
                
                {/* Bottom Pagination Controls */}
                {getTotalPages() > 1 && (
                  <>
                    <Separator className="my-6" />
                    <div className="flex justify-center items-center gap-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="w-4 h-4 mr-1" />
                        Previous
                      </Button>
                      
                      <span className="text-sm text-muted-foreground px-4">
                        Page {currentPage} of {getTotalPages()}
                      </span>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === getTotalPages()}
                      >
                        Next
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  </>
                )}
                </div>
              </div>
            ) : (
              <div className="p-20 text-center">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                  <AlertTriangle className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-2">No leads found</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Leads will appear here once they are processed for this campaign. Check back soon!
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}