# 🚀 Deployment Fix Checklist

## ❌ **Current Issue**
Assessment links show "Invalid assessment link or assessment not found" because:
1. Local changes haven't been deployed to Vercel
2. Environment variables might not be configured in Vercel
3. Database changes (RLS policies, new column) might not be applied to production

## 🔧 **Required Steps to Fix**

### **1. Deploy Code Changes**
```bash
# Commit and push all the changes we made
git add .
git commit -m "Fix candidate assessment issues: add RLS policies, service role authentication, assigned_question_id column"
git push origin main
```

### **2. Configure Environment Variables in Vercel**
Go to your Vercel dashboard and add these environment variables:

**Required Variables:**
- `VITE_SUPABASE_URL` = `https://tgtbfkxjvfwzjgcqucgj.supabase.co`
- `VITE_SUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRndGJma3hqdmZ3empnY3F1Y2dqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY3NzEyNzgsImV4cCI6MjA0MjM0NzI3OH0.C-uVTU7E9xQfZMQDHjvL25fz_VqDi0Vx8zq1TpbLIJw`
- `VITE_SUPABASE_SERVICE_ROLE_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRndGJma3hqdmZ3empnY3F1Y2dqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyNjc3MTI3OCwiZXhwIjoyMDQyMzQ3Mjc4fQ.6w99Ie2YlokHZ8sO8hCGvwKXJxN82SdHqJzP0K8_vbo`

**How to add in Vercel:**
1. Go to https://vercel.com/dashboard
2. Click on your project (voixnaccent)
3. Go to Settings → Environment Variables
4. Add each variable above

### **3. Apply Database Changes**
Run these SQL scripts in your Supabase dashboard:

**A. Add missing column:**
```sql
-- Add assigned_question_id column
ALTER TABLE public.candidates 
ADD COLUMN assigned_question_id uuid REFERENCES public.questions(id);

CREATE INDEX idx_candidates_assigned_question_id ON public.candidates(assigned_question_id);
```

**B. Apply RLS policies:**
Run the entire `setup_rls_policies.sql` script we created.

### **4. Verify Database Data**
Make sure you have:
- ✅ Questions in the `questions` table with `is_active = true`
- ✅ Candidate record with the assessment_link_id `3a270a91-8958-43d5-8526-a3295037e65e`

### **5. Test the Deployment**
After deploying:
1. Visit the assessment link again
2. Check browser console for our debug messages
3. Verify the candidate is found and assessment loads

## 🔍 **Quick Debug Commands**

### Check if candidate exists:
```sql
SELECT * FROM candidates WHERE assessment_link_id = '3a270a91-8958-43d5-8526-a3295037e65e';
```

### Check active questions:
```sql
SELECT * FROM questions WHERE is_active = true;
```

### Check RLS policies:
```sql
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, policyname;
```

## 🎯 **Root Cause Summary**

The issue is likely that:
1. **Missing service role key** in Vercel environment variables
2. **Code changes** haven't been deployed to production
3. **Database changes** (RLS policies, new column) not applied to production database

Once you complete steps 1-4 above, the assessment link should work!

## 🚨 **If Still Not Working**

If the issue persists after deployment:
1. Check Vercel function logs for errors
2. Check browser console for debug messages we added
3. Verify environment variables are set correctly in Vercel
4. Double-check that the candidate record exists in the production database
