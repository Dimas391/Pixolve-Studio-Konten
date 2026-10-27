export type ContentStatus =
  "idea" | "scripting" | "in_production" | "pending_approval" | "scheduled" | "published";

export type AssetProvider = "google_drive" | "dropbox" | "canva" | "figma";

export interface Metrics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  engagement_rate: number;
}

export interface ContentComment {
  id: string;
  author: string;
  message: string;
  created_at: string;
}

export interface Content {
  id: string;
  title: string;
  description: string;
  pillar: string;
  platforms: string[];
  status: ContentStatus;
  approval_status: string;
  caption: string;
  hashtags: string;
  cta: string;
  asset_url: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  metrics: Metrics;
  comments: ContentComment[];
  created_at: string;
  updated_at: string;
}

export interface Asset {
  id: string;
  title: string;
  url: string;
  provider: AssetProvider;
  kind: string;
  notes: string;
  status: string;
}

export interface DashboardSummary {
  published: number;
  scheduled: number;
  in_review: number;
  total_content: number;
  media_assets: number;
  upcoming: Content[];
  content_by_status: Array<{ status: ContentStatus; count: number }>;
}
