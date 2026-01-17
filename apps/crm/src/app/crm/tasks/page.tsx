import { redirect } from 'next/navigation';

// Redirect to activities page with tasks filter
export default function TasksPage() {
  redirect('/crm/activities?type=tasks');
}
