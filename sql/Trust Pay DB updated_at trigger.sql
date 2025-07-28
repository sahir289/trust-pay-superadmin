-- Ensure the function exists
CREATE OR REPLACE FUNCTION set_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Dynamic trigger creation for each table
DO $$
DECLARE
    table_rec RECORD;
BEGIN
    -- Loop through each table
    FOR table_rec IN
        SELECT * FROM (VALUES
            ('User'),
            ('Merchant'),
            ('Vendor'),
            ('Role'),
            ('Designation'),
            ('AccessToken'),
            ('UserHierarchy'),
            ('BankAccount'),
            ('Payin'),
            ('Payout'),
            ('Settlement'),
            ('Calculation'),
            ('ChargeBack'),
            ('BankResponse'),
            ('CheckUtrHistory'),
            ('ResetDataHistory'),
            ('Complaints'),
            ('BeneficiaryAccounts'),
            ('Notifications'),
            ('NotificationRecipients')
        ) AS t(table_name)
    LOOP
        -- Drop the trigger if it exists and create a new one for each table
        EXECUTE format('
            DROP TRIGGER IF EXISTS trigger_update_timestamp ON %I;
            CREATE TRIGGER trigger_update_timestamp
            BEFORE UPDATE ON %I
            FOR EACH ROW
            EXECUTE FUNCTION set_updated_at_column();
        ', table_rec.table_name, table_rec.table_name);
    END LOOP;
END;
$$;