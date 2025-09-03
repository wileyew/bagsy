-- Fix RLS policies for Super Space Users table
CREATE POLICY "Super Space Users can view all records" 
ON "Super Space Users" 
FOR SELECT 
USING (true);

CREATE POLICY "Super Space Users can insert records" 
ON "Super Space Users" 
FOR INSERT 
WITH CHECK (true);