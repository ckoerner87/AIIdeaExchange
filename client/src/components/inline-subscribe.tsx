import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, Check } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { InsertSubscription } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export default function InlineSubscribe() {
  const [email, setEmail] = useState("");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const { toast } = useToast();

  const subscribeMutation = useMutation({
    mutationFn: async (data: InsertSubscription) => {
      return apiRequest("POST", "/api/subscribe", { ...data, source: 'inline' });
    },
    onSuccess: () => {
      setIsSubscribed(true);
      setEmail("");
      toast({
        title: "Subscribed!",
        description: "You'll receive the week's best AI ideas in your inbox.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Subscription failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    
    subscribeMutation.mutate({ email: email.trim() });
  };

  if (isSubscribed) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6 mx-4 my-6">
        <div className="flex items-center justify-center space-x-2 text-green-700">
          <Check className="w-5 h-5" />
          <span className="font-medium">Thanks for subscribing!</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mx-4 my-6">
      <div className="text-center">
        <div className="flex items-center justify-center space-x-2 mb-3">
          <Mail className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-blue-900">
            Get the week's best ideas
          </h3>
        </div>
        <p className="text-blue-700 mb-4 text-sm">
          Subscribe to receive the most genius AI use cases in your inbox. No spam, no ads, no cost.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 items-center justify-center max-w-md mx-auto">
          <Input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 bg-white border-blue-300 focus:border-blue-500"
            required
          />
          <Button
            type="submit"
            disabled={subscribeMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700 px-6"
          >
            {subscribeMutation.isPending ? "Subscribing..." : "Subscribe"}
          </Button>
        </form>
      </div>
    </div>
  );
}