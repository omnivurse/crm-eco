import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@crm-eco/ui';
import { ProductForm } from '@/components/products/ProductForm';
import { EntityPageHeader } from '@/components/ui/EntityPageHeader';

export default function NewProductPage() {
  return (
    <div className="space-y-6 max-w-5xl">
      <EntityPageHeader
        backHref="/products"
        backLabel="Products"
        title="Add new product"
        description="Create a new health plan product"
      />

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Product Information</CardTitle>
          <CardDescription>
            Enter the product details, pricing, and configuration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProductForm />
        </CardContent>
      </Card>
    </div>
  );
}
