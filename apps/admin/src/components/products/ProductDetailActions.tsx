'use client';

import { useState } from 'react';
import { Button } from '@crm-eco/ui';
import { Sparkles, Shield, Upload } from 'lucide-react';
import { ProductFeaturesModal } from './ProductFeaturesModal';
import { ProductEligibilityModal } from './ProductEligibilityModal';
import { BulkPricingImportModal } from './BulkPricingImportModal';

interface ProductDetailActionsProps {
  productId: string;
  productName: string;
  organizationId: string;
}

export function ProductDetailActions({
  productId,
  productName,
  organizationId,
}: ProductDetailActionsProps) {
  const [showFeatures, setShowFeatures] = useState(false);
  const [showEligibility, setShowEligibility] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setShowFeatures(true)}>
        <Sparkles className="h-4 w-4 mr-2" />
        Features
      </Button>
      <Button variant="outline" onClick={() => setShowEligibility(true)}>
        <Shield className="h-4 w-4 mr-2" />
        Eligibility
      </Button>
      <Button variant="outline" onClick={() => setShowBulkImport(true)}>
        <Upload className="h-4 w-4 mr-2" />
        Import Pricing
      </Button>

      <ProductFeaturesModal
        isOpen={showFeatures}
        onClose={() => setShowFeatures(false)}
        productId={productId}
        productName={productName}
        organizationId={organizationId}
      />

      <ProductEligibilityModal
        isOpen={showEligibility}
        onClose={() => setShowEligibility(false)}
        productId={productId}
        productName={productName}
      />

      <BulkPricingImportModal
        isOpen={showBulkImport}
        onClose={() => setShowBulkImport(false)}
        productId={productId}
        productName={productName}
        organizationId={organizationId}
      />
    </>
  );
}
