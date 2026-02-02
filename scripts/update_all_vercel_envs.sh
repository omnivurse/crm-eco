#!/bin/bash

# New Supabase credentials
SUPABASE_URL="https://sffisarikcreyyjzdjvb.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmZmlzYXJpa2NyZXl5anpkanZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5ODQ3ODEsImV4cCI6MjA4NTU2MDc4MX0.rck4vrOC5ciGEO2on8Ub5WsFDGPT1QVonDBxElTeUaY"
SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmZmlzYXJpa2NyZXl5anpkanZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTk4NDc4MSwiZXhwIjoyMDg1NTYwNzgxfQ.u44_1gOevgzL9A5-ivODJOxC7jEK3no--TseswufCiU"

# Projects to update
PROJECTS="crm-eco-admin crm-eco-portal advisor-portal portal crm-eco admin"

for PROJECT in $PROJECTS; do
  echo "=========================================="
  echo "Updating project: $PROJECT"
  echo "=========================================="

  # Link to project
  npx vercel link --project "$PROJECT" --yes 2>/dev/null

  # Remove old vars (ignore errors if they don't exist)
  echo "y" | npx vercel env rm NEXT_PUBLIC_SUPABASE_URL production 2>/dev/null
  echo "y" | npx vercel env rm NEXT_PUBLIC_SUPABASE_ANON_KEY production 2>/dev/null
  echo "y" | npx vercel env rm SUPABASE_SERVICE_ROLE_KEY production 2>/dev/null

  # Add new vars
  echo "$SUPABASE_URL" | npx vercel env add NEXT_PUBLIC_SUPABASE_URL production 2>/dev/null
  echo "$ANON_KEY" | npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production 2>/dev/null
  echo "$SERVICE_KEY" | npx vercel env add SUPABASE_SERVICE_ROLE_KEY production 2>/dev/null

  echo "Done with $PROJECT"
  echo ""
done

echo "All projects updated!"
