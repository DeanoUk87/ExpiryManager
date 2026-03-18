export interface Product {
  id: number;
  shopifyProductId: string | null;
  shopifyVariantId: string | null;
  sku: string;
  name: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface ProductExpiry {
  id: number;
  productId: number;
  expiryDate: string;
  quantity: number;
  notes: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface ReminderRule {
  id: number;
  name: string;
  daysBeforeExpiry: number;
  isActive: boolean;
  emailEnabled: boolean;
  emailAddress: string | null;
  createdAt: Date | null;
}

export interface AlertItem {
  ruleId: number;
  ruleName: string;
  daysBeforeExpiry: number;
  productId: number;
  productExpiryId: number;
  sku: string;
  productName: string;
  expiryDate: string;
  quantity: number;
  daysUntilExpiry: number;
  acknowledged: boolean;
}

export interface ProductWithExpiry extends Product {
  expiries: ProductExpiry[];
}
