export type ColumnEntity = {
  id: string;
  type?: string;
  name?: string;
  verification_status?: string;
  review_reasons?: string[];
  requires_screening?: boolean;
  person_details?: Record<string, unknown>;
};

export type ColumnBalances = {
  available_amount?: number;
  holding_amount?: number;
  locked_amount?: number;
  pending_amount?: number;
};

export type ColumnBankAccount = {
  id: string;
  description?: string;
  default_account_number: string;
  default_account_number_id: string;
  routing_number: string;
  status?: string;
  type?: string;
  currency_code?: string;
  owners?: string[];
  balances?: ColumnBalances | null;
  created_at?: string;
};

export type ColumnCounterparty = {
  id: string;
  account_number?: string;
  routing_number?: string;
  name?: string;
};

export type ColumnAchTransfer = {
  id: string;
  amount?: number;
  status?: string;
  type?: string;
  is_incoming?: boolean;
  bank_account_id?: string;
  account_number_id?: string;
  counterparty_id?: string;
  description?: string;
  receiver_name?: string;
  idempotency_key?: string;
  created_at?: string;
  settled_at?: string | null;
  completed_at?: string | null;
  currency_code?: string;
};

export type ColumnUnifiedTransfer = {
  id: string;
  amount?: number;
  status?: string;
  type?: string;
  is_incoming?: boolean;
  description?: string;
  created_at?: string | null;
  completed_at?: string | null;
  settled_at?: string | null;
  currency_code?: string;
  sender_internal_account?: { bank_account_id?: string; account_number_id?: string };
  receiver_internal_account?: { bank_account_id?: string; account_number_id?: string };
};

export type ColumnListTransfers = {
  transfers?: ColumnUnifiedTransfer[];
  has_more?: boolean;
};

export type ColumnAchList = {
  transfers?: ColumnAchTransfer[];
  has_more?: boolean;
};

export type ColumnWebhookEvent = {
  id?: string;
  type?: string;
  data?: Record<string, unknown>;
  created_at?: string;
};
