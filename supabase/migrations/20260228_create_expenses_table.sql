CREATE TABLE expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  motorcycle_id uuid NOT NULL REFERENCES motorcycles(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'other',
  title text NOT NULL,
  cost numeric(10,2) NOT NULL,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view expenses for their vehicles"
  ON expenses FOR SELECT
  USING (
    motorcycle_id IN (
      SELECT m.id FROM motorcycles m
      JOIN collection_members cm ON cm.collection_id = m.collection_id
      WHERE cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert expenses for their vehicles"
  ON expenses FOR INSERT
  WITH CHECK (
    motorcycle_id IN (
      SELECT m.id FROM motorcycles m
      JOIN collection_members cm ON cm.collection_id = m.collection_id
      WHERE cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'editor')
    )
  );

CREATE POLICY "Users can update their own expenses"
  ON expenses FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Users can delete their own expenses"
  ON expenses FOR DELETE
  USING (created_by = auth.uid());
