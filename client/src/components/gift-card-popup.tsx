import { useState } from "react";
import { X, Gift, Share2, Twitter, Facebook, Linkedin, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface GiftCardPopupProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  submittedIdeaId?: number;
  submittedIdeaText?: string;
}

export default function GiftCardPopup({ isOpen, onClose, sessionId, submittedIdeaId, submittedIdeaText }: GiftCardPopupProps) {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  if (!isOpen) return null;

  const shareUrl = submittedIdeaId ? `${window.location.origin}/?idea=${submittedIdeaId}` : window.location.href;
  const shareText = submittedIdeaText ? `Check out my AI use case idea: "${submittedIdeaText.substring(0, 100)}${submittedIdeaText.length > 100 ? '...' : ''}"` : "Check out this amazing collection of AI use cases!";

  const handleShare = (platform: string) => {
    const encodedText = encodeURIComponent(shareText);
    const encodedUrl = encodeURIComponent(shareUrl);
    
    let shareLink = '';
    switch (platform) {
      case 'twitter':
        shareLink = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
        break;
      case 'facebook':
        shareLink = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
        break;
      case 'linkedin':
        shareLink = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
        break;
      case 'copy':
        navigator.clipboard.writeText(shareUrl);
        toast({
          title: "Link copied!",
          description: "Share link has been copied to your clipboard.",
        });
        return;
    }
    
    if (shareLink) {
      window.open(shareLink, '_blank', 'width=600,height=400');
    }
  };

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

          {/* Social Sharing Section */}
          {submittedIdeaId && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center space-x-2 mb-3">
                <Share2 className="h-5 w-5 text-blue-600" />
                <h4 className="font-semibold text-blue-900">Share your idea to get more votes!</h4>
              </div>
              <p className="text-sm text-blue-700 mb-3">
                Share your idea on social media to increase your chances of winning the weekly $100 prize.
              </p>
              <div className="flex space-x-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleShare('twitter')}
                  className="flex items-center space-x-1 border-blue-300 text-blue-700 hover:bg-blue-100"
                >
                  <Twitter className="h-4 w-4" />
                  <span>Twitter</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleShare('facebook')}
                  className="flex items-center space-x-1 border-blue-300 text-blue-700 hover:bg-blue-100"
                >
                  <Facebook className="h-4 w-4" />
                  <span>Facebook</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleShare('linkedin')}
                  className="flex items-center space-x-1 border-blue-300 text-blue-700 hover:bg-blue-100"
                >
                  <Linkedin className="h-4 w-4" />
                  <span>LinkedIn</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleShare('copy')}
                  className="flex items-center space-x-1 border-blue-300 text-blue-700 hover:bg-blue-100"
                >
                  <Copy className="h-4 w-4" />
                  <span>Copy Link</span>
                </Button>
              </div>
            </div>
          )}
          
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