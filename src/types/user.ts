export type Plan = 'free' | 'pro' | 'business'

export type CreatorType =
  | 'youtuber'
  | 'streamer'
  | 'blogger'
  | 'podcaster'
  | 'freelancer'
  | 'consultant'
  | 'other'

export interface UserProfile {
  id: string
  email: string
  name: string
  creatorType?: CreatorType
  plan: Plan
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  kakaoUuid?: string
  notificationChannel?: 'email' | 'kakao' | 'all' | 'none'
  onboardingCompleted: boolean
  createdAt: string
  updatedAt: string
}

export interface UserSettings {
  notificationChannel: 'email' | 'kakao' | 'all' | 'none'
  weeklyReportEnabled: boolean
  dailyAlertEnabled: boolean
  taxYear: number
}
