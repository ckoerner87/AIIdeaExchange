export class BeehiivService {
  private apiKey: string;
  private publicationId: string;
  private isConfigured: boolean;

  constructor() {
    this.apiKey = process.env.BEEHIIV_API_KEY || '';
    this.publicationId = process.env.BEEHIIV_PUBLICATION_ID || '';
    this.isConfigured = !!(this.apiKey && this.publicationId);

    if (!this.isConfigured) {
      console.log('Beehiiv credentials not configured - email subscriptions will not work');
    }
  }

  async addSubscriber(email: string): Promise<{ success: boolean; message?: string }> {
    if (!this.isConfigured) {
      throw new Error('Beehiiv API not configured');
    }

    try {
      const response = await fetch(`https://api.beehiiv.com/v2/publications/${this.publicationId}/subscriptions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          reactivate_existing: false,
          send_welcome_email: true,
          utm_source: 'howdoyouuseai',
          utm_medium: 'website',
          utm_campaign: 'ai_ideas_platform',
          custom_fields: [
            {
              name: 'source',
              value: 'howdoyouuseai'
            }
          ],
          tags: ['howdoyouuseai', 'ai-platform', 'community']
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        if (response.status === 400 && errorData.message?.includes('already subscribed')) {
          return { success: false, message: 'Email already subscribed' };
        }
        
        throw new Error(errorData.message || `Beehiiv API error: ${response.status}`);
      }

      const data = await response.json();
      return { success: true };
    } catch (error) {
      console.error('Error adding subscriber to Beehiiv:', error);
      throw error;
    }
  }
}

export const beehiivService = new BeehiivService();