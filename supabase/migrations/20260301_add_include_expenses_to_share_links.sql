ALTER TABLE collection_share_links ADD COLUMN include_expenses boolean NOT NULL DEFAULT false;
ALTER TABLE vehicle_share_links ADD COLUMN include_expenses boolean NOT NULL DEFAULT false;
