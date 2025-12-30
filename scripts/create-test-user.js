// Script to create a test user via Supabase Auth API
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ctujznwjyyqnhecixlon.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  console.log('\nTo create a test user:');
  console.log('1. Go to Supabase Dashboard: https://supabase.com/dashboard');
  console.log('2. Open your project: ctujznwjyyqnhecixlon');
  console.log('3. Go to Authentication > Users');
  console.log('4. Click "Add user" > "Create New User"');
  console.log('5. Email: admin@demo.com');
  console.log('6. Password: password123');
  console.log('7. Click "Create User"');
  console.log('\nThen create a profile:');
  console.log('1. Go to Table Editor > profiles');
  console.log('2. Click "Insert row"');
  console.log('3. Set user_id to the auth user ID');
  console.log('4. Set organization_id to: 00000000-0000-0000-0000-000000000001');
  console.log('5. Set role to: owner');
  console.log('6. Set display_name to: Admin User');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createTestUser() {
  try {
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: 'admin@demo.com',
      password: 'password123',
      email_confirm: true
    });

    if (authError) {
      console.error('Error creating auth user:', authError.message);
      return;
    }

    console.log('Auth user created:', authData.user.id);

    // Create profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert({
        user_id: authData.user.id,
        organization_id: '00000000-0000-0000-0000-000000000001',
        role: 'owner',
        display_name: 'Admin User',
        email: 'admin@demo.com'
      })
      .select()
      .single();

    if (profileError) {
      console.error('Error creating profile:', profileError.message);
      return;
    }

    console.log('Profile created:', profile.id);
    console.log('\nTest user ready! You can now login with:');
    console.log('Email: admin@demo.com');
    console.log('Password: password123');
  } catch (err) {
    console.error('Error:', err);
  }
}

createTestUser();

