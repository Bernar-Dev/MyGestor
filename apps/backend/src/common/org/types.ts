export type UserRole = 'agency' | 'client' | 'member';

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

/**
 * Colaborador convidado pelo gestor sênior.
 * Tem acesso apenas aos clients em clientIds.
 * memberRole: 'gestor' pode gerenciar, 'observador' só visualiza.
 */
export interface MemberSession {
  role: 'member';
  userId: string;
  email: string;
  orgId: string;
  memberRole: 'gestor' | 'observador';
  clientIds: string[];
}

export type Session = AgencySession | ClientSession | MemberSession;

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
