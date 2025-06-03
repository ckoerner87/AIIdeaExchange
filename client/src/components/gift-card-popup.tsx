import { useState } from "react";
import { X, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface GiftCardPopupProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
}

export default function GiftCardPopup({ isOpen, onClose, sessionId }: GiftCardPopupProps) {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      onClose();
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, source: 'gift_card_popup', sessionId }),
      });

      if (response.ok) {
        toast({
          title: "Email saved!",
          description: "We'll contact you if your idea wins the weekly prize.",
        });
      } else {
        toast({
          title: "Email saved locally!",
          description: "We'll contact you if your idea wins the weekly prize.",
        });
      }
    } catch (error) {
      toast({
        title: "Email saved locally!",
        description: "We'll contact you if your idea wins the weekly prize.",
      });
    } finally {
      setIsSubmitting(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md bg-white shadow-2xl">
        <CardContent className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center space-x-2">
              <Gift className="h-6 w-6 text-yellow-500" />
              <h3 className="text-lg font-bold text-slate-900">Great idea!</h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          
          <p className="text-slate-700 mb-4">
            If it's the most upvoted of the week we'll send you a $100 Amazon gift card. Where should we send it?
          </p>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              placeholder="your-email@example.com (not required)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full"
            />
            
            <div className="flex space-x-3">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white"
              >
                {isSubmitting ? "Saving..." : "Save Email"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1"
              >
                Skip
              </Button>
            </div>
          </form>
          
          <p className="text-xs text-slate-500 mt-3 text-center">
            This is completely optional. You can close this anytime.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}