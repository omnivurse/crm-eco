import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY');
  console.error('Make sure your .env file contains:');
  console.error('VITE_SUPABASE_URL=your_supabase_url');
  console.error('SUPABASE_SERVICE_ROLE_KEY=your_service_role_key');
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createUser(email, role, full_name) {
  console.log(`Creating user: ${email} (${role})`);
  
  const { data: user, error } = await admin.auth.admin.createUser({
    email, 
    password: crypto.randomUUID(), 
    email_confirm: true,
    user_metadata: { full_name }
  });
  
  if (error) {
    if (error.message?.includes('already registered')) {
      console.log(`  → User ${email} already exists, updating role...`);
      // Find existing user and update role
      const { data: existingUser } = await admin.auth.admin.listUsers();
      const found = existingUser?.users?.find(u => u.email === email);
      if (found) {
        const { error: updateError } = await admin
          .from('profiles')
          .update({ role, full_name })
          .eq('id', found.id);
        if (updateError) throw updateError;
        return found;
      }
    } else {
      throw error;
    }
  }

  // Update profile with role
  const { error: profileError } = await admin
    .from('profiles')
    .update({ role, email, full_name })
    .eq('id', user.user.id);
    
  if (profileError) throw profileError;

  // Write audit log
  await admin.from('audit_logs').insert({
    actor_id: null, 
    target_user_id: user.user.id, 
    action: 'seed_user',
    details: { email, role, full_name, source: 'seed_script' }
  });

  console.log(`  ✅ Created: ${email}`);
  return user.user;
}

async function seedSsoGroupMappings() {
  console.log('Seeding SSO group mappings...');
  
  const mappings = [
    { group_name: 'IT-Admins', role: 'admin' },
    { group_name: 'IT-Engineers', role: 'it' },
    { group_name: 'Staff', role: 'staff' },
    { group_name: 'Advisors', role: 'advisor' },
    { group_name: 'Members', role: 'member' },
  ];

  const { error } = await admin
    .from('sso_group_roles')
    .upsert(mappings, { onConflict: 'group_name' });
    
  if (error) throw error;
  console.log('  ✅ SSO group mappings created');
}

(async () => {
  try {
    console.log('🚀 Starting Championship IT seed...\n');

    // 1. Seed SSO group mappings
    await seedSsoGroupMappings();

    // 2. Create users
    console.log('\nCreating users...');
    
    // Super Admin (replace with your email)
    await createUser('admin@championshipit.com', 'super_admin', 'Championship Admin');

    // Sample team
    await createUser('cto.assistant@championshipit.com', 'admin', 'CTO Assistant');
    await createUser('it1@championshipit.com', 'it', 'IT Engineer One');
    await createUser('it2@championshipit.com', 'it', 'IT Engineer Two');
    await createUser('staff1@championshipit.com', 'staff', 'Staff Member One');
    await createUser('advisor1@championshipit.com', 'advisor', 'Advisor One');
    await createUser('member1@championshipit.com', 'member', 'Member One');

    console.log('\n🎉 Seed complete!');
    console.log('\n📧 Login credentials:');
    console.log('Email: admin@championshipit.com');
    console.log('Role: super_admin');
    console.log('Note: Check your Supabase dashboard for the generated password, or reset it manually');
    
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
})();