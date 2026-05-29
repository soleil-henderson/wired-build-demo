import * as RNIap from 'react-native-iap';

type PurchaseLike = {
  transactionReceipt?: string;
  purchaseToken?: string;
};

export async function purchaseSubscription(productId: string): Promise<string> {
  await RNIap.initConnection();
  const result = await RNIap.requestSubscription({ sku: productId });
  const purchase = Array.isArray(result) ? result[0] : result;
  if (!purchase) {
    throw new Error('Purchase was cancelled.');
  }
  const token =
    (purchase as PurchaseLike).transactionReceipt ??
    (purchase as PurchaseLike).purchaseToken ??
    '';
  await RNIap.finishTransaction({ purchase, isConsumable: false });
  return token;
}

export async function restorePurchases(): Promise<{ productId: string; token: string }> {
  await RNIap.initConnection();
  const purchases = await RNIap.getAvailablePurchases();
  if (purchases.length === 0) {
    throw new Error('No purchases to restore.');
  }
  const latest = purchases[0];
  return {
    productId: latest.productId,
    token: (latest as PurchaseLike).transactionReceipt ?? '',
  };
}
