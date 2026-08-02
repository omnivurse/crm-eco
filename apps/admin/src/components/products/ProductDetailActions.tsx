'use client';

import { CurrencyDollar, DotsThree, List, ShieldCheck, Sparkle, UploadSimple } from '@phosphor-icons/react';
import { useState } from 'react';
import Link from 'next/link';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@crm-eco/ui';
import { ProductFeaturesModal } from './ProductFeaturesModal';
import { ProductEligibilityModal } from './ProductEligibilityModal';
import { BulkPricingImportModal } from './BulkPricingImportModal';

interface ProductDetailActionsProps {
  productId: string;
  productName: string;
  organizationId: string;
}

/** Secondary product actions — Pricing + overflow. Pass Edit via EntityPageHeader.primaryAction. */
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
      <Link href={`/products/${productId}/pricing`}>
        <Button variant="outline" size="sm">
          <CurrencyDollar weight="light" className="h-4 w-4 mr-1.5" aria-hidden />
          Pricing
        </Button>
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" aria-label="More product actions">
            <DotsThree weight="bold" className="h-4 w-4 mr-1.5" aria-hidden />
            More
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={() => setShowFeatures(true)}>
            <Sparkle weight="light" className="h-4 w-4 mr-2" aria-hidden />
            Features
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setShowEligibility(true)}>
            <ShieldCheck weight="light" className="h-4 w-4 mr-2" aria-hidden />
            Eligibility
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setShowBulkImport(true)}>
            <UploadSimple weight="light" className="h-4 w-4 mr-2" aria-hidden />
            Import pricing
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={`/products/${productId}/questionnaire`}>
              <List weight="light" className="h-4 w-4 mr-2" aria-hidden />
              Questionnaire
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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
