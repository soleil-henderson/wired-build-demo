/** Web / default — IAP not available. */
export async function purchaseSubscription(_productId: string): Promise<string> {
  throw new Error(
    'In-app purchases require an iOS App Store build. Use Stripe checkout on web or Android.'
  );
}

export async function restorePurchases(): Promise<{ productId: string; token: string }> {
  throw new Error('Restore is only available on iOS.');
}
