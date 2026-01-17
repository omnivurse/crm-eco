import { redirect } from 'next/navigation';

// Redirect /crm/products/new to the generic module creation flow
export default function NewProductPage() {
    redirect('/crm/modules/products/new');
}
