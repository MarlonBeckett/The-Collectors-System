CREATE TABLE public.vehicle_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  motorcycle_id uuid NOT NULL REFERENCES public.motorcycles(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  name text,
  include_vin boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  last_accessed_at timestamptz
);

CREATE INDEX idx_vehicle_share_links_motorcycle_id ON public.vehicle_share_links(motorcycle_id);

ALTER TABLE public.vehicle_share_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner and editors can manage vehicle share links" ON public.vehicle_share_links
  FOR ALL
  USING (
    (motorcycle_id IN (
      SELECT m.id FROM motorcycles m
      JOIN collections c ON c.id = m.collection_id
      WHERE c.owner_id = auth.uid()
    ))
    OR
    (motorcycle_id IN (
      SELECT m.id FROM motorcycles m
      JOIN collection_members cm ON cm.collection_id = m.collection_id
      WHERE cm.user_id = auth.uid() AND cm.role = 'editor'
    ))
  )
  WITH CHECK (
    (motorcycle_id IN (
      SELECT m.id FROM motorcycles m
      JOIN collections c ON c.id = m.collection_id
      WHERE c.owner_id = auth.uid()
    ))
    OR
    (motorcycle_id IN (
      SELECT m.id FROM motorcycles m
      JOIN collection_members cm ON cm.collection_id = m.collection_id
      WHERE cm.user_id = auth.uid() AND cm.role = 'editor'
    ))
  );
