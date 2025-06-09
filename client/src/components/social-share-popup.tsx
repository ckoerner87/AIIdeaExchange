import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, X, Twitter, Linkedin, Facebook } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface SocialSharePopupProps {
  isOpen: boolean;
  onClose: () => void;
  ideaText: string;
  ideaId: number;
}

export default function SocialSharePopup({ isOpen, onClose, ideaText, ideaId }: SocialSharePopupProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const siteUrl = "HowDoYouUseAI.com";
  const fullUrl = `https://${siteUrl}`;
  
  // Truncate idea text for social sharing
  const truncatedIdea = ideaText.length > 100 ? ideaText.substring(0, 100) + "..." : ideaText;
  
  const shareText = `Just shared my AI use case: "${truncatedIdea}" 

Check it out and share yours too!

Shared on ${siteUrl}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      toast({
        title: "Copied to clipboard!",
        description: "Share this text on your favorite social platform"
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Copy failed",
        description: "Please copy the text manually",
        variant: "destructive"
      });
    }
  };

  const shareUrls = {
    twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(fullUrl)}&summary=${encodeURIComponent(shareText)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(fullUrl)}&quote=${encodeURIComponent(shareText)}`
  };

  const openShareUrl = (url: string) => {
    window.open(url, '_blank', 'width=600,height=400');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-semibold text-gray-900">
              🎉 Great submission!
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Preview Card */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg p-6 border border-blue-200">
            <div className="text-center space-y-4">
              <div className="text-sm font-medium text-blue-800">Your AI Use Case</div>
              <div className="text-gray-800 font-medium leading-relaxed">
                "{truncatedIdea}"
              </div>
              <div className="text-lg font-bold text-blue-600">
                Shared on {siteUrl}
              </div>
            </div>
          </div>

          {/* Share Text Box */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700">
              Copy this text to share:
            </label>
            <div className="relative">
              <textarea
                value={shareText}
                readOnly
                className="w-full p-3 pr-12 text-sm border border-gray-300 rounded-lg resize-none bg-gray-50"
                rows={5}
              />
              <Button
                onClick={copyToClipboard}
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2 h-8 w-8 p-0"
              >
                <Copy className={`h-4 w-4 ${copied ? 'text-green-600' : 'text-gray-500'}`} />
              </Button>
            </div>
          </div>

          {/* Social Media Buttons */}
          <div className="space-y-3">
            <div className="text-sm font-medium text-gray-700">
              Or share directly:
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => openShareUrl(shareUrls.twitter)}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
                size="sm"
              >
                <Twitter className="h-4 w-4 mr-2" />
                Twitter
              </Button>
              <Button
                onClick={() => openShareUrl(shareUrls.linkedin)}
                className="flex-1 bg-blue-700 hover:bg-blue-800 text-white"
                size="sm"
              >
                <Linkedin className="h-4 w-4 mr-2" />
                LinkedIn
              </Button>
              <Button
                onClick={() => openShareUrl(shareUrls.facebook)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                size="sm"
              >
                <Facebook className="h-4 w-4 mr-2" />
                Facebook
              </Button>
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1"
            >
              Skip for now
            </Button>
            <Button
              onClick={copyToClipboard}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            >
              {copied ? "Copied!" : "Copy & Share"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}