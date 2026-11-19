export interface TransactionViewModel {
  id?: string;
  // Required unless purchaseToken is present (#08: a Play-verified purchase
  // uses the purchase token as the payment reference and derives status
  // server-side instead).
  paymentRef?: string;
  amount: number;
  status?: number;
  transDate: Date;
  description?: string;
  purchaseToken?: string;
  packageName?: string;
  subscriptionId?: string;
}
