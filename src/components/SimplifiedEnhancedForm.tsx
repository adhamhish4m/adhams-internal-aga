import { useState, useCallback } from 'react';
import { Upload, Zap, Mail, Target, Loader2, Eye, Briefcase, Trophy, Users, FileText, MessageSquare, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { UserTypeToggle } from './UserTypeToggle';

const presetStrategies = [
  {
    id: 'website-case-study',
    name: 'Website Case Study Focus',
    description: 'Personalize based on recent case studies and success stories',
    prompt: 'Focus specifically on case studies, client work, or success stories mentioned on their website. Highlight specific results, industries they\'ve helped, or notable projects they\'ve completed.',
    icon: Eye,
  },
  {
    id: 'company-achievements',
    name: 'Company Achievements',
    description: 'Reference recent company milestones and news',
    prompt: 'Focus on recent company milestones, awards, funding rounds, new hires, product launches, or other achievements mentioned in the research. Prioritize accomplishments from the last 6 months.',
    icon: Trophy,
  },
  {
    id: 'linkedin-engagement',
    name: 'LinkedIn Post Engagement',
    description: 'Mention prospect\'s recent LinkedIn activity',
    prompt: 'Focus on recent LinkedIn posts or content the prospect has shared. Comment on their insights, opinions, or topics they\'re discussing. Reference their thought leadership or industry perspectives.',
    icon: MessageSquare,
  },
];

interface ApolloFilters {
  jobTitles: Array<{ id: string; value: string }>;
  locations: Array<{ id: string; value: string }>;
  seniority: string[];
  companySize: string[];
  industries: string[];
  departments: string[];
  companyDomains: string[];
  technologies: string[];
  fundingStage: string[];
  revenueRange: string[];
  yearsOfExperience: string[];
}

interface FormData {
  leadSource: 'apollo' | 'csv' | '';
  apolloUrl: string;
  apolloFilters: ApolloFilters | null;
  csvFile: File | null;
  leadCount: number;
  outputFormats: {
    instantly: boolean;
    email: boolean;
  };
  campaignId: string;
  email: string;
  campaignName: string;
  personalizationStrategy: string;
  customPrompt: string;
  authToken: string;
}

interface SimplifiedEnhancedFormProps {
  onSubmissionSuccess: (data: any) => void;
}

export function SimplifiedEnhancedForm({ onSubmissionSuccess }: SimplifiedEnhancedFormProps) {
  const { user } = useAuth();
  const [isPowerUser, setIsPowerUser] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    leadSource: '',
    apolloUrl: '',
    apolloFilters: null,
    csvFile: null,
    leadCount: 500,
    outputFormats: {
      instantly: false,
      email: false,
    },
    campaignId: '',
    email: '',
    campaignName: '',
    personalizationStrategy: 'website-case-study',
    customPrompt: '',
    authToken: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidatingToken, setIsValidatingToken] = useState(false);
  const [tokenValidationStatus, setTokenValidationStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [campaignNameError, setCampaignNameError] = useState<string>('');
  const [csvValidationStatus, setCsvValidationStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [csvValidationError, setCsvValidationError] = useState<string>('');
  const { toast } = useToast();

  // Check if campaign name already exists
  const checkCampaignNameExists = async (name: string) => {
    if (!name.trim() || !user) return false;
    
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select('id')
        .eq('name', name.trim())
        .eq('user_auth_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error checking campaign name:', error);
        return false;
      }

      return !!data;
    } catch (error) {
      console.error('Error checking campaign name:', error);
      return false;
    }
  };

  // Validate campaign name on change
  const handleCampaignNameChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setFormData(prev => ({ ...prev, campaignName: newName }));
    
    if (newName.trim()) {
      const exists = await checkCampaignNameExists(newName);
      if (exists) {
        setCampaignNameError('A campaign with this name already exists. Please choose a different name.');
      } else {
        setCampaignNameError('');
      }
    } else {
      setCampaignNameError('');
    }
  };

  // Validate authentication token and return client info
  const validateToken = useCallback(async (token: string) => {
    if (!token) return null;

    try {
      const { data: tokenData, error: tokenError } = await supabase
        .from('tokens')
        .select('token_value, active_status, expires_at, usage_count, usage_limit, client_id')
        .eq('token_value', token)
        .eq('active_status', true)
        .maybeSingle();

      if (tokenError || !tokenData) {
        return null;
      }

      // Check if token has expired
      if (new Date(tokenData.expires_at) < new Date()) {
        return null;
      }

      // Check usage limit
      if (tokenData.usage_limit && parseInt(tokenData.usage_count || '0') >= tokenData.usage_limit) {
        return null;
      }

      return { isValid: true, clientId: tokenData.client_id };
    } catch (error) {
      return null;
    }
  }, []);


  const validateCsvColumns = async (file: File): Promise<boolean> => {
    const requiredColumns = ['First Name', 'Last Name', 'Linkedin URL', 'Company Website', 'Email'];

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const lines = text.split('\n');
          if (lines.length === 0) {
            setCsvValidationError('CSV file is empty');
            setCsvValidationStatus('invalid');
            resolve(false);
            return;
          }

          const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
          const missingColumns = requiredColumns.filter(col => !headers.includes(col));

          if (missingColumns.length > 0) {
            setCsvValidationError(`Missing required columns: ${missingColumns.join(', ')}`);
            setCsvValidationStatus('invalid');
            resolve(false);
          } else {
            setCsvValidationError('');
            setCsvValidationStatus('valid');
            resolve(true);
          }
        } catch (error) {
          setCsvValidationError('Error reading CSV file');
          setCsvValidationStatus('invalid');
          resolve(false);
        }
      };
      reader.readAsText(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setFormData(prev => ({ ...prev, csvFile: file }));

    if (file) {
      setCsvValidationStatus('idle');
      setCsvValidationError('');
      await validateCsvColumns(file);
    } else {
      setCsvValidationStatus('idle');
      setCsvValidationError('');
    }
  };

  const handleValidateToken = async () => {
    if (!formData.authToken) {
      toast({
        title: "Error",
        description: "Please enter a token to validate",
        variant: "destructive",
      });
      return;
    }

    setIsValidatingToken(true);
    setTokenValidationStatus('idle');

    try {
      const tokenResult = await validateToken(formData.authToken);

      if (!tokenResult) {
        setTokenValidationStatus('invalid');
        toast({
          title: "Invalid Token",
          description: "Token not found, inactive, expired, or usage limit exceeded",
          variant: "destructive",
        });
        return;
      }

      setTokenValidationStatus('valid');
      toast({
        title: "Token Valid",
        description: `Authentication token is valid for client: ${tokenResult.clientId}`,
      });

    } catch (error) {
      setTokenValidationStatus('invalid');
      toast({
        title: "Validation Error",
        description: error instanceof Error ? error.message : "Failed to validate token",
        variant: "destructive",
      });
    } finally {
      setIsValidatingToken(false);
    }
  };

  const handleApolloUrlGenerated = useCallback((url: string, filters: ApolloFilters) => {
    setFormData(prev => ({
      ...prev,
      apolloUrl: url,
      apolloFilters: filters
    }));
  }, []);


  const handlePreview = () => {
    const selectedStrategy = presetStrategies.find(s => s.id === formData.personalizationStrategy);
    const promptToShow = formData.personalizationStrategy === 'custom'
      ? formData.customPrompt
      : selectedStrategy?.prompt || '';

    toast({
      title: "AI Personalization Strategy",
      description: promptToShow.substring(0, 200) + (promptToShow.length > 200 ? '...' : ''),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check for campaign name validation errors
    if (campaignNameError) {
      toast({
        title: "Invalid Campaign Name",
        description: campaignNameError,
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to submit campaigns.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }
    
    setIsSubmitting(true);

    // Final check to ensure campaign name doesn't exist
    const nameExists = await checkCampaignNameExists(formData.campaignName);
    if (nameExists) {
      toast({
        title: "Duplicate Campaign Name",
        description: "A campaign with this name already exists. Please choose a different name.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    try {
      // Validate authentication token and get client info
      const tokenResult = await validateToken(formData.authToken);

      if (!tokenResult) {
        throw new Error('Invalid or inactive authentication token');
      }

      const clientId = tokenResult.clientId;

      // Create campaign record
      const { data: campaignData, error: campaignError } = await supabase
        .from('campaigns')
        .insert({
          id: crypto.randomUUID(),
          user_id: clientId,
          name: formData.campaignName,
          status: 'processing',
          source: formData.leadSource === 'apollo' ? 'Apollo URL' : 'CSV Upload',
          lead_count: formData.leadSource === 'apollo' ? formData.leadCount : null,
          personalization_strategy: isPowerUser ? formData.personalizationStrategy : null,
          custom_prompt: isPowerUser && formData.personalizationStrategy === 'custom' ? formData.customPrompt : null,
          completed_count: 0,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (campaignError || !campaignData) {
        console.error('Campaign creation error:', campaignError);
        throw new Error('Failed to create campaign record: ' + campaignError?.message);
      }

      console.log('Campaign created successfully:', campaignData);

      // Create initial campaign lead
      const { data: campaignLeadData, error: leadError } = await supabase
        .from('campaign_leads')
        .insert({
          id: crypto.randomUUID(),
          campaign_id: campaignData.id,
          lead_data: {}
        })
        .select()
        .single();

      if (leadError) {
        console.error('Campaign lead creation error:', leadError);
        throw new Error('Failed to create campaign lead: ' + leadError.message);
      }

      // Create run record with enhanced data
      const { data: runData, error: runError } = await supabase
        .from('AGA Runs Progress')
        .insert({
          run_id: crypto.randomUUID(),
          status: 'In Queue',
          lead_count: formData.leadSource === 'apollo' ? formData.leadCount : null,
          source: formData.leadSource === 'apollo' ? 'Apollo URL' : 'CSV Upload',
          campaign_name: formData.campaignName,
          client_id: clientId // Use client from token
        })
        .select()
        .single();

      if (runError) {
        throw new Error('Failed to create run record: ' + runError.message);
      }

      // Prepare enhanced submission data
      const submissionData = new FormData();
      submissionData.append('leadSource', formData.leadSource);
      submissionData.append('run_id', runData.run_id);
      submissionData.append('campaignName', formData.campaignName);
      submissionData.append('campaign_id', campaignData.id);
      submissionData.append('campaign_leads_id', campaignLeadData.id);
      submissionData.append('authToken', formData.authToken);
      submissionData.append('rerun', 'false'); // Add rerun flag set to false for new campaigns

      // Add personalization strategy for power users
      if (isPowerUser) {
        if (formData.personalizationStrategy === 'custom') {
          submissionData.append('personalizationPrompt', formData.customPrompt);
        } else {
          const selectedStrategy = presetStrategies.find(s => s.id === formData.personalizationStrategy);
          submissionData.append('personalizationPrompt', selectedStrategy?.prompt || '');
        }
        submissionData.append('personalizationStrategy', formData.personalizationStrategy);
        submissionData.append('isPowerUser', 'true');
      }

      // Add additional prompt fields (will be populated with actual values below)
      let perplexityPromptValue = '';
      let promptTaskValue = '';
      let promptExampleValue = '';

      if (formData.leadSource === 'apollo') {
        submissionData.append('apolloUrl', formData.apolloUrl);
        submissionData.append('leadCount', formData.leadCount.toString());

        // Add Apollo filter data if available
        if (formData.apolloFilters) {
          const apolloFiltersData = {
            job_titles: formData.apolloFilters.jobTitles.filter(t => t.value.trim()).map(t => t.value),
            locations: formData.apolloFilters.locations.filter(l => l.value.trim()).map(l => l.value),
            seniority: formData.apolloFilters.seniority,
            company_size: formData.apolloFilters.companySize,
            industries: formData.apolloFilters.industries,
            departments: formData.apolloFilters.departments,
            company_domains: formData.apolloFilters.companyDomains.filter(d => d.trim()),
            technologies: formData.apolloFilters.technologies.filter(t => t.trim()),
            funding_stage: formData.apolloFilters.fundingStage,
            revenue_range: formData.apolloFilters.revenueRange
          };
          submissionData.append('apolloFilters', JSON.stringify(apolloFiltersData));
        }
      } else if (formData.leadSource === 'csv' && formData.csvFile) {
        submissionData.append('csvFile', formData.csvFile);
      }

      submissionData.append('outputInstantly', formData.outputFormats.instantly.toString());
      submissionData.append('outputEmail', formData.outputFormats.email.toString());

      if (formData.outputFormats.instantly) {
        submissionData.append('campaignId', formData.campaignId);
      }

      if (formData.outputFormats.email) {
        submissionData.append('email', formData.email);
      }

      // Create payload object for storage (excluding file for JSON serialization)
      const webhookPayload: any = {
        leadSource: formData.leadSource,
        run_id: runData.run_id,
        campaignName: formData.campaignName,
        campaign_id: campaignData.id,
        campaign_leads_id: campaignLeadData.id,
        authToken: formData.authToken,
        rerun: false,
        outputInstantly: formData.outputFormats.instantly,
        outputEmail: formData.outputFormats.email,
        perplexityPrompt: '',
        promptTask: '',
        personalizationPrompt: '',
        promptExample: ''
      };

      // Add personalization strategy for power users
      if (isPowerUser) {
        if (formData.personalizationStrategy === 'custom') {
          webhookPayload.personalizationPrompt = formData.customPrompt;
        } else {
          const selectedStrategy = presetStrategies.find(s => s.id === formData.personalizationStrategy);
          webhookPayload.personalizationPrompt = selectedStrategy?.prompt || '';
        }
        webhookPayload.personalizationStrategy = formData.personalizationStrategy;

        // Set the same default values for consistency
        perplexityPromptValue = 'Research this company for relevant business insights and recent developments';
        promptTaskValue = 'Create a personalized icebreaker sentence';
        promptExampleValue = 'Instead of: "I hope this email finds you well"\nWrite: "I noticed your company\'s recent expansion into sustainable technology"';
      } else {
        // For non-power users, set basic default values (no personalizationPrompt sent to webhook for non-power users)
        perplexityPromptValue = 'Research this company for basic business information';
        promptTaskValue = 'Create a simple personalized opening line';
        promptExampleValue = 'Instead of: "Hope you\'re doing well"\nWrite: "I see your company specializes in [industry]"';
        // personalizationPrompt remains empty for non-power users to match webhook behavior
      }

      // Update webhook payload with the same values that are sent to webhook
      webhookPayload.perplexityPrompt = perplexityPromptValue;
      webhookPayload.promptTask = promptTaskValue;
      webhookPayload.promptExample = promptExampleValue;
      // personalizationPrompt is only set for power users above, remains empty for non-power users

      if (formData.leadSource === 'apollo') {
        webhookPayload.apolloUrl = formData.apolloUrl;
        webhookPayload.leadCount = formData.leadCount;
        if (formData.apolloFilters) {
          const apolloFiltersData = {
            job_titles: formData.apolloFilters.jobTitles.filter(t => t.value.trim()).map(t => t.value),
            locations: formData.apolloFilters.locations.filter(l => l.value.trim()).map(l => l.value),
            seniority: formData.apolloFilters.seniority,
            company_size: formData.apolloFilters.companySize,
            industries: formData.apolloFilters.industries,
            departments: formData.apolloFilters.departments,
            company_domains: formData.apolloFilters.companyDomains.filter(d => d.trim()),
            technologies: formData.apolloFilters.technologies.filter(t => t.trim()),
            funding_stage: formData.apolloFilters.fundingStage,
            revenue_range: formData.apolloFilters.revenueRange
          };
          webhookPayload.apolloFilters = apolloFiltersData;
        }
      } else if (formData.leadSource === 'csv' && formData.csvFile) {
        webhookPayload.csvFileName = formData.csvFile.name;
        webhookPayload.csvFileSize = formData.csvFile.size;
      }

      if (formData.outputFormats.instantly) {
        webhookPayload.campaignId = formData.campaignId;
      }

      if (formData.outputFormats.email) {
        webhookPayload.email = formData.email;
      }

      // Update campaign record with webhook payload
      const { error: updateError } = await supabase
        .from('campaigns')
        .update({ webhook_payload: webhookPayload })
        .eq('id', campaignData.id);

      if (updateError) {
        console.error('Failed to update campaign with webhook payload:', updateError);
        // Continue anyway - don't block webhook submission
      }

      // Add prompt values to FormData right before sending
      submissionData.append('perplexityPrompt', perplexityPromptValue);
      submissionData.append('promptTask', promptTaskValue);
      submissionData.append('promptExample', promptExampleValue);

      // Webhook URL
      const webhookUrl = 'https://primary-production-6226d.up.railway.app/webhook/nov-2025-adham';
      try {
        console.log('Triggering webhook:', webhookUrl);
        const webhookResponse = await fetch(webhookUrl, {
          method: 'POST',
          body: submissionData,
        });
        
        if (!webhookResponse.ok) {
          console.error('Webhook failed with status:', webhookResponse.status);
          toast({
            title: "Webhook Warning",
            description: `Webhook call failed (${webhookResponse.status}). Campaign created but webhook not triggered.`,
            variant: "destructive",
          });
        } else {
          console.log('Webhook triggered successfully');
          toast({
            title: "Webhook Triggered",
            description: "Campaign created and webhook triggered successfully!",
          });
        }
      } catch (webhookError) {
        console.error('Webhook error:', webhookError);
        toast({
          title: "Webhook Error", 
          description: "Campaign created but webhook failed to trigger. Please check your webhook URL.",
          variant: "destructive",
        });
      }
      
      toast({
        title: "Success!",
        description: isPowerUser 
          ? "Your enhanced lead enrichment has been submitted successfully."
          : "Your lead enrichment has been submitted successfully.",
      });

      // Navigate directly to dashboard with token
      window.location.href = `/dashboard?token=${encodeURIComponent(formData.authToken)}`;
      
    } catch (error) {
      console.error('Submission error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit form. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = () => {
    if (!formData.authToken) return false;
    if (!formData.campaignName) return false;
    if (!formData.leadSource) return false;

    // For Apollo source, require either a generated URL or filters applied
    if (formData.leadSource === 'apollo') {
      const hasUrl = formData.apolloUrl && formData.apolloUrl.trim() !== '';
      const hasFilters = formData.apolloFilters && (
        (formData.apolloFilters.jobTitles && formData.apolloFilters.jobTitles.some(t => t.value.trim())) ||
        (formData.apolloFilters.locations && formData.apolloFilters.locations.some(l => l.value.trim())) ||
        formData.apolloFilters.seniority.length > 0 ||
        formData.apolloFilters.companySize.length > 0 ||
        formData.apolloFilters.industries.length > 0
      );

      if (!hasUrl && !hasFilters) return false;
    }

    if (formData.leadSource === 'csv' && !formData.csvFile) return false;
    if (formData.leadSource === 'csv' && csvValidationStatus !== 'valid') return false;
    if (!formData.outputFormats.instantly && !formData.outputFormats.email) return false;
    if (formData.outputFormats.instantly && !formData.campaignId) return false;
    if (formData.outputFormats.email && !formData.email) return false;
    if (isPowerUser && formData.personalizationStrategy === 'custom' && !formData.customPrompt) return false;
    if (tokenValidationStatus !== 'valid') return false;
    return true;
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <UserTypeToggle 
        isPowerUser={isPowerUser}
        onToggle={setIsPowerUser}
      />
      
      <div className="w-full max-w-4xl">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <h1 className="font-clash text-3xl font-bold text-center text-thirteen-purple">
            THIRTEEN AI
          </h1>
        </div>

        <div className="space-y-6">
          {/* Main Form */}
          <Card className="p-8 bg-gradient-surface border-border shadow-elevated">
            <div className="mb-6">
              <h2 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-2">
                AI Growth Accelerator
              </h2>
              <p className="text-muted-foreground">
                Upload your leads and let our AI generate personalized messages that convert
                {isPowerUser && " • Power User Mode Active"}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Authentication Token */}
              <div className="space-y-3">
                <Label htmlFor="authToken" className="text-foreground font-medium">
                  Authentication Token
                </Label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Input
                      id="authToken"
                      type="password"
                      placeholder="Enter your authentication token"
                      value={formData.authToken}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, authToken: e.target.value }));
                        setTokenValidationStatus('idle');
                      }}
                      className="bg-input border-border pr-10"
                    />
                    {tokenValidationStatus !== 'idle' && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        {tokenValidationStatus === 'valid' ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleValidateToken}
                    disabled={isValidatingToken || !formData.authToken}
                    className="px-4"
                  >
                    {isValidatingToken ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Validate'
                    )}
                  </Button>
                </div>
              </div>

              {/* Campaign Name */}
              <div className="space-y-3">
                <Label htmlFor="campaignName" className="text-foreground font-medium">
                  Campaign Name
                </Label>
                <Input
                  id="campaignName"
                  type="text"
                  placeholder="Enter campaign name"
                  value={formData.campaignName}
                  onChange={handleCampaignNameChange}
                  className="bg-input border-border"
                />
                {campaignNameError && (
                  <p className="text-sm text-destructive mt-1">{campaignNameError}</p>
                )}
              </div>

              {/* Lead Source Selection */}
              <div className="space-y-3">
                <Label htmlFor="leadSource" className="text-foreground font-medium">
                  Lead Information Source
                </Label>
                <Select 
                  value={formData.leadSource} 
                  onValueChange={(value: 'apollo' | 'csv') => 
                    setFormData(prev => ({ ...prev, leadSource: value }))
                  }
                >
                  <SelectTrigger className="bg-input border-border">
                    <SelectValue placeholder="Select your lead source" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="apollo">
                      <div className="flex items-center gap-2">
                        <Target className="w-4 h-4" />
                        Apollo URL
                      </div>
                    </SelectItem>
                    <SelectItem value="csv">
                      <div className="flex items-center gap-2">
                        <Upload className="w-4 h-4" />
                        CSV Upload
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Apollo Filter Form */}
              {formData.leadSource === 'apollo' && (
                <div className="space-y-6">
                  <ApolloFilterForm
                    onUrlGenerated={handleApolloUrlGenerated}
                  />

                  {/* Fallback: Manual Apollo URL Input */}
                  <div className="border-t border-border pt-4">
                    <div className="space-y-3">
                      <Label htmlFor="apolloUrl" className="text-foreground font-medium text-sm">
                        Or paste existing Apollo URL (optional)
                      </Label>
                      <Input
                        id="apolloUrl"
                        type="url"
                        placeholder="https://app.apollo.io/..."
                        value={formData.apolloUrl}
                        onChange={(e) => setFormData(prev => ({ ...prev, apolloUrl: e.target.value }))}
                        className="bg-input border-border"
                      />
                      <p className="text-xs text-muted-foreground">
                        If you have an existing Apollo URL, you can paste it here instead of using the filter builder above.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* CSV Upload */}
              {formData.leadSource === 'csv' && (
                <div className="space-y-3">
                  <Label htmlFor="csvFile" className="text-foreground font-medium">
                    Upload CSV File
                  </Label>
                  
                  {/* CSV Requirements */}
                  <div className="bg-muted/20 rounded-lg p-4 border border-border/30">
                    <h4 className="text-sm font-medium text-foreground mb-2">Required CSV Columns:</h4>
                    <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                      <div>• First Name</div>
                      <div>• Last Name</div>
                      <div>• Linkedin URL</div>
                      <div>• Company Website</div>
                      <div>• Email</div>
                    </div>
                  </div>
                  
                  <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                    <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <Input
                      id="csvFile"
                      type="file"
                      accept=".csv"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <Label htmlFor="csvFile" className="cursor-pointer">
                      {formData.csvFile ? (
                        <span className="text-primary">{formData.csvFile.name}</span>
                      ) : (
                        <span className="text-muted-foreground">
                          Click to upload CSV file or drag and drop
                        </span>
                      )}
                    </Label>
                  </div>

                  {/* CSV Validation Status */}
                  {formData.csvFile && (
                    <div className="mt-3">
                      {csvValidationStatus === 'valid' && (
                        <div className="flex items-center gap-2 text-green-600 text-sm">
                          <CheckCircle className="w-4 h-4" />
                          <span>CSV is Valid</span>
                        </div>
                      )}
                      {csvValidationStatus === 'invalid' && (
                        <div className="flex items-center gap-2 text-red-600 text-sm">
                          <XCircle className="w-4 h-4" />
                          <span>{csvValidationError}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Lead Count (only for Apollo) */}
              {formData.leadSource === 'apollo' && (
                <div className="space-y-3">
                  <Label htmlFor="leadCount" className="text-foreground font-medium">
                    Number of Leads to Personalize
                  </Label>
                  <Input
                    id="leadCount"
                    type="number"
                    min="500"
                    max="10000"
                    value={formData.leadCount}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '') {
                        setFormData(prev => ({ ...prev, leadCount: '' as any }));
                      } else {
                        const numValue = parseInt(value);
                        if (!isNaN(numValue)) {
                          setFormData(prev => ({ ...prev, leadCount: numValue }));
                        }
                      }
                    }}
                    onBlur={(e) => {
                      if (e.target.value === '' || parseInt(e.target.value) < 500) {
                        setFormData(prev => ({ ...prev, leadCount: 500 }));
                      } else if (parseInt(e.target.value) > 10000) {
                        setFormData(prev => ({ ...prev, leadCount: 10000 }));
                      }
                    }}
                    className="bg-input border-border"
                  />
                  
                  {/* Warning for large lead counts */}
                  {formData.leadCount > 1000 && (
                    <div className="mt-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-yellow-600 dark:text-yellow-400">
                          <span className="font-medium">Large Lead Count:</span> Processing {formData.leadCount.toLocaleString()} leads will take significantly longer to complete. Consider breaking this into smaller batches for faster processing.
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <p className="text-xs text-muted-foreground mt-1">
                    Range: 500 - 10,000 leads
                  </p>
                </div>
              )}

              {/* Output Format */}
              <div className="space-y-4">
                <Label className="text-foreground font-medium">Desired Output Format</Label>
                
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="instantly"
                      checked={formData.outputFormats.instantly}
                      onCheckedChange={(checked) =>
                        setFormData(prev => ({
                          ...prev,
                          outputFormats: { ...prev.outputFormats, instantly: !!checked }
                        }))
                      }
                    />
                    <div className="flex-1">
                      <Label htmlFor="instantly" className="text-foreground cursor-pointer">
                        Send to Instantly Campaign
                      </Label>
                      {formData.outputFormats.instantly && (
                        <div className="mt-2">
                          <Input
                            placeholder="Campaign ID"
                            value={formData.campaignId}
                            onChange={(e) => setFormData(prev => ({ ...prev, campaignId: e.target.value }))}
                            className="bg-input border-border"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="email"
                      checked={formData.outputFormats.email}
                      onCheckedChange={(checked) =>
                        setFormData(prev => ({
                          ...prev,
                          outputFormats: { ...prev.outputFormats, email: !!checked }
                        }))
                      }
                    />
                    <div className="flex-1">
                      <Label htmlFor="email" className="text-foreground cursor-pointer">
                        Email CSV
                      </Label>
                      {formData.outputFormats.email && (
                        <div className="mt-2">
                          <Input
                            type="email"
                            placeholder="your@email.com"
                            value={formData.email}
                            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                            className="bg-input border-border"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Power User Personalization Options */}
              {isPowerUser && (
                <div className="space-y-4 p-6 bg-gradient-surface border border-primary/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-4">
                    <Briefcase className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-semibold text-primary">Power User Personalization</h3>
                  </div>
                  <p className="text-muted-foreground text-sm mb-6">
                    Choose your AI personalization strategy for maximum conversion
                  </p>
                  
                  <RadioGroup 
                    value={formData.personalizationStrategy} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, personalizationStrategy: value }))}
                    className="space-y-4"
                  >
                    {presetStrategies.map((strategy) => {
                      const IconComponent = strategy.icon;
                      return (
                        <div key={strategy.id} className="space-y-2">
                          <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:border-primary/30 transition-colors">
                            <RadioGroupItem value={strategy.id} id={strategy.id} />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <IconComponent className="w-4 h-4 text-primary" />
                                <Label 
                                  htmlFor={strategy.id} 
                                  className="font-medium text-foreground cursor-pointer"
                                >
                                  {strategy.name}
                                </Label>
                                <Badge variant="outline" className="text-xs">
                                  AI-Powered
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {strategy.description}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    
                    {/* Custom Prompt Option */}
                    <div className="space-y-2">
                      <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:border-primary/30 transition-colors">
                        <RadioGroupItem value="custom" id="custom" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <FileText className="w-4 h-4 text-primary" />
                            <Label 
                              htmlFor="custom" 
                              className="font-medium text-foreground cursor-pointer"
                            >
                              Custom Prompt
                            </Label>
                            <Badge variant="outline" className="text-xs">
                              Advanced
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Write your own Claude AI instructions for personalization
                          </p>
                        </div>
                      </div>
                      
                      {formData.personalizationStrategy === 'custom' && (
                        <div className="pl-7">
                          <Textarea
                            placeholder="Write your custom Claude AI prompt for lead personalization..."
                            value={formData.customPrompt}
                            onChange={(e) => setFormData(prev => ({ ...prev, customPrompt: e.target.value }))}
                            className="min-h-[100px] bg-input border-border"
                          />
                        </div>
                      )}
                    </div>
                  </RadioGroup>
                  
                  <div className="flex gap-3 pt-4 border-t border-border">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handlePreview}
                      className="flex items-center gap-2"
                      disabled={!formData.personalizationStrategy}
                    >
                      <Eye className="w-4 h-4" />
                      Preview AI Message
                    </Button>
                  </div>
                </div>
              )}

              <Button
                type="submit"
                disabled={!isFormValid() || isSubmitting}
                className="w-full bg-gradient-primary hover:shadow-glow transition-all duration-300"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    In Queue
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Start {isPowerUser ? 'Enhanced ' : ''}Lead Enrichment
                  </>
                )}
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
