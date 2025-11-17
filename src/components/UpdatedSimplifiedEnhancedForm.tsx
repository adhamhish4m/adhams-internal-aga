import { useState } from 'react';
import { Upload, Rocket, Loader2, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
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
    <div className="min-h-screen">
      <Navigation />

      <div className="flex items-center justify-center p-4 pt-20">
        <div className="w-full max-w-4xl">
        <div className="space-y-6">
          {/* Main Form */}
          <Card className="p-8 bg-gradient-surface border-border shadow-elevated">
            <div className="mb-6">
              <h2 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-2">
                AI Growth Accelerator
              </h2>
              <p className="text-muted-foreground">
                Upload your leads and let our AI generate personalized icebreakers that convert
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
                  onValueChange={(value: 'apollo' | 'csv') => {
                    setFormData(prev => ({ ...prev, leadSource: value }));
                  }}
                >
                  <SelectTrigger className="bg-input border-border">
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
                    <Label htmlFor="apolloUrl" className="text-foreground font-medium">
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
                      className="bg-input border-border"
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Paste your Apollo search URL here. We'll automatically extract the leads from it.
                    </p>
                  </div>

                  {/* Lead Count Section */}
                  <div className="space-y-3 border-t border-border pt-4">
                    <Label htmlFor="leadCount" className="text-foreground font-medium">
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
                      className="bg-input border-border"
                    />

                    {/* Warning for large lead counts */}
                    {typeof formData.leadCount === 'number' && formData.leadCount > 1000 && (
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
                    className={`border-2 rounded-lg p-8 transition-all ${
                      isDragOver
                        ? 'border-blue-400 bg-blue-50/50 dark:bg-blue-950/30'
                        : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 hover:border-blue-300 dark:hover:border-blue-700'
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <div className="flex items-center justify-center">
                      <div className="text-center">
                        <Upload className={`mx-auto h-10 w-10 mb-3 ${isDragOver ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500'}`} />
                        <Label htmlFor="csvFile" className="cursor-pointer">
                          <span className={`text-sm font-medium ${isDragOver ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}>
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
                          <p className="text-sm text-blue-600 dark:text-blue-400 font-semibold mt-3">
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
              <Card className="p-6 bg-blue-50/50 dark:bg-blue-950/20 border-2 border-blue-200 dark:border-blue-800 shadow-lg">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <Label htmlFor="researchSystemPrompt" className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                      Research System Prompt
                    </Label>
                  </div>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                    This prompt guides Perplexity to research each lead before personalization.
                  </p>
                  <Textarea
                    id="researchSystemPrompt"
                    placeholder="Enter your research system prompt..."
                    value={researchSystemPrompt}
                    onChange={(e) => setResearchSystemPrompt(e.target.value)}
                    className="bg-white dark:bg-gray-900 border-blue-300 dark:border-blue-700 min-h-[250px] font-mono text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </Card>

              {/* Personalization System Prompt */}
              <Card className="p-6 bg-purple-50/50 dark:bg-purple-950/20 border-2 border-purple-200 dark:border-purple-800 shadow-lg">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <Label htmlFor="personalizationSystemPrompt" className="text-lg font-semibold text-purple-900 dark:text-purple-100">
                      Personalization System Prompt
                    </Label>
                  </div>
                  <p className="text-sm text-purple-700 dark:text-purple-300 mb-3">
                    Configure how the AI creates personalized icebreakers based on research.
                  </p>
                  <Textarea
                    id="personalizationSystemPrompt"
                    placeholder="Enter your personalization system prompt..."
                    value={personalizationSystemPrompt}
                    onChange={(e) => setPersonalizationSystemPrompt(e.target.value)}
                    className="bg-white dark:bg-gray-900 border-purple-300 dark:border-purple-700 min-h-[400px] font-mono text-sm focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </Card>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full bg-gradient-primary hover:opacity-90 transition-opacity py-6 text-lg"
                disabled={!isFormValid() || isSubmitting || campaignNameError !== ''}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    In Queue
                  </>
                ) : (
                  <>
                    <Rocket className="w-5 h-5 mr-2" />
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
