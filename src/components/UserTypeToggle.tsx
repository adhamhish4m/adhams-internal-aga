import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { User, Zap } from 'lucide-react';

interface UserTypeToggleProps {
  isPowerUser: boolean;
  onToggle: (isPowerUser: boolean) => void;
}

export function UserTypeToggle({ isPowerUser, onToggle }: UserTypeToggleProps) {
  return (
    <div className="fixed top-20 right-4 z-50">
      <div className="flex items-center gap-3 bg-card/80 backdrop-blur-sm border border-border rounded-lg px-4 py-2 shadow-card">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-muted-foreground" />
          <Label className="text-sm text-foreground">Standard</Label>
        </div>
        <Switch
          checked={isPowerUser}
          onCheckedChange={onToggle}
          className="data-[state=checked]:bg-primary"
        />
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          <Label className="text-sm text-foreground font-medium">Power User</Label>
        </div>
      </div>
    </div>
  );
}