import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Database, ExternalLink, CheckCircle, AlertTriangle, Code, Zap } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function DatabaseSetupInstructions() {
  const [step, setStep] = useState(1);
  const [completed, setCompleted] = useState<number[]>([]);

  const markStepComplete = (stepNumber: number) => {
    if (!completed.includes(stepNumber)) {
      setCompleted([...completed, stepNumber]);
    }
    if (stepNumber < 4) {
      setStep(stepNumber + 1);
    }
  };

  const isStepCompleted = (stepNumber: number) => completed.includes(stepNumber);

  const sqlCode = `-- Run this in Supabase SQL Editor
CREATE TABLE IF NOT EXISTS tokens (
  token_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_value VARCHAR(255) UNIQUE NOT NULL,
  client_id VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  usage_count INTEGER DEFAULT 0,
  usage_limit INTEGER,
  active_status BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'processing',
  user_id VARCHAR(100) NOT NULL,
  source VARCHAR(100),
  instantly_campaign_id VARCHAR(255),
  personalization_strategy VARCHAR(100),
  custom_prompt TEXT,
  lead_count INTEGER DEFAULT 0,
  completed_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS campaign_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  lead_data JSONB NOT NULL,
  personalized_message TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tokens_value ON tokens(token_value);
CREATE INDEX IF NOT EXISTS idx_campaigns_user ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_campaign ON campaign_leads(campaign_id);

-- Sample tokens
INSERT INTO tokens (token_value, client_id, expires_at, usage_limit) VALUES
('demo-token-thirteen-ai', 'mateusz', NOW() + INTERVAL '1 year', 1000)
ON CONFLICT (token_value) DO NOTHING;`;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center mb-8">
        <h1 className="font-clash text-3xl font-bold text-thirteen-purple mb-2">
          THIRTEEN AI
        </h1>
        <h2 className="text-2xl font-bold text-foreground mb-2">Database Setup Required</h2>
        <p className="text-muted-foreground">
          Complete these steps to unlock all enhanced features
        </p>
      </div>

      {/* Progress */}
      <div className="flex items-center justify-center space-x-2 mb-8">
        {[1, 2, 3, 4].map((stepNum) => (
          <div key={stepNum} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              isStepCompleted(stepNum) 
                ? 'bg-success text-success-foreground' 
                : step === stepNum 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted text-muted-foreground'
            }`}>
              {isStepCompleted(stepNum) ? <CheckCircle className="w-4 h-4" /> : stepNum}
            </div>
            {stepNum < 4 && (
              <div className={`w-8 h-1 mx-2 ${
                isStepCompleted(stepNum) ? 'bg-success' : 'bg-muted'
              }`} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: SQL Setup */}
      <Card className={`bg-gradient-surface border-border shadow-card ${
        step === 1 ? 'border-primary ring-2 ring-primary/20' : ''
      }`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Step 1: Create Database Tables
            {isStepCompleted(1) && <Badge className="bg-success/20 text-success">Completed</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Go to your Supabase Dashboard → SQL Editor and run this SQL:
            </AlertDescription>
          </Alert>
          
          <div className="bg-muted/30 p-4 rounded-lg">
            <pre className="text-xs overflow-x-auto">
              <code>{sqlCode}</code>
            </pre>
          </div>
          
          <div className="flex gap-2">
            <Button
              onClick={() => markStepComplete(1)}
              disabled={isStepCompleted(1)}
              className="flex items-center gap-2"
            >
              {isStepCompleted(1) ? <CheckCircle className="w-4 h-4" /> : <Database className="w-4 h-4" />}
              {isStepCompleted(1) ? 'SQL Executed' : 'Mark as Complete'}
            </Button>
            <Button variant="outline" asChild>
              <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer">
                Open Supabase Dashboard <ExternalLink className="w-4 h-4 ml-2" />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Regenerate Types */}
      <Card className={`bg-gradient-surface border-border shadow-card ${
        step === 2 ? 'border-primary ring-2 ring-primary/20' : ''
      }`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="w-5 h-5" />
            Step 2: Regenerate TypeScript Types
            {isStepCompleted(2) && <Badge className="bg-success/20 text-success">Completed</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            After creating the tables, regenerate your Supabase TypeScript types:
          </p>
          
          <div className="bg-muted/30 p-4 rounded-lg">
            <code className="text-sm">
              Go to Supabase Dashboard → Settings → API → Generate Types
            </code>
          </div>
          
          <Button
            onClick={() => markStepComplete(2)}
            disabled={isStepCompleted(2) || !isStepCompleted(1)}
            className="flex items-center gap-2"
          >
            {isStepCompleted(2) ? <CheckCircle className="w-4 h-4" /> : <Code className="w-4 h-4" />}
            {isStepCompleted(2) ? 'Types Updated' : 'Mark as Complete'}
          </Button>
        </CardContent>
      </Card>

      {/* Step 3: Enable Enhanced Components */}
      <Card className={`bg-gradient-surface border-border shadow-card ${
        step === 3 ? 'border-primary ring-2 ring-primary/20' : ''
      }`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Step 3: Enable Enhanced Features
            {isStepCompleted(3) && <Badge className="bg-success/20 text-success">Completed</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Once types are updated, I'll enable the enhanced components with:
          </p>
          
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Token-based authentication</li>
            <li>Full campaign management</li>
            <li>Individual lead tracking</li>
            <li>Enhanced CSV export</li>
            <li>Real-time updates</li>
          </ul>
          
          <Button
            onClick={() => markStepComplete(3)}
            disabled={isStepCompleted(3) || !isStepCompleted(2)}
            className="flex items-center gap-2"
          >
            {isStepCompleted(3) ? <CheckCircle className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
            {isStepCompleted(3) ? 'Features Enabled' : 'Enable Enhanced Features'}
          </Button>
        </CardContent>
      </Card>

      {/* Step 4: Complete */}
      <Card className={`bg-gradient-surface border-border shadow-card ${
        step === 4 ? 'border-success ring-2 ring-success/20' : ''
      }`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-success">
            <CheckCircle className="w-5 h-5" />
            Step 4: All Features Active!
            {isStepCompleted(4) && <Badge className="bg-success/20 text-success">Ready</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {completed.length === 3 ? (
            <div className="text-center py-4">
              <CheckCircle className="w-16 h-16 mx-auto mb-4 text-success" />
              <h3 className="text-xl font-bold text-success mb-2">Setup Complete!</h3>
              <p className="text-muted-foreground mb-4">
                All enhanced features are now active. You can now use:
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside mb-4">
                <li>Token authentication system</li>
                <li>Enhanced personalization strategies</li>
                <li>Full campaign management</li>
                <li>Real-time lead tracking</li>
                <li>Complete CSV exports</li>
              </ul>
              <Button
                onClick={() => window.location.href = '/'}
                className="bg-success hover:bg-success/90"
              >
                Launch Enhanced System
              </Button>
            </div>
          ) : (
            <p className="text-muted-foreground">
              Complete the previous steps to unlock all features.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}