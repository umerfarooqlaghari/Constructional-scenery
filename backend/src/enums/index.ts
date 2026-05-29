export enum UserRole {
  MANAGING_DIRECTOR = 'managing_director',
  CONSTRUCTION_ACCOUNTANT = 'construction_accountant',
  CONSTRUCTION_COORDINATOR = 'construction_coordinator',
}

export enum ProductionStatus {
  PRE_PRODUCTION = 'pre_production',
  ACTIVE_BUILD = 'active_build',
  STRIKE = 'strike',
  COMPLETE = 'complete',
  ARCHIVED = 'archived',
}

export enum ContractType {
  ON_A_PRICE = 'on_a_price',
  COST_PLUS = 'cost_plus',
}

export enum SetCompletionStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  NEARING_COMPLETION = 'nearing_completion',
  COMPLETE = 'complete',
  HANDED_OVER = 'handed_over',
}

export enum ProductionDocumentType {
  SHOOTING_SCHEDULE = 'shooting_schedule',
  DRAWING = 'drawing',
  CONTRACT = 'contract',
  SIGN_OFF = 'sign_off',
  OTHER = 'other',
}

export enum EmploymentStatus {
  PAYE = 'paye',
  SELF_EMPLOYED = 'self_employed',
}

export enum CrewDocumentType {
  GOVERNMENT_ID = 'government_id',
  CONTRACT = 'contract',
  OTHER = 'other',
}

export enum PaidFrom {
  SUPPLIER_ACCOUNT = 'supplier_account',
  ARBUTHNOT_CURRENT_ACCOUNT = 'arbuthnot_current_account',
  CHARGE_CARD = 'charge_card',
  PLEO_CHARGE_CARD = 'pleo_charge_card',
}

export enum PurchaseOrderStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  ISSUED = 'issued',
  INVOICE_RECEIVED = 'invoice_received',
  APPROVED = 'approved',
}

export enum TimesheetStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  REVIEWED = 'reviewed',
  INVOICE_RECEIVED = 'invoice_received',
  VERIFIED = 'verified',
}

export enum PayRunStatus {
  DRAFT = 'draft',
  PROCESSED = 'processed',
}

export enum DayOfWeek {
  MONDAY = 'Monday',
  TUESDAY = 'Tuesday',
  WEDNESDAY = 'Wednesday',
  THURSDAY = 'Thursday',
  FRIDAY = 'Friday',
  SATURDAY = 'Saturday',
  SUNDAY = 'Sunday',
}

export enum PercentometerCostType {
  CARPENTERS = 'Carpenters',
  PAINTERS = 'Painters',
  STAGEHANDS = 'Stagehands',
  RIGGERS = 'Riggers',
  TIMBER = 'Timber',
  PLASTERWORK = 'Plasterwork',
  MISC = 'Misc',
  SCULPTORS = 'Sculptors',
  METALWORK = 'Metalwork',
  PAINT = 'Paint',
  GLASS = 'Glass',
}
