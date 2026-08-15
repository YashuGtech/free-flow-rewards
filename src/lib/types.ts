export type Platform =
  | "Instagram"
  | "Telegram"
  | "YouTube"
  | "Twitter"
  | "TikTok"
  | "Play Store"
  | "App Store"
  | "Browser";

export type TaskAction =
  | "Follow"
  | "Like"
  | "Subscribe"
  | "Retweet"
  | "Join"
  | "View"
  | "Comment"
  | "Referral"
  | "Install"
  | "Download"
  | "Rate"
  | "Visit";

export type Tier = "Bronze" | "Silver" | "Gold" | "Platinum";
export type ClaimStatus = "pending" | "approved" | "rejected";
export type AdMode = "paid" | "referral";
export type Trend = "up" | "down" | "flat";

export interface Task {
  id: string;
  /** Unique public post id shown on cards, e.g. PP-A1B2C3. */
  postId?: string;
  platform: Platform;
  action: TaskAction;
  title: string;
  target: string;
  reward: number; // USDT
  completions: number;
  limit: number;
  minutesAgo: number;
  poster: string;
  posterHandle?: string;
  verified?: boolean;
  rating?: number;
  ratingCount?: number;
  successRate?: number;
  mode?: AdMode;
  instructions?: string;
  likes?: number;
  boosted?: boolean;
  boostUntil?: number;
  /** Search / ranking tags set by the publisher. */
  tags?: string[];
  /** When set (future timestamp), the ad is auto-disabled until then (daily lead cap hit). */
  disabledUntil?: number;
  /** Client-side creation time (ms) — free users' posts are removed after 9h. */
  createdAt?: number;
  /** Banned by admin — hidden from feeds. */
  banned?: boolean;
}

export interface Campaign {
  id: string;
  /** Unique public post id shown on cards, e.g. PP-A1B2C3. */
  postId?: string;
  title: string;
  platform: Platform;
  action: TaskAction;
  target: string;
  reward: number;
  quantity: number;
  budget: number;
  spent: number;
  status: "active" | "paused" | "completed";
  completions: number;
  approvers: number;
  createdDaysAgo: number;
  poster: string;
  posterHandle: string;
  verified?: boolean;
  rating?: number;
  ratingCount?: number;
  successRate?: number;
  mode?: AdMode;
  instructions?: string;
  likes?: number;
  boosted?: boolean;
  boostUntil?: number;
  /** Search / ranking tags set by the publisher. */
  tags?: string[];
  /** When set (future timestamp), the ad is auto-disabled until then (daily lead cap hit). */
  disabledUntil?: number;
  /** Client-side creation time (ms) — free users' posts are removed after 9h. */
  createdAt?: number;
  /** Banned by admin — hidden from feeds. */
  banned?: boolean;
}

export interface UserProfile {
  handle: string;
  /** Telegram username (@ without the @) — used for the one-tap Contact action on leads. */
  tg?: string;
  name: string;
  tier: Tier;
  isPremium: boolean;
  rating: number;
  ratingCount: number;
  successRate: number; // % of followers retained
  /** 5★ ratings this user has GIVEN — each adds +1% to their loyalty rate (loyal rater). */
  fiveStarGives?: number;
  /** 4★ ratings this user has GIVEN — each adds +0.5% to their loyalty rate. */
  fourStarGives?: number;
  followers: number;
  following: number;
  tasksDone: number;
  isYou?: boolean;
}

export interface Submission {
  id: string;
  userId: string;
  handle: string;
  name: string;
  platform: Platform;
  target: string;
  action: TaskAction;
  reward: number;
  submittedAt: string;
  status: ClaimStatus;
  proof: string;
  reason?: string; // required when rejected
  poster: string;
  posterHandle: string;
  rated?: boolean; // set when either party has been rated after the claim was marked done
  /** Paid payouts: TRUE once the claimer's wallet has been credited after the
   *  publisher approved. Persisted only when true (see submissionToRow) so a
   *  publisher's stale copy can never reset it and cause a double payout. */
  credited?: boolean;
  /** Referral-exchange submissions: the claimer's link + description, shown to the owner for verification. */
  link?: string;
  note?: string;
  mode?: AdMode;
  /** Public id (PP-XXXXXX) of the ad this claim was submitted against — used in the one-tap Contact message. */
  postId?: string;
  /** Internal id of the task this claim was submitted against — used to hide completed tasks from the feed. */
  taskId?: string;
}

export type NotificationType =
  | "follow"
  | "new_ad"
  | "claim"
  | "report"
  | "referral"
  | "system"
  | "withdraw";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  description?: string;
  at: string;
  read: boolean;
}

export interface ReportEntry {
  target: string;
  by: string;
  at: number;
  reason: string;
}

export interface Ban {
  handle: string;
  until: number;
  reason: string;
}

/** Ban appeal filed by a suspended user — reviewed by the admin (Review requests tab). */
export interface ReviewRequest {
  id: string;
  handle: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  at: string;
  atMs?: number;
  banUntil?: number;
}

export interface Referral {
  handle: string;
  at: string;
}

export interface Transaction {
  id: string;
  type: "earn" | "spend" | "reject" | "referral" | "deposit" | "withdraw" | "premium" | "bonus";
  label: string;
  amount: number; // signed USDT
  date: string;
  meta?: string;
}

export interface LeaderEntry {
  rank: number;
  handle: string;
  name: string;
  points: number; // total earned USDT
  tier: Tier;
  trend: Trend;
  isYou?: boolean;
  isPremium?: boolean;
}

export interface PremiumPlan {
  id: string;
  label: string;
  price: number;
  days: number;
  perks: string[];
  /** Daily publishing quota for this plan. */
  postsPerDay: number;
  /** Max leads a single post may receive per day before auto-disable (1 week). */
  leadsPerPostPerDay: number;
}

export interface DepositOrder {
  id: string;
  amount: number;
  trackId: string;
  paymentUrl: string;
  status: string;
  at: string;
  sandbox?: boolean;
  purpose?: "deposit" | "premium";
  planId?: string;
  /** On-chain wallet deposits: selected EVM network id (ethereum, bsc, …). */
  network?: string;
  /** On-chain wallet deposits: the verified transaction hash. */
  txHash?: string;
  /** On-chain wallet deposits: deposit bonus credited (package first-deposit or custom cashback). */
  bonus?: number;
  /** NOWPayments: generated crypto deposit address to send funds to. */
  payAddress?: string;
  /** NOWPayments: exact crypto amount to send (pay_currency units). */
  payAmount?: number;
  /** NOWPayments: pay currency code (usdtbsc, usdtmatic, usdtop…). */
  payCurrency?: string;
}

export interface WithdrawalRequest {
  id: string;
  amount: number;
  address: string;
  at: string;
  status: "pending" | "done";
  trackId?: string;
  network?: string;
  demo?: boolean;
}

export interface ToastMsg {
  id: string;
  type: "success" | "info" | "warning" | "danger";
  title: string;
  description?: string;
  amount?: number;
}

export interface StreakDay {
  day: number;
  reward: number;
  claimed: boolean;
  today?: boolean;
}

/** In-app chat message between an ad owner and a lead (thread = submission id). */
export interface ChatMessage {
  id: string;
  threadId: string;
  sender: string; // handle of the sender
  body: string;
  createdAt: number; // ms
}
