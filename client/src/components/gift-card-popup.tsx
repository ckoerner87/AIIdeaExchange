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

          {/* Email Form */}
          <form onSubmit={handleSubmit} className="space-y-4 mb-6">
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

          {/* Social Sharing Section at Bottom */}
          {submittedIdeaId && (
            <div className="border-t border-slate-200 pt-4">
              <div className="flex items-center space-x-2 mb-3">
                <Share2 className="h-4 w-4 text-slate-600" />
                <span className="text-sm font-medium text-slate-700">Share your idea to get more votes!</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleShare('twitter')}
                  className="flex flex-col items-center space-y-1 h-12 text-xs"
                >
                  <Twitter className="h-4 w-4" />
                  <span>Twitter</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleShare('facebook')}
                  className="flex flex-col items-center space-y-1 h-12 text-xs"
                >
                  <Facebook className="h-4 w-4" />
                  <span>Facebook</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleShare('linkedin')}
                  className="flex flex-col items-center space-y-1 h-12 text-xs"
                >
                  <Linkedin className="h-4 w-4" />
                  <span>LinkedIn</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleShare('copy')}
                  className="flex flex-col items-center space-y-1 h-12 text-xs"
                >
                  <Copy className="h-4 w-4" />
                  <span>Copy</span>
                </Button>
              </div>
            </div>
          )}
          
          <p className="text-xs text-slate-500 mt-3 text-center">
            This is completely optional. You can close this anytime.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}