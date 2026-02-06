export type MotorcycleStatus = 'active' | 'sold' | 'traded' | 'maintenance';

export type VehicleType = 'motorcycle' | 'car' | 'boat' | 'trailer' | 'other';

export type SubscriptionStatus = 'free' | 'active' | 'canceled' | 'past_due';
export type SubscriptionPlan = 'monthly' | 'annual';

export interface Subscription {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: SubscriptionStatus;
  plan: SubscriptionPlan | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

export interface SaleInfo {
  date?: string;
  amount?: number;
  type?: 'sold' | 'traded';
  notes?: string;
}

export interface Motorcycle {
  id: string;
  name: string;
  make: string | null;
  model: string | null;
  nickname: string | null;
  year: number | null;
  vin: string | null;
  plate_number: string | null;
  mileage: string | null;
  notes: string | null;
  tab_expiration: string | null;
  status: MotorcycleStatus;
  vehicle_type: VehicleType;
  maintenance_notes: string | null;
  sale_info: SaleInfo | null;
  purchase_price: number | null;
  purchase_date: string | null;
  estimated_value: number | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  collection_id: string | null;
}

export type CollectionRole = 'owner' | 'editor' | 'viewer';

export interface Collection {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
}

export interface CollectionInvite {
  id: string;
  collection_id: string;
  invite_code: string;
  role: 'editor' | 'viewer';
  created_by: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  used_by: string | null;
}

export interface CollectionMember {
  id: string;
  collection_id: string;
  user_id: string;
  role: CollectionRole;
  joined_at: string;
}

export interface CollectionWithMembers extends Collection {
  members: CollectionMember[];
}

export interface Photo {
  id: string;
  motorcycle_id: string;
  storage_path: string;
  display_order: number;
  caption: string | null;
  created_at: string;
  uploaded_by: string | null;
}

export interface NotificationLog {
  id: string;
  motorcycle_id: string;
  notification_type: string;
  sent_at: string;
  sent_date: string;
  recipient_emails: string[] | null;
}

export interface Profile {
  id: string;
  display_name: string | null;
  email: string | null;
  receive_notifications: boolean;
  created_at: string;
  updated_at: string;
}

export interface MileageHistory {
  id: string;
  motorcycle_id: string;
  mileage: number;
  recorded_date: string;
  notes: string | null;
  created_at: string;
  created_by: string | null;
}

export interface ValueHistory {
  id: string;
  motorcycle_id: string;
  estimated_value: number;
  recorded_date: string;
  source: string | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
}

export type ServiceCategory = 'maintenance' | 'repair' | 'upgrade' | 'inspection';

export type DocumentType = 'title' | 'registration' | 'insurance' | 'receipt' | 'manual' | 'other';

export interface VehicleDocument {
  id: string;
  motorcycle_id: string;
  title: string;
  document_type: DocumentType;
  expiration_date: string | null;
  notes: string | null;
  storage_path: string;
  file_name: string;
  file_type: string | null;
  created_at: string;
  created_by: string | null;
}

export interface ServiceRecord {
  id: string;
  motorcycle_id: string;
  service_date: string;
  title: string;
  description: string | null;
  cost: number | null;
  odometer: number | null;
  shop_name: string | null;
  category: ServiceCategory;
  created_at: string;
  created_by: string | null;
}

export interface ServiceRecordReceipt {
  id: string;
  service_record_id: string;
  storage_path: string;
  file_name: string;
  file_type: string | null;
  created_at: string;
  uploaded_by: string | null;
}

export interface ServiceRecordWithReceipts extends ServiceRecord {
  receipts: ServiceRecordReceipt[];
}

export interface ChatSession {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  user_id: string;
  session_id: string | null;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

export interface MotorcycleWithPhotos extends Motorcycle {
  photos: Photo[];
}

export interface MotorcycleWithMileageHistory extends Motorcycle {
  mileage_history: MileageHistory[];
}

export interface Database {
  public: {
    Tables: {
      motorcycles: {
        Row: Motorcycle;
        Insert: Omit<Motorcycle, 'id' | 'created_at' | 'updated_at' | 'vehicle_type'> & { id?: string; vehicle_type?: VehicleType };
        Update: Partial<Omit<Motorcycle, 'id' | 'created_at' | 'updated_at'>>;
      };
      photos: {
        Row: Photo;
        Insert: Omit<Photo, 'id' | 'created_at'> & { id?: string };
        Update: Partial<Omit<Photo, 'id' | 'created_at'>>;
      };
      notification_log: {
        Row: NotificationLog;
        Insert: Omit<NotificationLog, 'id' | 'sent_at' | 'sent_date'> & { id?: string };
        Update: Partial<Omit<NotificationLog, 'id' | 'sent_at' | 'sent_date'>>;
      };
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>;
      };
      mileage_history: {
        Row: MileageHistory;
        Insert: Omit<MileageHistory, 'id' | 'created_at'> & { id?: string };
        Update: Partial<Omit<MileageHistory, 'id' | 'created_at'>>;
      };
      service_records: {
        Row: ServiceRecord;
        Insert: Omit<ServiceRecord, 'id' | 'created_at'> & { id?: string };
        Update: Partial<Omit<ServiceRecord, 'id' | 'created_at'>>;
      };
      service_record_receipts: {
        Row: ServiceRecordReceipt;
        Insert: Omit<ServiceRecordReceipt, 'id' | 'created_at'> & { id?: string };
        Update: Partial<Omit<ServiceRecordReceipt, 'id' | 'created_at'>>;
      };
      vehicle_documents: {
        Row: VehicleDocument;
        Insert: Omit<VehicleDocument, 'id' | 'created_at'> & { id?: string };
        Update: Partial<Omit<VehicleDocument, 'id' | 'created_at'>>;
      };
      collections: {
        Row: Collection;
        Insert: Omit<Collection, 'id' | 'created_at'> & { id?: string };
        Update: Partial<Omit<Collection, 'id' | 'created_at'>>;
      };
      collection_invites: {
        Row: CollectionInvite;
        Insert: Omit<CollectionInvite, 'id' | 'created_at' | 'expires_at' | 'used_at' | 'used_by'> & {
          id?: string;
          expires_at?: string;
        };
        Update: Partial<Pick<CollectionInvite, 'used_at' | 'used_by'>>;
      };
      collection_members: {
        Row: CollectionMember;
        Insert: Omit<CollectionMember, 'id' | 'joined_at'> & { id?: string };
        Update: Partial<Omit<CollectionMember, 'id' | 'joined_at'>>;
      };
      subscriptions: {
        Row: Subscription;
        Insert: Omit<Subscription, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Subscription, 'id' | 'created_at' | 'updated_at'>>;
      };
    };
    Enums: {
      motorcycle_status: MotorcycleStatus;
      subscription_status: SubscriptionStatus;
      subscription_plan: SubscriptionPlan;
    };
  };
}
