export type UserRole = 'CUSTOMER' | 'ADMIN';
export type MissionStatus = 'PENDING' | 'ACTIVE' | 'ENDED';
export type ParticipationStatus = 'JOINED' | 'COMPLETED';
export type RewardStatus = 'ACTIVE' | 'INACTIVE';
export type StampTransactionType = 'EARN' | 'USE';

export interface User {
  userId: number; email: string; name: string; role: UserRole; createdAt: string;
}
export interface Mission {
  missionId: number; title: string; description?: string | null;
  startAt: string; endAt: string; completionCondition?: string | null;
  ingredientType: string; stampCount: number; status: MissionStatus;
  createdBy: number; participationStatus?: ParticipationStatus | null;
}
export interface MissionParticipation {
  participationId: number; missionId: number; userId: number;
  status: ParticipationStatus; joinedAt: string; completedAt?: string | null;
  missionTitle?: string;
}
export type MissionCreateRequest = Omit<Mission, 'missionId' | 'status' | 'createdBy' | 'participationStatus'>;
export type MissionUpdateRequest = Partial<MissionCreateRequest>;
export interface AdminParticipation extends MissionParticipation {
  userName: string;
  userEmail: string;
}
export interface StampBalance { ingredientType: string; balance: number; }
export interface StampTransaction {
  transactionId: number; userId: number; ingredientType: string;
  type: StampTransactionType; amount: number; reason: string;
  relatedMissionId?: number | null; relatedRedemptionId?: number | null; createdAt: string;
}
export interface RecipeItem { ingredientType: string; quantity: number; }
export interface Reward {
  rewardId: number; name: string; description?: string | null;
  recipe: RecipeItem[]; status: RewardStatus; canRedeem?: boolean;
}
export type RewardCreateRequest = Omit<Reward, 'rewardId' | 'status' | 'canRedeem'>;
export type RewardUpdateRequest = Partial<RewardCreateRequest>;
export interface RewardRedemption {
  redemptionId: number; userId: number; rewardId: number; redeemedAt: string;
  rewardName?: string; usedIngredients?: RecipeItem[];
}
