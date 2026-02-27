import { Timestamp } from "firebase/firestore";
import { PlanType } from "./data/bible";

export type UserDoc = {
  uid: string;
  displayName: string;
  planType: PlanType;
  createdAt: Timestamp;
};

export type ProgressDoc = {
  completed?: boolean;
  completedAt?: Timestamp | null;
  reads?: number;
  lastReadAt?: Timestamp | null;
  lastPlanEventId?: string | null;
};

export type EventDoc = {
  id: string;
  type: "read";
  chapterId: string;
  source: "plan" | "extra";
  at: Timestamp;
};
