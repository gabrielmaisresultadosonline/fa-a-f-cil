-- Run after the local schema in a disposable test database. Always rolls back.
BEGIN;
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
('11111111-1111-4111-8111-111111111111','local-a@example.com','{"name":"Cliente A","whatsapp":"5511999999999"}'),
('22222222-2222-4222-8222-222222222222','local-b@example.com','{"name":"Cliente B","whatsapp":"5511888888888"}');
INSERT INTO public.trial_codes(code) VALUES('LOCAL-TEST');
SELECT public.claim_trial('11111111-1111-4111-8111-111111111111','LOCAL-TEST','local-ip');
DO $$ BEGIN
 IF (SELECT trial_seconds FROM public.saas_accounts WHERE user_id='11111111-1111-4111-8111-111111111111') <> 90 THEN RAISE EXCEPTION 'Trial must grant 90 seconds'; END IF;
 IF EXISTS(SELECT 1 FROM public.user_roles WHERE user_id='11111111-1111-4111-8111-111111111111') THEN RAISE EXCEPTION 'Signup must not grant admin'; END IF;
 IF (SELECT name FROM public.profiles WHERE id='11111111-1111-4111-8111-111111111111') <> 'Cliente A' THEN RAISE EXCEPTION 'Signup profile trigger failed'; END IF;
 BEGIN
  PERFORM public.claim_trial('22222222-2222-4222-8222-222222222222','LOCAL-TEST','local-ip');
  RAISE EXCEPTION 'Second trial on same IP was accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%já utilizou um teste%' THEN RAISE; END IF; END;
END $$;
SELECT public.reserve_generation('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333',30);
SELECT public.reserve_generation('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333',30);
DO $$ BEGIN
 IF (SELECT trial_seconds FROM public.saas_accounts WHERE user_id='11111111-1111-4111-8111-111111111111') <> 60 THEN RAISE EXCEPTION 'Repeated reservation must debit once'; END IF;
END $$;
SELECT public.finish_generation('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333',true);
SELECT public.finish_generation('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333',true);
DO $$ BEGIN
 IF (SELECT trial_seconds FROM public.saas_accounts WHERE user_id='11111111-1111-4111-8111-111111111111') <> 90 THEN RAISE EXCEPTION 'Failed generation refund must restore 90 seconds once'; END IF;
 IF has_function_privilege('authenticated','public.reserve_generation(uuid,uuid,integer)','EXECUTE') THEN RAISE EXCEPTION 'Customer must not call service-only budget reservation'; END IF;
 IF has_table_privilege('authenticated','public.saas_accounts','UPDATE') THEN RAISE EXCEPTION 'Customer must not edit budget'; END IF;
 IF has_table_privilege('authenticated','public.private_settings','SELECT') THEN RAISE EXCEPTION 'Customer must not read provider credentials'; END IF;
END $$;
INSERT INTO public.customer_projects(id,user_id,kind,name,data) VALUES
('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111','motion','Projeto privado','{}');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.customer_projects WHERE id='44444444-4444-4444-8444-444444444444') THEN RAISE EXCEPTION 'Another customer can see private project'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.customer_projects WHERE id='44444444-4444-4444-8444-444444444444') THEN RAISE EXCEPTION 'Owner cannot read own project'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
