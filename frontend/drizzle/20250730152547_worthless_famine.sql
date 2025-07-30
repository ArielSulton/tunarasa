DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='notes' AND column_name='title') THEN
        ALTER TABLE "notes" ADD COLUMN "title" varchar(255);
    END IF;
END $$;