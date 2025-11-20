import { useState, useEffect } from 'react';
import { Upload, Rocket, Loader2, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Navigation } from './Navigation';


interface FormData {
  leadSource: 'apollo' | 'csv' | '';
  apolloUrl: string;
  csvFile: File | null;
  leadCount: number;
  campaignName: string;
}

interface UpdatedSimplifiedEnhancedFormProps {
  onSubmissionSuccess: (data: any) => void;
}

export function UpdatedSimplifiedEnhancedForm({ onSubmissionSuccess }: UpdatedSimplifiedEnhancedFormProps) {
  const { user, userProfile } = useAuth();
  const [formData, setFormData] = useState<FormData>({
    leadSource: '',
    apolloUrl: '',
    csvFile: null,
    leadCount: 500,
    campaignName: '',
  });

  // Research System Prompt
  const [researchSystemPrompt, setResearchSystemPrompt] = useState(`You are a research assistant that finds recent company achievements and milestones for personalized cold outreach. Focus on the most current accomplishments, announcements, and recognition from the past 6 months that demonstrate momentum and success.

Research this lead and find recent achievements for personalized cold outreach. Focus on finding:
- Recent awards, certifications, or industry recognition (last 6 months)
- New funding rounds, investments, or financial milestones
- Major partnerships, acquisitions, or strategic alliances
- Product launches, feature releases, or service expansions
- Team growth, new executive hires, or company expansions
- Media coverage or press mentions for recent accomplishments

If no recent achievements are available, focus on:
- Company history and establishment date
- Overall business growth or stability indicators
- Industry position or market presence
- Core business developments or service evolution
- General company trajectory and business model

# Output Format
Company Overview: [Brief description of what they do]
Recent Achievement: [Most impressive recent accomplishment OR notable company milestone/background]
Latest News: [Secondary recent development OR general business strength/position]
Summary: [1 sentence about their recent momentum OR their established market position and business focus]`);

  // Personalization System Prompt - single combined prompt
  const [personalizationSystemPrompt, setPersonalizationSystemPrompt] = useState(`# Task
Create a personalized icebreaker sentence based on the provided company information. This will be the opening line of a cold outreach email.

## Main focus
Focus on complimenting their services, achievements, or notable business aspects using simple language. If achievement data isn't available: Use research information to comment on their service quality, business approach, or industry expertise in simple terms

• Use a conversational tone that sounds human and natural
• Keep it short — maximum 25 words
• Write at a grade 6 reading level using simple language
• Do not use em dashes (—) or complex punctuation
• Only write in English
• Do not ask questions or request meetings
• Do not guess, exaggerate, or invent information — only use the data provided
• Paraphrase information rather than copying sentences directly

## Example:
Instead of: "I appreciate how Heaven's Pets combines heartfelt, personalized pet cremation services with thoughtful keepsakes, truly honoring each pet's unique memory."

Write: "I like how Heaven's Pets gives loving pet cremation services and keepsakes that honor each pet."

## Output Format:
Return only a JSON object with the personalized sentence:

{
"personalized_sentence": ""
}

If insufficient information is available to create a meaningful personalized sentence, return an empty string.

IMPORTANT: If you cannot generate a message, return an empty string.`);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [campaignNameError, setCampaignNameError] = useState<string>('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [csvValidationStatus, setCsvValidationStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [csvValidationError, setCsvValidationError] = useState<string>('');
  const [csvRowCount, setCsvRowCount] = useState<number>(0);
  const [hasActiveRuns, setHasActiveRuns] = useState(false);
  const { toast } = useToast();

  // Check for active runs on component mount and periodically
  useEffect(() => {
    const checkRuns = async () => {
      const active = await checkForActiveRuns();
      setHasActiveRuns(active);
    };

    checkRuns();
    const interval = setInterval(checkRuns, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [user]);

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

  const validateCsvColumns = async (file: File): Promise<boolean> => {
    const requiredColumns = ['First Name', 'Last Name', 'LinkedIn', 'Company Website', 'Email'];
    const optionalColumns = ['Job Title', 'Industry', 'Employee Count', 'Company Name', 'Company LinkedIn URL', 'Phone Number', 'Location'];

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
            // Check for optional columns and provide feedback
            const presentOptionalColumns = optionalColumns.filter(col => headers.includes(col));

            // Count total rows (including header)
            setCsvRowCount(lines.length);

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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        setFormData(prev => ({ ...prev, csvFile: file }));
        setCsvValidationStatus('idle');
        setCsvValidationError('');
        await validateCsvColumns(file);
      } else {
        toast({
          title: "Invalid file type",
          description: "Please upload a CSV file.",
          variant: "destructive"
        });
      }
    }
  };


  // Check if there are any active runs for the current user
  const checkForActiveRuns = async (): Promise<boolean> => {
    if (!user) return false;

    try {
      const { data, error } = await supabase
        .from('AGA Runs Progress')
        .select('run_id, status, campaign_name')
        .eq('user_auth_id', user.id)
        .neq('status', 'Done')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error checking active runs:', error);
        return false;
      }

      return data && data.length > 0;
    } catch (error) {
      console.error('Error checking active runs:', error);
      return false;
    }
  };

  // Wait for active runs to complete
  const waitForActiveRunsToComplete = async (): Promise<void> => {
    const pollInterval = 5000; // Poll every 5 seconds
    const maxWaitTime = 1800000; // Maximum 30 minutes
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const hasActiveRuns = await checkForActiveRuns();

      if (!hasActiveRuns) {
        return; // No active runs, proceed
      }

      // Wait before polling again
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('Timeout waiting for active runs to complete');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

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

    // Check for active runs and wait if necessary
    try {
      const hasActiveRuns = await checkForActiveRuns();

      if (hasActiveRuns) {
        toast({
          title: "Waiting in Queue",
          description: "You have an active run in progress. Waiting for it to complete before starting this campaign...",
        });

        await waitForActiveRunsToComplete();

        toast({
          title: "Queue Ready",
          description: "Previous run completed. Starting your campaign now...",
        });
      }
    } catch (error) {
      console.error('Error waiting for active runs:', error);
      toast({
        title: "Queue Error",
        description: "Could not verify run queue status. Please try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    try {
      // Create campaign record
      const { data: campaignData, error: campaignError } = await supabase
        .from('campaigns')
        .insert({
          id: crypto.randomUUID(),
          user_auth_id: user.id,
          name: formData.campaignName,
          source: formData.leadSource === 'apollo' ? 'Apollo URL' : 'CSV Upload',
          lead_count: formData.leadSource === 'apollo' ? formData.leadCount : null,
          personalization_strategy: null,
          custom_prompt: null,
          instantly_campaign_id: null,
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
      const leadInsertData = {
        id: crypto.randomUUID(),
        campaign_id: campaignData.id,
        lead_data: {},
        apollo_cache: formData.leadSource === 'apollo' ? {} : null,
        csv_cache: formData.leadSource === 'csv' ? {} : null
      };

      const { data: campaignLeadData, error: leadError } = await supabase
        .from('campaign_leads')
        .insert(leadInsertData)
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
          user_auth_id: user.id
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
      submissionData.append('user_id', user.id);
      submissionData.append('rerun', 'false'); // Add rerun flag set to false for new campaigns
      
      // Use the edited research and personalization prompts
      submissionData.append('perplexityPrompt', researchSystemPrompt);
      submissionData.append('personalizationPrompt', personalizationSystemPrompt);
      submissionData.append('promptTask', 'Create a personalized icebreaker sentence based on the provided company information.');
      submissionData.append('promptGuidelines', '• Use a conversational tone that sounds human and natural\n• Keep it short — maximum 25 words\n• Write at a grade 6 reading level using simple language');
      submissionData.append('promptExample', 'Instead of: "I appreciate how Heaven\'s Pets combines heartfelt, personalized pet cremation services with thoughtful keepsakes, truly honoring each pet\'s unique memory."\n\nWrite: "I like how Heaven\'s Pets gives loving pet cremation services and keepsakes that honor each pet."');
      submissionData.append('personalizationStrategy', 'company-achievements');

      if (formData.leadSource === 'apollo') {
        submissionData.append('apolloUrl', formData.apolloUrl);
        submissionData.append('leadCount', formData.leadCount.toString());
      } else if (formData.leadSource === 'csv' && formData.csvFile) {
        submissionData.append('csvFile', formData.csvFile);
      }

      // Create payload object for storage (excluding file for JSON serialization)
      const webhookPayload: any = {
        leadSource: formData.leadSource,
        run_id: runData.run_id,
        campaignName: formData.campaignName,
        campaign_id: campaignData.id,
        campaign_leads_id: campaignLeadData.id,
        user_id: user.id,
        rerun: false,
        perplexityPrompt: researchSystemPrompt,
        promptTask: 'Create a personalized icebreaker sentence based on the provided company information.',
        personalizationPrompt: personalizationSystemPrompt,
        promptGuidelines: '• Use a conversational tone that sounds human and natural\n• Keep it short — maximum 25 words\n• Write at a grade 6 reading level using simple language',
        promptExample: 'Instead of: "I appreciate how Heaven\'s Pets combines heartfelt, personalized pet cremation services with thoughtful keepsakes, truly honoring each pet\'s unique memory."\n\nWrite: "I like how Heaven\'s Pets gives loving pet cremation services and keepsakes that honor each pet."',
        personalizationStrategy: 'company-achievements'
      };

      if (formData.leadSource === 'apollo') {
        webhookPayload.apolloUrl = formData.apolloUrl;
        webhookPayload.leadCount = formData.leadCount;
      } else if (formData.leadSource === 'csv' && formData.csvFile) {
        webhookPayload.csvFileName = formData.csvFile.name;
        webhookPayload.csvFileSize = formData.csvFile.size;
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
        description: "Your lead enrichment has been submitted successfully.",
      });

      // Call success callback to navigate to dashboard
      onSubmissionSuccess(campaignData);
      
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

    // For Apollo source, require URL
    if (formData.leadSource === 'apollo') {
      if (!formData.apolloUrl || formData.apolloUrl.trim() === '') return false;
    }

    if (formData.leadSource === 'csv') {
      if (!formData.csvFile) return false;
      if (csvValidationStatus !== 'valid') return false;
    }

    return true;
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated Background - Same as Dashboard */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-background to-blue-500/5" />
        <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-500/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob" />
        <div className="absolute top-0 -right-4 w-72 h-72 bg-blue-500/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000" />
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-500/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000" />
      </div>

      <Navigation />

      <div className="flex items-center justify-center p-4 pt-20">
        <div className="w-full max-w-4xl">
        <div className="space-y-6">
          {/* Main Form */}
          <Card className="p-6 sm:p-8 border-2 backdrop-blur-sm bg-background/80 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300">
            <div className="mb-6 sm:mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-primary via-primary-glow to-primary">
                AI Growth Accelerator
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground">
                Upload your leads and let our AI generate personalized icebreakers that convert
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Campaign Name */}
              <div className="space-y-3 group">
                <Label htmlFor="campaignName" className="text-foreground font-medium text-sm sm:text-base">
                  Campaign Name
                </Label>
                <Input
                  id="campaignName"
                  type="text"
                  placeholder="Enter campaign name"
                  value={formData.campaignName}
                  onChange={handleCampaignNameChange}
                  className="bg-input border-2 hover:border-primary/50 focus:border-primary transition-all duration-300"
                />
                {campaignNameError && (
                  <p className="text-sm text-destructive mt-1 flex items-center gap-1">
                    <XCircle className="w-4 h-4" />
                    {campaignNameError}
                  </p>
                )}
              </div>

              {/* Lead Source Selection */}
              <div className="space-y-3">
                <Label htmlFor="leadSource" className="text-foreground font-medium text-sm sm:text-base">
                  Lead Information Source
                </Label>
                <Select
                  value={formData.leadSource}
                  onValueChange={(value: 'apollo' | 'csv') => {
                    setFormData(prev => ({ ...prev, leadSource: value }));
                  }}
                >
                  <SelectTrigger className="bg-input border-2 hover:border-primary/50 transition-all duration-300">
                    <SelectValue placeholder="Select your lead source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="apollo">Apollo URL</SelectItem>
                    <SelectItem value="csv">CSV Upload</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Apollo URL Input */}
              {formData.leadSource === 'apollo' && (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <Label htmlFor="apolloUrl" className="text-foreground font-medium text-sm sm:text-base">
                      Apollo URL
                    </Label>
                    <Input
                      id="apolloUrl"
                      type="url"
                      placeholder="https://app.apollo.io/..."
                      value={formData.apolloUrl}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, apolloUrl: e.target.value }));
                      }}
                      className="bg-input border-2 hover:border-primary/50 focus:border-primary transition-all duration-300"
                      required
                    />
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Paste your Apollo search URL here. We'll automatically extract the leads from it.
                    </p>
                  </div>

                  {/* Lead Count Section */}
                  <div className="space-y-3 border-t border-border pt-4">
                    <Label htmlFor="leadCount" className="text-foreground font-medium text-sm sm:text-base">
                      Number of Leads to Process
                    </Label>
                    <Input
                      id="leadCount"
                      type="text"
                      value={formData.leadCount.toString()}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '') {
                          setFormData(prev => ({ ...prev, leadCount: '' as any }));
                        } else if (/^\d+$/.test(value)) {
                          const numValue = parseInt(value);
                          setFormData(prev => ({ ...prev, leadCount: numValue }));
                        }
                      }}
                      onBlur={(e) => {
                        const value = e.target.value;
                        if (value === '' || parseInt(value) < 500 || isNaN(parseInt(value))) {
                          setFormData(prev => ({ ...prev, leadCount: 500 }));
                        } else if (parseInt(value) > 10000) {
                          setFormData(prev => ({ ...prev, leadCount: 10000 }));
                        }
                      }}
                      className="bg-input border-2 hover:border-primary/50 focus:border-primary transition-all duration-300"
                    />

                    {/* Warning for large lead counts */}
                    {typeof formData.leadCount === 'number' && formData.leadCount > 1000 && (
                      <div className="mt-2 p-3 sm:p-4 bg-yellow-500/10 border-2 border-yellow-500/30 rounded-lg hover:shadow-lg hover:shadow-yellow-500/20 transition-all duration-300">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                          <div className="text-xs sm:text-sm text-yellow-600 dark:text-yellow-400">
                            <span className="font-medium">Large Lead Count:</span> Processing {formData.leadCount.toLocaleString()} leads will take significantly longer to complete. Consider breaking this into smaller batches for faster processing.
                          </div>
                        </div>
                      </div>
                    )}

                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                      Range: 500 - 10,000 leads
                    </p>
                  </div>

                </div>
              )}

              {/* CSV Upload */}
              {formData.leadSource === 'csv' && (
                <div className="space-y-3">
                  <Label htmlFor="csvFile" className="text-foreground font-medium text-sm sm:text-base">
                    Upload CSV File
                  </Label>

                  {/* CSV Requirements */}
                  <div className="bg-muted/20 rounded-lg p-3 sm:p-4 border-2 border-border/30 hover:shadow-lg hover:shadow-primary/10 transition-all duration-300">
                    <div className="space-y-3">
                      <div className="mb-3 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded">
                        <p className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">
                          ⚠️ Important: Column names must match exactly (including spelling and casing)
                        </p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-foreground mb-2">Required CSV Columns:</h4>
                        <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground font-mono">
                          <div>• First Name</div>
                          <div>• Last Name</div>
                          <div>• LinkedIn</div>
                          <div>• Company Website</div>
                          <div>• Email</div>
                        </div>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-foreground mb-2">Optional CSV Columns:</h4>
                        <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground font-mono">
                          <div>• Job Title</div>
                          <div>• Industry</div>
                          <div>• Employee Count</div>
                          <div>• Company Name</div>
                          <div>• Company LinkedIn URL</div>
                          <div>• Phone Number</div>
                          <div>• Location</div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2 italic">
                          Optional columns will enhance personalization when provided
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div
                    className={`border-2 rounded-lg p-6 sm:p-8 transition-all duration-300 ${
                      isDragOver
                        ? 'border-primary bg-primary/10 shadow-xl shadow-primary/20'
                        : 'border-border bg-background/50 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10'
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <div className="flex items-center justify-center">
                      <div className="text-center">
                        <Upload className={`mx-auto h-8 w-8 sm:h-10 sm:w-10 mb-3 transition-all duration-300 ${isDragOver ? 'text-primary scale-110' : 'text-muted-foreground'}`} />
                        <Label htmlFor="csvFile" className="cursor-pointer">
                          <span className={`text-xs sm:text-sm font-medium transition-colors ${isDragOver ? 'text-primary' : 'text-foreground'}`}>
                            {isDragOver ? 'Drop your CSV file here' : 'Click to upload or drag and drop your CSV file'}
                          </span>
                          <Input
                            id="csvFile"
                            type="file"
                            accept=".csv"
                            onChange={handleFileChange}
                            className="hidden"
                          />
                        </Label>
                        {formData.csvFile && (
                          <p className="text-xs sm:text-sm text-primary font-semibold mt-3 flex items-center justify-center gap-1">
                            <CheckCircle className="w-4 h-4" />
                            Selected: {formData.csvFile.name}
                          </p>
                        )}
                      </div>
                    </div>
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

              {/* Research System Prompt */}
              <Card className="p-4 sm:p-6 bg-blue-50/50 dark:bg-blue-950/20 border-2 border-blue-200 dark:border-blue-800 backdrop-blur-sm hover:shadow-xl hover:shadow-blue-500/20 transition-all duration-300">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    <Label htmlFor="researchSystemPrompt" className="text-base sm:text-lg font-semibold text-blue-900 dark:text-blue-100">
                      Research System Prompt
                    </Label>
                  </div>
                  <p className="text-xs sm:text-sm text-blue-700 dark:text-blue-300 mb-3">
                    This prompt guides Perplexity to research each lead before personalization.
                  </p>
                  <Textarea
                    id="researchSystemPrompt"
                    placeholder="Enter your research system prompt..."
                    value={researchSystemPrompt}
                    onChange={(e) => setResearchSystemPrompt(e.target.value)}
                    className="bg-white dark:bg-gray-900 border-2 border-blue-300 dark:border-blue-700 min-h-[250px] font-mono text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-all duration-300"
                  />
                </div>
              </Card>

              {/* Personalization System Prompt */}
              <Card className="p-4 sm:p-6 bg-purple-50/50 dark:bg-purple-950/20 border-2 border-purple-200 dark:border-purple-800 backdrop-blur-sm hover:shadow-xl hover:shadow-purple-500/20 transition-all duration-300">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                    <Label htmlFor="personalizationSystemPrompt" className="text-base sm:text-lg font-semibold text-purple-900 dark:text-purple-100">
                      Personalization System Prompt
                    </Label>
                  </div>
                  <p className="text-xs sm:text-sm text-purple-700 dark:text-purple-300 mb-3">
                    Configure how the AI creates personalized icebreakers based on research.
                  </p>
                  <Textarea
                    id="personalizationSystemPrompt"
                    placeholder="Enter your personalization system prompt..."
                    value={personalizationSystemPrompt}
                    onChange={(e) => setPersonalizationSystemPrompt(e.target.value)}
                    className="bg-white dark:bg-gray-900 border-2 border-purple-300 dark:border-purple-700 min-h-[400px] font-mono text-xs sm:text-sm focus:ring-2 focus:ring-purple-500 hover:border-purple-400 transition-all duration-300"
                  />
                </div>
              </Card>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-primary via-primary-glow to-primary hover:shadow-2xl hover:shadow-primary/40 hover:scale-[1.02] transition-all duration-300 py-5 sm:py-6 text-base sm:text-lg font-semibold"
                disabled={!isFormValid() || isSubmitting || campaignNameError !== ''}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 mr-2 animate-spin" />
                    In Queue
                  </>
                ) : hasActiveRuns ? (
                  <>
                    <Clock className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                    Add to Queue
                  </>
                ) : (
                  <>
                    <Rocket className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                    Let's Go!
                  </>
                )}
              </Button>
            </form>
          </Card>
        </div>
        </div>
      </div>
    </div>
  );
}
