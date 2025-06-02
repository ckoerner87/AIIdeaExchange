import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertSubscriptionSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Check, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { InsertSubscription } from "@shared/schema";

interface SubscriptionFormProps {
  subscriberCount: number;
}

export default function SubscriptionForm({ subscriberCount }: SubscriptionFormProps) {
  const { toast } = useToast();
  
  const form = useForm<InsertSubscription>({
    resolver: zodResolver(insertSubscriptionSchema),
    defaultValues: {
      email: "",
    },
  });

  const subscribeMutation = useMutation({
    mutationFn: async (data: InsertSubscription) => {
      const res = await apiRequest('POST', '/api/subscribe', data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Successfully subscribed!",
        description: "You'll receive weekly updates about top-voted AI use cases.",
      });
      form.reset();
    },
    onError: (error: any) => {
      if (error.message.includes('already subscribed')) {
        toast({
          title: "Already subscribed",
          description: "This email is already subscribed to our weekly digest.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to subscribe",
          variant: "destructive",
        });
      }
    },
  });

  const onSubmit = (data: InsertSubscription) => {
    subscribeMutation.mutate(data);
  };

  const isSuccess = subscribeMutation.isSuccess;

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-8 text-center">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-white mb-4">Never Miss the Best AI Ideas</h2>
        <p className="text-slate-300 mb-6">
          Get a weekly digest of the most upvoted AI use cases delivered to your inbox. Join other innovators discovering creative AI applications.
        </p>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col sm:flex-row gap-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="Enter your email address"
                      className="px-4 py-3 rounded-lg border-0 focus:ring-2 focus:ring-accent"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-red-300" />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              disabled={subscribeMutation.isPending || isSuccess}
              className="bg-accent text-white px-8 py-3 rounded-lg font-semibold hover:bg-amber-600 transition-colors whitespace-nowrap"
            >
              {subscribeMutation.isPending ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Subscribing...
                </>
              ) : isSuccess ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Subscribed!
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Subscribe Free
                </>
              )}
            </Button>
          </form>
        </Form>
        
        <p className="text-xs text-slate-400 mt-4">No spam, unsubscribe anytime. We respect your privacy.</p>
      </div>
    </div>
  );
}
