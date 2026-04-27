import { HeroSection } from '@/components/sections/HeroSection';
import { ProductDuoSection } from '@/components/sections/ProductDuoSection';
import { MetricsSection } from '@/components/sections/MetricsSection';
import { PlatformSection } from '@/components/sections/PlatformSection';
import { IntegrationsSection } from '@/components/sections/IntegrationsSection';
import { SecuritySection } from '@/components/sections/SecuritySection';
import { CustomersSection } from '@/components/sections/CustomersSection';
import { CtaSection } from '@/components/sections/CtaSection';

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <MetricsSection />
      <ProductDuoSection />
      <PlatformSection />
      <IntegrationsSection />
      <SecuritySection />
      <CustomersSection />
      <CtaSection />
    </>
  );
}
