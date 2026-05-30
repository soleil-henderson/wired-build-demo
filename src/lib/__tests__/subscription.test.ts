import { describe, expect, it } from 'vitest';

import {
  canCommentAndReact,
  canExportBuildData,
  canManageWorkshopProfile,
  canSaveSearches,
  canUseReceiptOcr,
  hasTierAtLeast,
  maxVehiclesForTier,
  wiredAiMonthlyLimit,
} from '@/lib/subscription-access';

describe('subscription tiers', () => {
  it('orders tiers correctly', () => {
    expect(hasTierAtLeast('workshop', 'pro')).toBe(true);
    expect(hasTierAtLeast('pro', 'member')).toBe(true);
    expect(hasTierAtLeast('member', 'free')).toBe(true);
    expect(hasTierAtLeast('free', 'member')).toBe(false);
  });

  it('limits free garage size', () => {
    expect(maxVehiclesForTier('free')).toBe(3);
    expect(maxVehiclesForTier('member')).toBeNull();
  });

  it('gates member perks', () => {
    expect(canSaveSearches('free')).toBe(false);
    expect(canSaveSearches('member')).toBe(true);
    expect(canCommentAndReact('free')).toBe(false);
    expect(canCommentAndReact('member')).toBe(true);
  });

  it('gates pro perks', () => {
    expect(canUseReceiptOcr('member')).toBe(false);
    expect(canUseReceiptOcr('pro')).toBe(true);
    expect(canExportBuildData('member')).toBe(false);
    expect(canExportBuildData('pro')).toBe(true);
    expect(wiredAiMonthlyLimit('pro')).toBeNull();
    expect(wiredAiMonthlyLimit('free')).toBe(20);
  });

  it('gates workshop perks', () => {
    expect(canManageWorkshopProfile('pro')).toBe(false);
    expect(canManageWorkshopProfile('workshop')).toBe(true);
  });
});
