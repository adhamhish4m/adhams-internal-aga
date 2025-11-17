import { useState, useCallback } from 'react';
import { Upload, Zap, Target, Loader2, Eye, Briefcase, Trophy, Users, FileText, MessageSquare, LogOut, Settings, Lightbulb, TrendingUp, Newspaper, AlertTriangle, CheckCircle, XCircle, X, Save, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { UserTypeToggle } from './UserTypeToggle';
import { Navigation } from './Navigation';

const presetStrategies = [
  {
    id: 'website-case-study',
    name: 'Website Case Studies',
    description: 'Comment on recent case studies featured on prospect\'s website',
    prompt: 'Focus specifically on case studies, client work, or success stories mentioned on their website. Highlight specific results, industries they\'ve helped, or notable projects they\'ve completed.\n\nIf case studies aren\'t available: Use the research information to focus on their service offerings, expertise areas, company background, unique approach, business model, specializations, or value proposition. Create personalized comments based on any notable aspects of their business found in the research.',
    icon: Lightbulb,
  },
  {
    id: 'company-achievements',
    name: 'Recent Achievements',
    description: 'Comment on recent company achievements and milestones',
    prompt: 'Focus on recent company milestones, awards, funding rounds, new hires, product launches, or other achievements mentioned in the research. Prioritize accomplishments from the last 6 months.\n\nIf recent achievements aren\'t available: Use the research information to focus on their established business presence, company history, industry expertise, service quality, business approach, market position, or any notable aspects of their operations found in the research.',
    icon: Trophy,
  },
  {
    id: 'linkedin-posts',
    name: 'LinkedIn Post Activity',
    description: 'Comment on recent LinkedIn posts from the prospect',
    prompt: 'Focus on recent LinkedIn posts or content the prospect has shared. Comment on their insights, opinions, or topics they\'re discussing. Reference their thought leadership or industry perspectives.\n\nIf LinkedIn activity isn\'t available: Use the research information to focus on their professional background, company mission, service approach, industry expertise, business specialization, or any other notable business aspects found in the research. Craft personalization based on their overall professional positioning and business strengths identified in the research data.',
    icon: MessageSquare,
  },
];


interface FormData {
  leadSource: 'apollo' | 'csv' | '';
  apolloUrl: string;
  csvFile: File | null;
  leadCount: number;
  sendToInstantly: boolean;
  campaignId: string;
  campaignName: string;
  personalizationStrategy: string;
  customPrompt: string;
  customTask: string;
  customGuidelines: string;
  customExample: string;
  isDemo: boolean;
}

interface UpdatedSimplifiedEnhancedFormProps {
  onSubmissionSuccess: (data: any) => void;
}

export function UpdatedSimplifiedEnhancedForm({ onSubmissionSuccess }: UpdatedSimplifiedEnhancedFormProps) {
  const { user, userProfile } = useAuth();
  const serverPowerUser = userProfile?.is_power_user || false;
  const [isPowerUserMode, setIsPowerUserMode] = useState(serverPowerUser);
  const [formData, setFormData] = useState<FormData>({
    leadSource: '',
    apolloUrl: '',
    csvFile: null,
    leadCount: 500,
    sendToInstantly: false,
    campaignId: '',
    campaignName: '',
    personalizationStrategy: 'website-case-study',
    customPrompt: '',
    customTask: '',
    customGuidelines: '',
    customExample: '',
    isDemo: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [campaignNameError, setCampaignNameError] = useState<string>('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [csvValidationStatus, setCsvValidationStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [csvValidationError, setCsvValidationError] = useState<string>('');
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewPrompt, setPreviewPrompt] = useState('');
  const [editedPrompt, setEditedPrompt] = useState('');
  const [exampleOutput, setExampleOutput] = useState('');
  const [taskContent, setTaskContent] = useState('Create a personalized icebreaker sentence based on the provided company information. This will be the opening line of a cold outreach email.');
  const [guidelinesContent, setGuidelinesContent] = useState('• Use a conversational tone that sounds human and natural\n• Keep it short — maximum 25 words\n• Write at a grade 6 reading level using simple language\n• Do not use em dashes (—) or complex punctuation\n• Only write in English\n• Do not ask questions or request meetings\n• Do not guess, exaggerate, or invent information — only use the data provided\n• Paraphrase information rather than copying sentences directly');
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
    const requiredColumns = ['First Name', 'Last Name', 'Linkedin URL', 'Company Website', 'Email'];
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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        setFormData(prev => ({ ...prev, csvFile: file }));
      } else {
        toast({
          title: "Invalid file type",
          description: "Please upload a CSV file.",
          variant: "destructive"
        });
      }
    }
  };

  const getExampleOutput = (strategyId: string) => {
    const examples = {
      'website-case-study': {
        instead: 'I was impressed by your comprehensive case study showcasing how you helped TechCorp achieve a 340% increase in qualified leads through strategic digital transformation and innovative marketing automation solutions.',
        write: 'I saw your case study about helping TechCorp get 340% more qualified leads through digital transformation.'
      },
      'company-achievements': {
        instead: 'Congratulations on your recent Series B funding announcement and the impressive milestone of reaching 10,000 customers, which demonstrates significant market validation and growth trajectory.',
        write: 'Congrats on your Series B funding and hitting 10,000 customers - great growth milestone.'
      },
      'linkedin-posts': {
        instead: 'I really appreciated your recent LinkedIn post about the challenges of implementing AI in healthcare, particularly your insights regarding data privacy concerns and the importance of maintaining human oversight.',
        write: 'I liked your LinkedIn post about AI in healthcare and keeping human oversight important.'
      },
      'custom': {
        instead: '[Complex sentence based on custom strategy]',
        write: '[Simplified version following custom guidelines]'
      }
    };

    return examples[strategyId] || examples['custom'];
  };

  const getPerplexityPrompt = (strategyId: string) => {
    const prompts = {
      'website-case-study': `You are a research assistant that finds case studies and client success stories for personalized cold outreach. Focus on published case studies, client testimonials, success metrics, and proven results that demonstrate their expertise and track record.

Research this lead's website and find specific case study details for personalized cold outreach. Focus on finding:
- Published case studies with specific results/metrics (ROI, growth percentages, cost savings)
- Client success stories and testimonials they've featured
- Before/after transformations or measurable outcomes they've achieved
- Industry-specific examples of their work
- Quantified results they've delivered (revenue increases, efficiency gains, etc.)

If no case studies or specific client results are available, focus on:
- Their service offerings and expertise areas
- Company background and years of experience
- Team credentials or founder background
- Industry focus or specialization
- Any general approach or methodology they emphasize

# Output Format
Company Overview: [Brief description of what they do]
Case Study Highlight: [Specific case study with metrics, OR their main service offering and expertise area]
Success Story: [Another client success example, OR their experience/credentials/approach]
Summary: [1 sentence about their proven track record OR their expertise and focus area]`,

      'company-achievements': `You are a research assistant that finds recent company achievements and milestones for personalized cold outreach. Focus on the most current accomplishments, announcements, and recognition from the past 6 months that demonstrate momentum and success.

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
Summary: [1 sentence about their recent momentum OR their established market position and business focus]`,

      'linkedin-posts': `You are a research assistant that analyzes LinkedIn content and thought leadership for personalized cold outreach. Focus on recent posts, articles, and professional insights shared by the company or key executives to understand their current priorities and perspectives.

Research this lead's LinkedIn presence and find content insights for personalized cold outreach. Focus on finding:
- Recent LinkedIn posts by the company or key executives (last 30 days)
- Industry insights, opinions, or thought leadership content they've shared
- Topics they're actively discussing or passionate about
- Professional updates, company announcements, or team highlights
- Engagement with industry trends or current events
- Articles or content they've authored or been featured in

If no recent LinkedIn activity is available, focus on:
- LinkedIn company profile information and description
- Team member profiles and their professional backgrounds
- Company's stated mission, values, or industry focus
- Services or solutions they highlight on their profile
- Professional networks or industry connections
- Any historical content or company updates available

# Output Format
Company Overview: [Brief description of what they do]
Recent LinkedIn Activity: [Specific recent post/insight OR key information from their LinkedIn profile]
Thought Leadership: [Their expressed perspective OR their professional focus and expertise areas]
Summary: [1 sentence about their current focus based on content OR their professional positioning and industry expertise]`,

      'custom': 'Custom research strategy - no predefined perplexity prompt.'
    };

    return prompts[strategyId] || prompts['custom'];
  };



  const handlePreview = () => {
    const selectedStrategy = presetStrategies.find(s => s.id === formData.personalizationStrategy);
    const promptToShow = formData.personalizationStrategy === 'custom'
      ? formData.customPrompt
      : selectedStrategy?.prompt || '';

    const example = getExampleOutput(formData.personalizationStrategy);
    const exampleText = `Instead of: "${example.instead}"\n\nWrite: "${example.write}"`;

    // Initialize with existing saved values or defaults
    setPreviewPrompt(promptToShow);
    setEditedPrompt(promptToShow);
    setExampleOutput(formData.customExample || exampleText);
    setTaskContent(formData.customTask || 'Create a personalized icebreaker sentence based on the provided company information. This will be the opening line of a cold outreach email.');
    setGuidelinesContent(formData.customGuidelines || '• Use a conversational tone that sounds human and natural\n• Keep it short — maximum 25 words\n• Write at a grade 6 reading level using simple language\n• Do not use em dashes (—) or complex punctuation\n• Only write in English\n• Do not ask questions or request meetings\n• Do not guess, exaggerate, or invent information — only use the data provided\n• Paraphrase information rather than copying sentences directly');
    setIsPreviewModalOpen(true);
  };

  const handleSavePrompt = () => {
    setFormData(prev => ({
      ...prev,
      customPrompt: editedPrompt,
      customTask: taskContent,
      customGuidelines: guidelinesContent,
      customExample: exampleOutput
    }));

    setIsPreviewModalOpen(false);
    toast({
      title: "Success",
      description: "Custom instructions saved successfully!",
    });
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
          personalization_strategy: isPowerUserMode ? formData.personalizationStrategy : null,
          custom_prompt: isPowerUserMode && formData.personalizationStrategy === 'custom' ? formData.customPrompt : null,
          instantly_campaign_id: formData.sendToInstantly ? formData.campaignId : null,
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
      
      // Add personalization strategy and prompts for all users
      const defaultTask = 'Create a personalized icebreaker sentence based on the provided company information. This will be the opening line of a cold outreach email.';
      const defaultGuidelines = '• Use a conversational tone that sounds human and natural\n• Keep it short — maximum 25 words\n• Write at a grade 6 reading level using simple language\n• Do not use em dashes (—) or complex punctuation\n• Only write in English\n• Do not ask questions or request meetings\n• Do not guess, exaggerate, or invent information — only use the data provided\n• Paraphrase information rather than copying sentences directly';

      if (isPowerUserMode) {
        // Power user logic
        if (formData.personalizationStrategy === 'custom') {
          submissionData.append('personalizationPrompt', formData.customPrompt);
        } else {
          const selectedStrategy = presetStrategies.find(s => s.id === formData.personalizationStrategy);
          submissionData.append('personalizationPrompt', selectedStrategy?.prompt || '');
        }
        submissionData.append('personalizationStrategy', formData.personalizationStrategy);

        // For custom strategy, use saved values or defaults; for preset strategies, always use defaults
        const taskToSend = formData.personalizationStrategy === 'custom'
          ? (formData.customTask || defaultTask)
          : defaultTask;
        const guidelinesToSend = formData.personalizationStrategy === 'custom'
          ? (formData.customGuidelines || defaultGuidelines)
          : defaultGuidelines;

        // Example always uses saved value or generates from strategy
        const example = getExampleOutput(formData.personalizationStrategy);
        const defaultExample = `Instead of: "${example.instead}"\n\nWrite: "${example.write}"`;
        const exampleToSend = formData.customExample || defaultExample;

        submissionData.append('promptTask', taskToSend);
        submissionData.append('promptGuidelines', guidelinesToSend);
        submissionData.append('promptExample', exampleToSend);
        submissionData.append('customInstructions', formData.customPrompt || '');

        // Add perplexity research prompt based on selected strategy
        const perplexityPrompt = getPerplexityPrompt(formData.personalizationStrategy);
        submissionData.append('perplexityPrompt', perplexityPrompt);

        submissionData.append('isPowerUser', 'true');
      } else {
        // Non-power user defaults
        submissionData.append('personalizationPrompt', 'Focus on complimenting their services, achievements, or notable business aspects using simple language. If achievement data isn\'t available: Use research information to comment on their service quality, business approach, or industry expertise in simple terms');
        submissionData.append('personalizationStrategy', 'company-achievements');
        submissionData.append('promptTask', defaultTask);
        submissionData.append('promptGuidelines', defaultGuidelines);
        submissionData.append('promptExample', 'Instead of: "I appreciate how Heaven\'s Pets combines heartfelt, personalized pet cremation services with thoughtful keepsakes, truly honoring each pet\'s unique memory."\n\nWrite: "I like how Heaven\'s Pets gives loving pet cremation services and keepsakes that honor each pet."');

        // Use company achievements perplexity prompt for non-power users
        const perplexityPrompt = getPerplexityPrompt('company-achievements');
        submissionData.append('perplexityPrompt', perplexityPrompt);

        submissionData.append('isPowerUser', 'false');
      }
      
      if (formData.leadSource === 'apollo') {
        submissionData.append('apolloUrl', formData.apolloUrl);
        submissionData.append('leadCount', formData.leadCount.toString());

      } else if (formData.leadSource === 'csv' && formData.csvFile) {
        submissionData.append('csvFile', formData.csvFile);
      }
      
      submissionData.append('sendToInstantly', formData.sendToInstantly.toString());
      
      if (formData.sendToInstantly) {
        submissionData.append('campaignId', formData.campaignId);
      }
      
      // Add demo flag
      if (formData.isDemo) {
        submissionData.append('demo', 'true');
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
        sendToInstantly: formData.sendToInstantly,
        perplexityPrompt: '',
        promptTask: '',
        personalizationPrompt: '',
        promptExample: ''
      };

      // Add personalization strategy and prompts
      if (isPowerUserMode) {
        if (formData.personalizationStrategy === 'custom') {
          webhookPayload.personalizationPrompt = formData.customPrompt;
          webhookPayload.customTask = formData.customTask;
          webhookPayload.customGuidelines = formData.customGuidelines;
        } else {
          const selectedStrategy = presetStrategies.find(s => s.id === formData.personalizationStrategy);
          webhookPayload.personalizationPrompt = selectedStrategy?.prompt || '';
        }
        webhookPayload.personalizationStrategy = formData.personalizationStrategy;

        // Add the same prompt values that are sent to FormData
        const taskToSend = formData.personalizationStrategy === 'custom'
          ? (formData.customTask || defaultTask)
          : defaultTask;
        const guidelinesToSend = formData.personalizationStrategy === 'custom'
          ? (formData.customGuidelines || defaultGuidelines)
          : defaultGuidelines;
        const example = getExampleOutput(formData.personalizationStrategy);
        const defaultExample = `Instead of: "${example.instead}"\n\nWrite: "${example.write}"`;
        const exampleToSend = formData.customExample || defaultExample;
        const perplexityPrompt = getPerplexityPrompt(formData.personalizationStrategy);

        webhookPayload.promptTask = taskToSend;
        webhookPayload.promptGuidelines = guidelinesToSend;
        webhookPayload.promptExample = exampleToSend;
        webhookPayload.perplexityPrompt = perplexityPrompt;
      } else {
        webhookPayload.personalizationTask = defaultTask;
        webhookPayload.personalizationGuidelines = defaultGuidelines;
        webhookPayload.promptTask = defaultTask;
        webhookPayload.promptGuidelines = defaultGuidelines;
        webhookPayload.personalizationPrompt = 'Focus on complimenting their services, achievements, or notable business aspects using simple language. If achievement data isn\'t available: Use research information to comment on their service quality, business approach, or industry expertise in simple terms';

        // Match exact values sent to webhook for non-power users
        const defaultExample = 'Instead of: "I appreciate how Heaven\'s Pets combines heartfelt, personalized pet cremation services with thoughtful keepsakes, truly honoring each pet\'s unique memory."\n\nWrite: "I like how Heaven\'s Pets gives loving pet cremation services and keepsakes that honor each pet."';
        const perplexityPrompt = getPerplexityPrompt('company-achievements');
        webhookPayload.promptExample = defaultExample;
        webhookPayload.perplexityPrompt = perplexityPrompt;
      }

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

      if (formData.sendToInstantly) {
        webhookPayload.campaignId = formData.campaignId;
      }

      if (formData.isDemo) {
        webhookPayload.demo = true;
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
        description: isPowerUserMode 
          ? "Your enhanced lead enrichment has been submitted successfully."
          : "Your lead enrichment has been submitted successfully.",
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
    if (formData.sendToInstantly && !formData.campaignId) return false;
    if (isPowerUserMode && formData.personalizationStrategy === 'custom' && !formData.customPrompt) return false;
    return true;
  };

  return (
    <div className="min-h-screen">
      <Navigation />
      
      <div className="flex items-center justify-center p-4 pt-20">
        {/* Power User Mode Toggle */}
        <div className="fixed top-20 left-4 z-50">
          <Card className="bg-card/90 backdrop-blur-sm border-border/50 shadow-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-muted-foreground" />
                  <Label htmlFor="power-user-toggle" className="text-sm font-medium">
                    Power User Mode
                  </Label>
                </div>
                <Switch
                  id="power-user-toggle"
                  checked={isPowerUserMode}
                  onCheckedChange={setIsPowerUserMode}
                  className="data-[state=checked]:bg-purple-500"
                />
              </div>
              {isPowerUserMode && (
                <div className="flex items-center gap-2 mt-2">
                  <Zap className="w-3 h-3 text-purple-400" />
                  <span className="text-xs text-purple-400 font-medium">Active</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
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
                {isPowerUserMode && (
                  <Badge className="ml-2 bg-purple-500/20 text-purple-300 border-purple-500/30">
                    <Zap className="w-3 h-3 mr-1" />
                    Power Mode
                  </Badge>
                )}
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
                          <div>• Linkedin URL</div>
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
                    className={`border border-border rounded-lg p-6 bg-input transition-colors ${
                      isDragOver ? 'border-primary bg-primary/10' : 'border-border'
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <div className="flex items-center justify-center">
                      <div className="text-center">
                        <Upload className={`mx-auto h-8 w-8 mb-2 ${isDragOver ? 'text-primary' : 'text-muted-foreground'}`} />
                        <Label htmlFor="csvFile" className="cursor-pointer">
                          <span className={`text-sm ${isDragOver ? 'text-primary' : 'text-muted-foreground'}`}>
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
                          <p className="text-sm text-primary mt-2">
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

              {/* Send to Instantly Option */}
              <div className="space-y-3">
                <Label className="text-foreground font-medium">
                  Output Options
                </Label>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="sendToInstantly"
                      checked={formData.sendToInstantly}
                      onCheckedChange={(checked) => 
                        setFormData(prev => ({ ...prev, sendToInstantly: !!checked }))
                      }
                    />
                    <Label htmlFor="sendToInstantly" className="text-sm text-foreground">
                      Send to Instantly Campaign (Optional)
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="isDemo"
                      checked={formData.isDemo}
                      onCheckedChange={(checked) => 
                        setFormData(prev => ({ ...prev, isDemo: !!checked }))
                      }
                    />
                    <Label htmlFor="isDemo" className="text-sm text-foreground">
                      Demo Mode
                    </Label>
                  </div>

                  {formData.sendToInstantly && (
                    <div className="ml-6 space-y-3">
                      <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                          <div className="text-sm text-blue-600 dark:text-blue-400">
                            <span className="font-medium">Instantly Integration Limit:</span> A maximum of 500 leads can be sent to Instantly for each campaign. If you have more than 500 leads, the remaining leads can be added manually by exporting the CSV from your campaign in AGA.
                          </div>
                        </div>
                      </div>
                      
                      <Label htmlFor="campaignId" className="text-foreground font-medium">
                        Instantly Campaign ID
                      </Label>
                      <Input
                        id="campaignId"
                        type="text"
                        placeholder="Enter Instantly Campaign ID"
                        value={formData.campaignId}
                        onChange={(e) => setFormData(prev => ({ ...prev, campaignId: e.target.value }))}
                        className="bg-input border-border"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Power User Options */}
              {isPowerUserMode && (
                <Card className="p-6 bg-muted/20 border-primary/20">
                  <CardHeader className="p-0 mb-4">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Zap className="h-5 w-5 text-purple-400" />
                      Personalization Output Options
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-2">
                      Choose what you want to mention in your outreach messages
                    </p>
                    <Separator className="mt-3" />
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="space-y-4">
                      <RadioGroup
                        value={formData.personalizationStrategy}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, personalizationStrategy: value }))}
                        className="space-y-3"
                      >
                        {presetStrategies.map((strategy) => {
                          const IconComponent = strategy.icon;
                          return (
                            <div key={strategy.id} className="flex items-start space-x-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                              <RadioGroupItem value={strategy.id} id={strategy.id} className="mt-1" />
                              <div className="flex-1">
                                <Label htmlFor={strategy.id} className="flex items-center gap-2 font-medium cursor-pointer">
                                  <IconComponent className="h-4 w-4 text-primary" />
                                  {strategy.name}
                                </Label>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {strategy.description}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                        
                        <div className="flex items-start space-x-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                          <RadioGroupItem value="custom" id="custom" className="mt-1" />
                          <div className="flex-1">
                            <Label htmlFor="custom" className="flex items-center gap-2 font-medium cursor-pointer">
                              <FileText className="h-4 w-4 text-primary" />
                              Custom Strategy
                            </Label>
                            <p className="text-sm text-muted-foreground mt-1">
                              Define your own personalization approach
                            </p>
                          </div>
                        </div>
                      </RadioGroup>

                      {formData.personalizationStrategy === 'custom' && (
                        <div className="space-y-3">
                          <Label htmlFor="customPrompt" className="text-foreground font-medium">
                            Custom Personalization Prompt
                          </Label>
                          <Textarea
                            id="customPrompt"
                            placeholder="Describe how you want the AI to personalize each message..."
                            value={formData.customPrompt}
                            onChange={(e) => setFormData(prev => ({ ...prev, customPrompt: e.target.value }))}
                            className="bg-input border-border min-h-[100px]"
                          />
                        </div>
                      )}

                      <Button
                        type="button"
                        variant="outline"
                        onClick={handlePreview}
                        className="flex items-center gap-2"
                      >
                        <Eye className="h-4 w-4" />
                        Preview Strategy
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Submit Button */}
              <Button 
                type="submit" 
                className="w-full bg-gradient-primary hover:opacity-90 transition-opacity py-6 text-lg"
                disabled={!isFormValid() || isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    In Queue
                  </>
                ) : (
                  <>
                    <Target className="w-5 h-5 mr-2" />
                    {isPowerUserMode ? 'Enrich Leads' : 'Enrich Leads'}
                  </>
                )}
              </Button>
            </form>
          </Card>
        </div>
        </div>
      </div>

      {/* Strategy Preview Modal */}
      <Dialog open={isPreviewModalOpen} onOpenChange={setIsPreviewModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Strategy Preview
            </DialogTitle>
            <DialogDescription>
              Review the personalization structure and customize the instructions for your outreach strategy.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Task Box - Conditional Editing */}
            <div className={`border rounded-lg p-4 ${
              formData.personalizationStrategy === 'custom'
                ? 'border-2 border-purple-200 shadow-md shadow-purple-100/30'
                : 'bg-muted/20 cursor-not-allowed'
            }`}>
              <Label className="text-sm font-medium text-foreground">
                Task
              </Label>
              {formData.personalizationStrategy === 'custom' ? (
                <Textarea
                  value={taskContent}
                  onChange={(e) => setTaskContent(e.target.value)}
                  className="mt-2 min-h-[80px] resize-none border-purple-200 focus:border-purple-400 focus:ring-purple-200"
                  placeholder="Define the main task..."
                />
              ) : (
                <div className="mt-2 p-3 bg-muted/10 rounded border border-muted text-sm text-muted-foreground cursor-not-allowed">
                  {taskContent}
                </div>
              )}
            </div>

            {/* Custom Instructions Box - Editable */}
            <div className="border-2 border-purple-200 rounded-lg p-4 shadow-md shadow-purple-100/30">
              <Label htmlFor="custom-instructions" className="text-sm font-medium text-foreground">
                Custom Instructions
              </Label>
              <Textarea
                id="custom-instructions"
                value={editedPrompt}
                onChange={(e) => setEditedPrompt(e.target.value)}
                className="mt-2 min-h-[120px] resize-none border-purple-200 focus:border-purple-400 focus:ring-purple-200"
                placeholder="Enter specific instructions for personalization..."
              />
              <p className="text-xs text-muted-foreground mt-2">
                Customize how the AI should personalize your outreach based on the research data.
              </p>
            </div>

            {/* Guidelines Box - Conditional Editing */}
            <div className={`border rounded-lg p-4 ${
              formData.personalizationStrategy === 'custom'
                ? 'border-2 border-purple-200 shadow-md shadow-purple-100/30'
                : 'bg-muted/20 cursor-not-allowed'
            }`}>
              <Label className="text-sm font-medium text-foreground">
                Guidelines
              </Label>
              {formData.personalizationStrategy === 'custom' ? (
                <Textarea
                  value={guidelinesContent}
                  onChange={(e) => setGuidelinesContent(e.target.value)}
                  className="mt-2 min-h-[150px] resize-none border-purple-200 focus:border-purple-400 focus:ring-purple-200"
                  placeholder="Enter guidelines (one per line with • bullets)..."
                />
              ) : (
                <div className="mt-2 p-3 bg-muted/10 rounded border border-muted text-sm text-muted-foreground cursor-not-allowed">
                  <ul className="space-y-1">
                    <li>• Use a conversational tone that sounds human and natural</li>
                    <li>• Keep it short — maximum 25 words</li>
                    <li>• Write at a grade 6 reading level using simple language</li>
                    <li>• Do not use em dashes (—) or complex punctuation</li>
                    <li>• Only write in English</li>
                    <li>• Do not ask questions or request meetings</li>
                    <li>• Do not guess, exaggerate, or invent information — only use the data provided</li>
                    <li>• Paraphrase information rather than copying sentences directly</li>
                  </ul>
                </div>
              )}
            </div>

            {/* Example Output Box - Editable */}
            <div className="border-2 border-purple-200 rounded-lg p-4 shadow-md shadow-purple-100/30">
              <Label htmlFor="example-output" className="text-sm font-medium text-foreground">
                Example Output
              </Label>
              <Textarea
                id="example-output"
                value={exampleOutput}
                onChange={(e) => setExampleOutput(e.target.value)}
                className="mt-2 min-h-[120px] resize-none border-purple-200 focus:border-purple-400 focus:ring-purple-200"
                placeholder="Example of good vs. bad output will appear here..."
              />
              <p className="text-xs text-muted-foreground mt-2">
                Review the example to understand the expected output format and style.
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setIsPreviewModalOpen(false)}
              >
                <X className="w-4 h-4 mr-2" />
                Close
              </Button>
              <Button onClick={handleSavePrompt}>
                <Save className="w-4 h-4 mr-2" />
                Save Instructions
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
