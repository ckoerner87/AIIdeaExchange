import { Button } from "@/components/ui/button";
import { Mail, ExternalLink } from "lucide-react";

interface SubscriptionFormProps {
  subscriberCount: number;
}

export default function SubscriptionForm({ subscriberCount }: SubscriptionFormProps) {
  const handleSubscribe = () => {
    // Open Beehiiv newsletter signup in new tab
    window.open('https://newsletter.chrisjkoerner.com/', '_blank');
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-8 text-center">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-white mb-4">Never Miss the Best AI Ideas</h2>
        <p className="text-slate-300 mb-6">
          Get a weekly digest of the most upvoted AI use cases delivered to your inbox. Join other innovators discovering creative AI applications.
        </p>
        
        <Button
          onClick={handleSubscribe}
          className="bg-accent text-white px-8 py-3 rounded-lg font-semibold hover:bg-amber-600 transition-colors inline-flex items-center"
        >
          <Mail className="mr-2 h-4 w-4" />
          Subscribe to Newsletter
          <ExternalLink className="ml-2 h-4 w-4" />
        </Button>
        
        <p className="text-xs text-slate-400 mt-4">No spam, unsubscribe anytime. We respect your privacy.</p>
      </div>
    </div>
  );
}
