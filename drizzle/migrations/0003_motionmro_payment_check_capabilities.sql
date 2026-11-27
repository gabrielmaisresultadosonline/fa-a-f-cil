CREATE TABLE public.payment_check_keys (order_id uuid PRIMARY KEY REFERENCES public.payment_orders(id) ON DELETE CASCADE, key_hash text NOT NULL);
GRANT ALL ON public.payment_check_keys TO service_role;
ALTER TABLE public.payment_check_keys ENABLE ROW LEVEL SECURITY;