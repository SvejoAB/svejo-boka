-- Event colours the owner picked in /admin, as a JSON object like {"free":"#34a853"}. NULL = built-in palette.
ALTER TABLE settings ADD COLUMN colors TEXT;
