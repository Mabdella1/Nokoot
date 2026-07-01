export type OccasionType = 'wedding' | 'graduation' | 'birth' | 'eid' | 'other';
export type GiftType = 'monetary' | 'physical';
export type TransactionType = 'received' | 'paid';

export interface UserSettings {
  uid: string;
  email: string;
  displayName?: string;
  theme: 'light' | 'dark';
  securityPinEnabled: boolean;
  securityPinHash?: string; // stored hashed PIN
  isEncryptionEnabled: boolean;
  encryptionKey?: string; // custom secret key entered by user to encrypt fields locally
  autoBackupEnabled: boolean;
  createdAt: string;
}

export interface Occasion {
  id: string;
  userId: string;
  title: string; // can be encrypted
  date: string;
  type: OccasionType;
  notes: string; // can be encrypted
  totalReceived: number;
  totalPaid: number;
  createdAt: string;
}

export interface NoqootTransaction {
  id: string;
  userId: string;
  occasionId: string;
  type: TransactionType; // received (نقوط مستلم) or paid (نقوط مدفوع)
  personName: string; // can be encrypted
  amount: number; // in local currency (e.g. JOD, EGP, SAR, AED)
  giftType: GiftType; // monetary (نقدي) or physical (عيني)
  giftDescription?: string; // can be encrypted
  giftImageUrl?: string; // image illustrating the gift
  isRepaid: boolean; // has it been returned / reciprocated?
  repaymentDueDate?: string; // expected payback date
  purchaseLink?: string; // shopping URL
  notes?: string; // can be encrypted
  createdAt: string;
}

export interface SmartNotification {
  id: string;
  title: string;
  message: string;
  date: string;
  type: 'upcoming_occasion' | 'repayment_due' | 'system';
  referenceId: string; // occasionId or transactionId
  isRead: boolean;
}

export interface UpcomingOccasion {
  id: string;
  userId: string;
  title: string;
  date: string;
  day: string;
  notes?: string;
  createdAt: string;
}

