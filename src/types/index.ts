export type SourceType = 'reddit' | 'hn' | 'remoteok' | 'weworkremotely' | 'reddit-search';
export type AIProvider = 'anthropic' | 'groq' | 'gemini';

export interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  subreddit: string;
  author: string;
  created_utc: number;
  num_comments: number;
  score: number;
  permalink: string;
  url: string;
  // Optional — absent means Reddit
  sourceType?: SourceType;
  sourceName?: string;
}

export interface AppSettings {
  enabledSubreddits: string[];
  enabledSources: string[];
  stackFilters: string[];
  fetchInterval: 15 | 30 | 60;
  notificationsEnabled: boolean;
  aiProvider: AIProvider;
  anthropicApiKey: string;
  groqApiKey: string;
  geminiApiKey: string;
  searchEnabled: boolean;
  searchTerms: string[];
}

export type RootTabParamList = {
  Feed: undefined;
  Settings: undefined;
};

export type FeedStackParamList = {
  FeedList: undefined;
  PostDetail: { post: RedditPost };
};
