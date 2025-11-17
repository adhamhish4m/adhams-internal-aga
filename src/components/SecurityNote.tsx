import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle, ExternalLink } from 'lucide-react';

export function SecurityNote() {
  return (
    <div className="space-y-4">
      <Alert className="border-green-500/20 bg-green-500/10">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800 dark:text-green-200">
          <strong>Security Enhanced!</strong> Your application has been hardened with:
          <ul className="mt-2 list-disc list-inside space-y-1">
            <li>Row Level Security (RLS) on all sensitive tables</li>
            <li>Secure token management with proper access controls</li>
            <li>Admin-only privilege escalation via secure RPC functions</li>
            <li>User ownership enforcement through database triggers</li>
          </ul>
        </AlertDescription>
      </Alert>

      <Alert className="border-amber-500/20 bg-amber-500/10">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800 dark:text-amber-200">
          <strong>Next Steps Required:</strong>
          <ol className="mt-2 list-decimal list-inside space-y-1">
            <li>Regenerate Supabase types to include new tables and functions</li>
            <li>Add your user ID to the admin role in user_roles table</li>
            <li>Enable "Leaked password protection" in Supabase Auth settings</li>
            <li>Remove any remaining client-side privilege checks</li>
          </ol>
        </AlertDescription>
      </Alert>
    </div>
  );
}