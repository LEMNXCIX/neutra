-- CANCELADO is the terminal status for orders cancelled while PENDIENTE.
-- Replaying this migration is safe: ADD VALUE raises duplicate_object (42710)
-- if the label was already added out of band, and that error is swallowed.
DO $$
BEGIN
    ALTER TYPE "OrderStatus" ADD VALUE 'CANCELADO';
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
