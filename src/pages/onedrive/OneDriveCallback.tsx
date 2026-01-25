import { useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export function OneDriveCallback() {
  useEffect(() => {
    handleCallback();
  }, []);

  async function handleCallback() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const error = urlParams.get('error');

      if (error) {
        console.error('OAuth error:', error);
        window.close();
        return;
      }

      if (code) {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const { data: { session } } = await supabase.auth.getSession();

        await fetch(`${supabaseUrl}/functions/v1/onedrive-oauth/callback`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code, state: urlParams.get('state') }),
        });

        window.close();
      }
    } catch (error) {
      console.error('Error handling OneDrive callback:', error);
      window.close();
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 dark:from-neutral-900 dark:to-neutral-800">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-neutral-600 dark:text-neutral-400">Connecting to OneDrive...</p>
        <p className="text-sm text-neutral-500 dark:text-neutral-500 mt-2">This window will close automatically</p>
      </div>
    </div>
  );
}
