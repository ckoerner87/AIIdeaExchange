// Content filtering for idea submissions and comments
export class ContentFilter {
  private static bannedWords = [
    // Explicit content
    'porn', 'sex', 'nude', 'naked', 'xxx', 'adult', 'nsfw', 'erotic', 'sexy', 'sexual',
    'masturbate', 'orgasm', 'climax', 'horny', 'blowjob', 'handjob', 'prostitute', 'escort',
    'hooker', 'stripper', 'breast', 'boobs', 'tits', 'penis', 'vagina', 'anal', 'oral',
    
    // Common profanity
    'fuck', 'fucking', 'fucked', 'fucker', 'shit', 'shitting', 'damn', 'hell', 'bitch', 
    'bitching', 'bitches', 'ass', 'asshole', 'crap', 'piss', 'pissed', 'bastard', 'cock', 
    'dick', 'pussy', 'cunt', 'whore', 'slut',
    
    // Hate speech and slurs
    'fag', 'faggot', 'nigger', 'nigga', 'retard', 'retarded', 'nazi', 'hitler',
    
    // Toxic/harmful content
    'kill yourself', 'kys', 'suicide', 'die', 'murder', 'rape', 'pedophile', 'molest',
    'terrorist', 'bomb', 'attack', 'violence', 'genocide', 'torture', 'abuse'
  ];

  static isValidSubmission(content: string): { isValid: boolean; reason?: string; isTestSubmission?: boolean } {
    // Check minimum length (100 characters)
    if (content.trim().length < 100) {
      return { isValid: false, reason: 'Minimum 100 characters required' };
    }

    return { isValid: true };
  }

  static validateIdea(useCase: string): { isValid: boolean; reason?: string; isTestSubmission?: boolean } {
    return this.isValidSubmission(useCase);
  }

  static validateComment(content: string): { isValid: boolean; reason?: string } {
    const lowercaseContent = content.toLowerCase();
    
    // Check for banned words
    for (const word of this.bannedWords) {
      if (lowercaseContent.includes(word)) {
        return { isValid: false, reason: 'Comment contains inappropriate content' };
      }
    }

    // Check minimum length
    if (content.trim().length < 1) {
      return { isValid: false, reason: 'Comment cannot be empty' };
    }

    // Check maximum length
    if (content.trim().length > 500) {
      return { isValid: false, reason: 'Comment is too long (max 500 characters)' };
    }

    return { isValid: true };
  }

  static validateUsername(username: string): { isValid: boolean; reason?: string } {
    const lowercaseUsername = username.toLowerCase();
    
    // Check for banned words
    for (const word of this.bannedWords) {
      if (lowercaseUsername.includes(word)) {
        return { isValid: false, reason: 'Username contains inappropriate content' };
      }
    }

    // Check format (handled by zod in schema)
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return { isValid: false, reason: 'Username can only contain letters, numbers, underscores, and hyphens' };
    }

    return { isValid: true };
  }
}