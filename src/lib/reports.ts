import { Linking } from 'react-native';

const SUPPORT_EMAIL = 'support@wiredautogroup.com';

export async function reportContent(input: {
  targetType: 'post' | 'user';
  targetId: string;
  reason?: string;
}): Promise<void> {
  const subject = encodeURIComponent(`Wired Build report: ${input.targetType} ${input.targetId}`);
  const body = encodeURIComponent(
    `Reported ${input.targetType} id: ${input.targetId}\nReason: ${input.reason ?? '(not specified)'}\n`
  );
  const url = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
  const can = await Linking.canOpenURL(url);
  if (!can) {
    throw new Error('Could not open mail client');
  }
  await Linking.openURL(url);
}
