import { Landing } from '@/components/landing/landing';
import { B2CLanding } from '@/components/b2c/landing';
import { B2B_ENABLED } from '@/lib/features';

export default function HomePage() {
  // B2C is the default product. The legacy B2B marketing landing is kept behind
  // the feature flag (code not deleted) and shown only when B2B is enabled.
  return B2B_ENABLED ? <Landing /> : <B2CLanding />;
}
