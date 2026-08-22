import type { MetadataRoute } from 'next';
import { pinLockRobots } from '@crm-eco/ui/lib/pin-lock';

export default function robots(): MetadataRoute.Robots {
  return pinLockRobots();
}
