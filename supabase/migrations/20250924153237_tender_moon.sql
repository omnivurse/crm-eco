@@ .. @@
+-- Set default for origin column to ensure new rows always have a value
+alter table tickets
+  alter column origin set default 'member';
+
 -- Performance indexes for filtering