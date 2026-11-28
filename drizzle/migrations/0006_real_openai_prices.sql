ALTER TABLE public.usage_costs ADD COLUMN IF NOT EXISTS cached_input_tokens integer NOT NULL DEFAULT 0;
ALTER TABLE public.app_settings ALTER COLUMN prices SET DEFAULT '{"dolar":5.5,"modelos":{"gpt-6.1-terra":{"saida":5,"entrada":1,"cache":0.05}},"vozMilChars":0.3,"transcricaoMin":0.006}'::jsonb;
UPDATE public.app_settings SET prices = jsonb_set(prices,'{modelos,gpt-6.1-terra}','{"entrada":1,"saida":5,"cache":0.05}'::jsonb,true)
  WHERE coalesce((prices->'modelos'->'gpt-6.1-terra'->>'entrada')::numeric,5)=5 AND coalesce((prices->'modelos'->'gpt-6.1-terra'->>'saida')::numeric,20)=20;
CREATE OR REPLACE FUNCTION public.usage_cost_usd(c public.usage_costs, s public.app_settings)
 RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $function$ SELECT CASE WHEN c.kind='ia' THEN (
    greatest(c.input_tokens-c.cached_input_tokens,0)*coalesce((s.prices->'modelos'->c.model->>'entrada')::numeric,0)
  + c.cached_input_tokens*coalesce((s.prices->'modelos'->c.model->>'cache')::numeric,(s.prices->'modelos'->c.model->>'entrada')::numeric*0.05,0)
  + c.output_tokens*coalesce((s.prices->'modelos'->c.model->>'saida')::numeric,0))/1000000
  WHEN c.kind='transcricao' THEN c.units*coalesce((s.prices->>'transcricaoMin')::numeric,0) ELSE 0 END $function$;
REVOKE ALL ON FUNCTION public.usage_cost_usd(public.usage_costs, public.app_settings) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.usage_cost_usd(public.usage_costs, public.app_settings) TO authenticated;
CREATE OR REPLACE FUNCTION public.admin_cost_totals()
 RETURNS jsonb LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$ SELECT jsonb_build_object('total_usd',coalesce(sum(public.usage_cost_usd(c,s)),0)) FROM public.usage_costs c CROSS JOIN public.app_settings s WHERE s.id=true AND public.has_role(auth.uid(),'admin') $function$;
CREATE OR REPLACE FUNCTION public.admin_customer_costs(p_offset integer DEFAULT 0)
 RETURNS TABLE(user_id uuid, generations bigint, trial_generations bigint, total_usd numeric, trial_usd numeric)
 LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$ WITH costs AS (SELECT c.user_id,g.trial,public.usage_cost_usd(c,s) AS usd FROM public.usage_costs c LEFT JOIN public.generations g ON g.id=c.generation_id CROSS JOIN public.app_settings s WHERE s.id=true) SELECT p.id,(SELECT count(*) FROM public.generations g WHERE g.user_id=p.id),(SELECT count(*) FROM public.generations g WHERE g.user_id=p.id AND g.trial),coalesce(sum(c.usd),0),coalesce(sum(c.usd) FILTER(WHERE c.trial),0) FROM public.profiles p LEFT JOIN costs c ON c.user_id=p.id WHERE public.has_role(auth.uid(),'admin') GROUP BY p.id,p.created_at ORDER BY p.created_at DESC OFFSET greatest(0,p_offset) LIMIT 25 $function$;