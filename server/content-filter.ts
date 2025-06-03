// Content filtering for idea submissions
export class ContentFilter {
  private static bannedWords = [
    // Explicit content
    'porn', 'sex', 'nude', 'naked', 'xxx', 'adult', 'nsfw', 'erotic', 'sexy', 'sexual',
    // Common profanity
    'fuck', 'shit', 'damn', 'hell', 'bitch', 'ass', 'crap', 'piss', 'bastard', 'asshole'
  ];

  static isValidSubmission(content: string): { isValid: boolean; reason?: string } {
    const lowercaseContent = content.toLowerCase();
    
    // Check for banned words (swear words and sex-related content)
    for (const word of this.bannedWords) {
      if (lowercaseContent.includes(word)) {
        return { isValid: false, reason: 'Contains inappropriate content' };
      }
    }

    // Check minimum length
    if (content.trim().length < 3) {
      return { isValid: false, reason: 'Too short' };
    }

    // Check for obvious gibberish patterns only
    const hasExcessiveRepeats = /(.)\1{6,}/.test(content); // 7+ repeated characters like "aaaaaaa"
    const hasRandomNonsense = /^[qwertasdfzxcv]{10,}$/i.test(content.replace(/\s/g, '')); // Pure keyboard mashing
    
    if (hasExcessiveRepeats || hasRandomNonsense) {
      return { isValid: false, reason: 'Please provide a meaningful description' };
    }

    return { isValid: true };
  }

  static validateIdea(useCase: string): { isValid: boolean; reason?: string } {
    return this.isValidSubmission(useCase);
  }
}