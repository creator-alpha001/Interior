-- Writes that a customer makes on somebody else's behalf.
--
-- Every policy in 0005 and 0007 was written as `FOR ALL USING (...)` with no
-- WITH CHECK. Postgres then applies the *read* rule to writes as well, which is
-- right almost everywhere and wrong wherever one party's action creates a row
-- that belongs to the other.
--
-- `signAgreement` is exactly that, and it is the largest transaction in the
-- system: a customer signs, and the same transaction activates the contract,
-- creates a project per service with its stages, and raises the **vendor's**
-- commission invoice. The invoice policy says a commission is between the
-- vendor and the platform and no customer sees one — correct, and it was also
-- refusing the customer permission to create it. `POST /me/agreements/:id/sign`
-- answered 500 for every customer with row-level security on.
--
-- The fix is the distinction the feature exists for: USING governs what you can
-- read, WITH CHECK governs what you may write. The read rule is unchanged, so a
-- customer still cannot see a commission figure — they simply may bring one
-- into being as part of signing, and never read it back.

DROP POLICY IF EXISTS invoices_visible ON commission_invoices;
CREATE POLICY invoices_visible ON commission_invoices
  USING (
    (SELECT NOT app_actor_present())
    OR professional_id = (SELECT app_professional_id())
  )
  WITH CHECK (
    (SELECT NOT app_actor_present())
    OR professional_id = (SELECT app_professional_id())
    -- The customer signing the agreement this invoice hangs off. Create only:
    -- the USING clause above still hides every row from them afterwards.
    OR EXISTS (
      SELECT 1 FROM agreements a
      WHERE a.id = commission_invoices.agreement_id
        AND a.client_id = (SELECT app_client_id())
    )
  );

--> statement-breakpoint

-- The same shape, for the same reason: signing notifies the vendor, and
-- accepting or quoting a lead notifies the customer. A notification is always
-- written *for the other party* — that is what a notification is — so the read
-- rule can never be the write rule here.
--
-- Bounded deliberately: a signed-in actor may write a notification addressed to
-- anyone, but may still only ever read their own. The alternative is a
-- correlated check against every relationship that can produce one, which would
-- be a policy nobody could keep correct as notification types are added.
DROP POLICY IF EXISTS notifications_visible ON notifications;
CREATE POLICY notifications_visible ON notifications
  USING (
    (SELECT NOT app_actor_present())
    OR user_id = (SELECT app_user_id())
  )
  WITH CHECK (true);
