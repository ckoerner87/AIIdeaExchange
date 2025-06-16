import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, EyeOff, Mail, User, Lock } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface AccountCreationPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AccountCreationPopup({ isOpen, onClose }: AccountCreationPopupProps) {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: ""
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const usernameRef = useRef<HTMLInputElement>(null);

  // Focus first input when dialog opens
  useEffect(() => {
    if (isOpen && usernameRef.current) {
      setTimeout(() => {
        usernameRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  const createAccountMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: data.username,
          email: data.email,
          password: data.password
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create account");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Account Created!",
        description: "Your account has been created successfully. Please sign in.",
      });
      onClose();
      setFormData({ username: "", email: "", password: "", confirmPassword: "" });
      // Redirect to login
      window.location.href = "/api/login";
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create account",
        variant: "destructive",
      });
    },
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to send reset email");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Email Sent",
        description: "Password reset instructions have been sent to your email.",
      });
      setShowForgotPassword(false);
      setForgotEmail("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send reset email",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username.trim() || !formData.email.trim() || !formData.password.trim() || !formData.confirmPassword.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }
    createAccountMutation.mutate({
      username: formData.username,
      email: formData.email,
      password: formData.password,
      confirmPassword: formData.confirmPassword
    });
  };

  const handleForgotPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      toast({
        title: "Error",
        description: "Please enter your email address",
        variant: "destructive",
      });
      return;
    }
    forgotPasswordMutation.mutate(forgotEmail);
  };

  if (showForgotPassword) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Reset Password</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="forgotEmail">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="forgotEmail"
                  type="email"
                  placeholder="Enter your email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForgotPassword(false)}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                type="submit"
                disabled={forgotPasswordMutation.isPending}
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                {forgotPasswordMutation.isPending ? "Sending..." : "Send Reset Email"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    );
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose}></div>
      <div className="relative bg-white rounded-lg shadow-lg p-6 w-full max-w-md mx-4 z-60">
        <button 
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
        <div className="text-center mb-6">
          <h2 className="text-xl font-semibold">Join the community</h2>
          <p className="text-sm text-gray-600 mt-2">Create an account to start sharing and discovering AI use cases</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username">Username</label>
            <input
              ref={usernameRef}
              type="text"
              name="username"
              className="border p-2 w-full"
              placeholder="Choose a username"
              onChange={(e) => {
                console.log('Username changed:', e.target.value);
                setFormData(prev => ({ ...prev, username: e.target.value }));
              }}
              onKeyDown={(e) => {
                console.log('Username keydown:', e.key);
              }}
              onFocus={() => console.log('Username focused')}
              onBlur={() => console.log('Username blurred')}
            />
          </div>
          
          <div>
            <label htmlFor="email">Email</label>
            <input
              type="email"
              name="email"
              className="border p-2 w-full"
              placeholder="Enter your email"
              onChange={(e) => {
                console.log('Email changed:', e.target.value);
                setFormData(prev => ({ ...prev, email: e.target.value }));
              }}
              onKeyDown={(e) => {
                console.log('Email keydown:', e.key);
              }}
              onFocus={() => console.log('Email focused')}
              onBlur={() => console.log('Email blurred')}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Create a password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="pl-10 pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="pl-10 pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          
          <button
            type="submit"
            disabled={createAccountMutation.isPending}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md font-medium"
          >
            {createAccountMutation.isPending ? "Creating Account..." : "Create account"}
          </button>
          
          <div className="text-center">
            <button
              type="button"
              onClick={() => window.location.href = '/auth'}
              className="text-sm text-blue-600 hover:text-blue-700 underline"
            >
              Already have an account? Sign in
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}