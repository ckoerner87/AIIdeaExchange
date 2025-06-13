import { useState } from 'react';
import { X, User, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

interface UsernameCollectionPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onUsernameSubmit: (username: string) => void;
  onAccountCreate?: (data: { username: string; email: string; password: string }) => void;
}

export function UsernameCollectionPopup({ 
  isOpen, 
  onClose, 
  onUsernameSubmit,
  onAccountCreate 
}: UsernameCollectionPopupProps) {
  const [step, setStep] = useState<'username' | 'account'>('username');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  if (!isOpen) return null;

  const handleUsernameSubmit = async () => {
    if (!username.trim()) {
      toast({
        title: "Username required",
        description: "Please enter a username",
        variant: "destructive"
      });
      return;
    }

    if (username.length < 2) {
      toast({
        title: "Username too short",
        description: "Username must be at least 2 characters",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Check if username is already taken by an existing account
      const response = await fetch(`/api/check-username/${encodeURIComponent(username.trim())}`);
      if (!response.ok) {
        throw new Error('Failed to check username availability');
      }
      
      const data = await response.json();
      if (!data.available) {
        toast({
          title: "Username taken",
          description: "This username is already taken by an existing account. Please choose a different one.",
          variant: "destructive"
        });
        setIsSubmitting(false);
        return;
      }

      onUsernameSubmit(username.trim());
      setStep('account');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to validate username. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAccountCreate = async () => {
    if (!email.trim() || !password.trim()) {
      toast({
        title: "All fields required",
        description: "Please fill in email and password",
        variant: "destructive"
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters",
        variant: "destructive"
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      if (onAccountCreate) {
        await onAccountCreate({ username, email, password });
      }
      onClose();
    } catch (error) {
      console.error('Account creation error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkipAccount = () => {
    onClose();
  };

  const resetAndClose = () => {
    setStep('username');
    setUsername('');
    setEmail('');
    setPassword('');
    setShowPassword(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6 relative">
        {/* Close button */}
        <button
          onClick={resetAndClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {step === 'username' ? (
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                What should we call you?
              </h2>
              <p className="text-sm text-gray-600">
                Choose a username to display with your comments
              </p>
            </div>

            <div className="space-y-3">
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  type="text"
                  placeholder="Your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-10"
                  maxLength={50}
                  onKeyPress={(e) => e.key === 'Enter' && handleUsernameSubmit()}
                  autoFocus
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={resetAndClose}
                className="flex-1"
              >
                Skip
              </Button>
              <Button
                onClick={handleUsernameSubmit}
                disabled={!username.trim()}
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                Continue
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Create an account to get notified?
              </h2>
              <p className="text-sm text-gray-600">
                Get email alerts when someone replies to your comments
              </p>
            </div>

            <div className="space-y-3">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  type="email"
                  placeholder="Your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  autoFocus
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Create password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  onKeyPress={(e) => e.key === 'Enter' && handleAccountCreate()}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleSkipAccount}
                className="flex-1"
              >
                Skip
              </Button>
              <Button
                onClick={handleAccountCreate}
                disabled={isSubmitting}
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Continue'
                )}
              </Button>
            </div>

            <p className="text-xs text-gray-500 text-center">
              You can always create an account later from any comment
            </p>
          </div>
        )}
      </div>
    </div>
  );
}