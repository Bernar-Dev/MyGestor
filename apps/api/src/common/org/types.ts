export type UserRole = 'agency' | 'client';

export interface AgencySession {
  role: 'agency';
  userId: string;
  email: string;
  orgId: string;
  orgRole: 'owner' | 'manager';
}

export interface ClientSession {
  role: 'client';
  userId: string;
  email: string;
  clientId: string;
  orgId: string;
}

export type Session = AgencySession | ClientSession;

export interface OnboardingPending {
  needsOnboarding: true;
  userId: string;
  email: string;
}

export type SessionOrPending = Session | OnboardingPending;

export interface AuthUser {
  id: string;
  email: string;
}
