import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Eye, Briefcase, Trophy, Users, FileText, MessageSquare } from 'lucide-react';

export interface PersonalizationStrategy {
  id: string;
  name: string;
  description: string;
  prompt: string;
  icon: React.ComponentType<{ className?: string }>;
}

const presetStrategies: PersonalizationStrategy[] = [
  {
    id: 'website-case-study',
    name: 'Website Case Study Focus',
    description: 'Personalize based on recent case studies and success stories',
    prompt: 'Analyze the prospect\'s company website for recent case studies, success stories, or client testimonials. Reference a specific case study or achievement that relates to how our solution could provide similar results for their business.',
    icon: Eye,
  },
  {
    id: 'company-achievements',
    name: 'Company Achievements',
    description: 'Reference recent company milestones and news',
    prompt: 'Research recent company news, press releases, funding rounds, new partnerships, or major milestones. Congratulate them on specific achievements and connect how our solution can support their continued growth.',
    icon: Trophy,
  },
  {
    id: 'linkedin-engagement',
    name: 'LinkedIn Post Engagement',
    description: 'Mention prospect\'s recent LinkedIn activity',
    prompt: 'Review the prospect\'s recent LinkedIn posts, articles, or comments. Reference a specific post or topic they\'ve discussed that relates to our solution, showing genuine interest in their professional insights.',
    icon: MessageSquare,
  },
  {
    id: 'job-openings',
    name: 'Job Openings Analysis',
    description: 'Reference relevant job postings by the company',
    prompt: 'Analyze current job openings at the prospect\'s company. Reference specific roles they\'re hiring for that indicate growth areas where our solution could provide immediate value and support their scaling efforts.',
    icon: Users,
  },
];

interface PowerUserOptionsProps {
  selectedStrategy: string;
  customPrompt: string;
  onStrategyChange: (strategy: string) => void;
  onCustomPromptChange: (prompt: string) => void;
  onPreview: () => void;
}

export function PowerUserOptions({ 
  selectedStrategy, 
  customPrompt, 
  onStrategyChange, 
  onCustomPromptChange,
  onPreview 
}: PowerUserOptionsProps) {
  return (
    <Card className="bg-gradient-surface border-primary/20 shadow-elevated">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-primary">
          <Briefcase className="w-5 h-5" />
          Power User Personalization
        </CardTitle>
        <p className="text-muted-foreground text-sm">
          Choose your AI personalization strategy for maximum conversion
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <RadioGroup 
          value={selectedStrategy} 
          onValueChange={onStrategyChange}
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
            
            {selectedStrategy === 'custom' && (
              <div className="pl-7">
                <Textarea
                  placeholder="Write your custom Claude AI prompt for lead personalization..."
                  value={customPrompt}
                  onChange={(e) => onCustomPromptChange(e.target.value)}
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
            onClick={onPreview}
            className="flex items-center gap-2"
            disabled={!selectedStrategy}
          >
            <Eye className="w-4 h-4" />
            Preview AI Message
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export { presetStrategies };