-- Add detailed incident fields
ALTER TABLE received_messages ADD COLUMN channel TEXT;
ALTER TABLE received_messages ADD COLUMN if_id TEXT;
ALTER TABLE received_messages ADD COLUMN service_code TEXT;
ALTER TABLE received_messages ADD COLUMN service_name TEXT;
ALTER TABLE received_messages ADD COLUMN biz_system TEXT;
ALTER TABLE received_messages ADD COLUMN error_code TEXT;
ALTER TABLE received_messages ADD COLUMN occurrence_count INTEGER;
ALTER TABLE received_messages ADD COLUMN occurrence_node TEXT;
ALTER TABLE received_messages ADD COLUMN error_message TEXT;
ALTER TABLE received_messages ADD COLUMN occurrence_time DATETIME;

-- Add 20 individual receiver columns
ALTER TABLE received_messages ADD COLUMN receiver_1 TEXT;
ALTER TABLE received_messages ADD COLUMN receiver_2 TEXT;
ALTER TABLE received_messages ADD COLUMN receiver_3 TEXT;
ALTER TABLE received_messages ADD COLUMN receiver_4 TEXT;
ALTER TABLE received_messages ADD COLUMN receiver_5 TEXT;
ALTER TABLE received_messages ADD COLUMN receiver_6 TEXT;
ALTER TABLE received_messages ADD COLUMN receiver_7 TEXT;
ALTER TABLE received_messages ADD COLUMN receiver_8 TEXT;
ALTER TABLE received_messages ADD COLUMN receiver_9 TEXT;
ALTER TABLE received_messages ADD COLUMN receiver_10 TEXT;
ALTER TABLE received_messages ADD COLUMN receiver_11 TEXT;
ALTER TABLE received_messages ADD COLUMN receiver_12 TEXT;
ALTER TABLE received_messages ADD COLUMN receiver_13 TEXT;
ALTER TABLE received_messages ADD COLUMN receiver_14 TEXT;
ALTER TABLE received_messages ADD COLUMN receiver_15 TEXT;
ALTER TABLE received_messages ADD COLUMN receiver_16 TEXT;
ALTER TABLE received_messages ADD COLUMN receiver_17 TEXT;
ALTER TABLE received_messages ADD COLUMN receiver_18 TEXT;
ALTER TABLE received_messages ADD COLUMN receiver_19 TEXT;
ALTER TABLE received_messages ADD COLUMN receiver_20 TEXT;
