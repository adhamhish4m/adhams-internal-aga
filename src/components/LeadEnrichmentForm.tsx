import { useState } from 'react';
import { Upload, Zap, Mail, Target, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface FormData {
  leadSource: 'apollo' | 'csv' | '';
  apolloUrl: string;
  csvFile: File | null;
  leadCount: number;
  outputFormats: {
    instantly: boolean;
    email: boolean;
  };
  campaignId: string;
  email: string;
  campaignName: string;
}

interface LeadEnrichmentFormProps {
  onSubmissionSuccess: (data: any) => void;
}

export function LeadEnrichmentForm({ onSubmissionSuccess }: LeadEnrichmentFormProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState<FormData>({
    leadSource: '',
    apolloUrl: '',
    csvFile: null,
    leadCount: 500,
    outputFormats: {
      instantly: false,
      email: false,
    },
    campaignId: '',
    email: '',
    campaignName: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [campaignNameError, setCampaignNameError] = useState<string>('');
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setFormData(prev => ({ ...prev, csvFile: file }));
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
    
    setIsSubmitting(true);

    try {
      // First, create a run record in Supabase
      const { data: runData, error: runError } = await supabase
        .from('AGA Runs Progress')
        .insert({
          run_id: crypto.randomUUID(),
          status: 'Processing Leads',
          lead_count: formData.leadSource === 'apollo' ? formData.leadCount : null,
          source: formData.leadSource === 'apollo' ? 'Apollo URL' : 'CSV Upload',
          campaign_name: formData.campaignName
        })
        .select()
        .single();

      if (runError) {
        throw new Error('Failed to create run record: ' + runError.message);
      }

      // Prepare form data for webhook with run_id
      const submissionData = new FormData();

      submissionData.append('leadSource', formData.leadSource);
      submissionData.append('run_id', runData.run_id); // Add run_id to webhook payload
      submissionData.append('campaignName', formData.campaignName);
      submissionData.append('rerun', 'false'); // Add rerun flag set to false for new campaigns

      if (formData.leadSource === 'apollo') {
        submissionData.append('apolloUrl', formData.apolloUrl);
        submissionData.append('leadCount', formData.leadCount.toString());
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

      // Add prompt fields to webhook submission
      submissionData.append('perplexityPrompt', '');
      submissionData.append('promptTask', '');
      submissionData.append('personalizationPrompt', '');
      submissionData.append('promptExample', '');

      // Create payload object for storage (excluding file for JSON serialization)
      const webhookPayload: any = {
        leadSource: formData.leadSource,
        run_id: runData.run_id,
        campaignName: formData.campaignName,
        rerun: false,
        outputInstantly: formData.outputFormats.instantly,
        outputEmail: formData.outputFormats.email,
        perplexityPrompt: '',
        promptTask: '',
        personalizationPrompt: '',
        promptExample: ''
      };

      if (formData.leadSource === 'apollo') {
        webhookPayload.apolloUrl = formData.apolloUrl;
        webhookPayload.leadCount = formData.leadCount;
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

      // Create campaign record with webhook payload
      const { error: campaignError } = await supabase
        .from('campaigns')
        .insert({
          name: formData.campaignName,
          user_id: user.id,
          source: formData.leadSource === 'apollo' ? 'Apollo URL' : 'CSV Upload',
          instantly_campaign_id: formData.outputFormats.instantly ? formData.campaignId : null,
          lead_count: formData.leadSource === 'apollo' ? formData.leadCount : 0,
          webhook_payload: webhookPayload,
          user_auth_id: user.id
        });

      if (campaignError) {
        console.error('Failed to create campaign record:', campaignError);
        // Continue anyway - don't block webhook submission
      }

      // Webhook URL
      const webhookUrl = 'https://primary-production-6226d.up.railway.app/webhook/nov-2025-adham';

      // Trigger webhook (fire and forget)
      fetch(webhookUrl, {
        method: 'POST',
        body: submissionData,
      });
      
      toast({
        title: "Success!",
        description: "Your lead enrichment has been submitted successfully.",
      });

      // Go straight to dashboard with run data
      const dashboardData = {
        leadSource: formData.leadSource,
        leadCount: formData.leadSource === 'apollo' ? formData.leadCount : (formData.csvFile ? 1000 : 0), // Estimate for CSV
        run_id: runData.run_id,
        timestamp: new Date(),
      };

      onSubmissionSuccess(dashboardData);
      
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
    if (!formData.campaignName) return false;
    if (!formData.leadSource) return false;
    if (formData.leadSource === 'apollo' && !formData.apolloUrl) return false;
    if (formData.leadSource === 'csv' && !formData.csvFile) return false;
    if (!formData.outputFormats.instantly && !formData.outputFormats.email) return false;
    if (formData.outputFormats.instantly && !formData.campaignId) return false;
    if (formData.outputFormats.email && !formData.email) return false;
    return true;
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <h1 className="font-clash text-2xl font-bold text-thirteen-purple mb-4">
                THIRTEEN AI
          </h1>
        </div>

        <Card className="p-8 bg-gradient-surface border-border shadow-elevated">
          <div className="mb-6">
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-2">
              AI Growth Accelerator
            </h1>
            <p className="text-muted-foreground">
              Upload your leads and let our AI generate personalized messages that convert
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
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

            {/* Apollo URL Input */}
            {formData.leadSource === 'apollo' && (
              <div className="space-y-3">
                <Label htmlFor="apolloUrl" className="text-foreground font-medium">
                  Apollo URL
                </Label>
                <Input
                  id="apolloUrl"
                  type="url"
                  placeholder="https://app.apollo.io/..."
                  value={formData.apolloUrl}
                  onChange={(e) => setFormData(prev => ({ ...prev, apolloUrl: e.target.value }))}
                  className="bg-input border-border"
                />
              </div>
            )}

            {/* CSV Upload */}
            {formData.leadSource === 'csv' && (
              <div className="space-y-3">
                <Label htmlFor="csvFile" className="text-foreground font-medium">
                  Upload CSV File
                </Label>
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
                  onChange={(e) => setFormData(prev => ({ ...prev, leadCount: parseInt(e.target.value) || 500 }))}
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

            <Button
              type="submit"
              disabled={!isFormValid() || isSubmitting}
              className="w-full bg-gradient-primary hover:shadow-glow transition-all duration-300"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Start Lead Enrichment
                </>
              )}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
