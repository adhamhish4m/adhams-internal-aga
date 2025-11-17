-- Create function to create a campaign and initial lead in one transaction while setting RLS context
create or replace function public.create_campaign_with_initial_lead(
  _client_id text,
  _name text,
  _status text default 'processing',
  _source text default null,
  _lead_count integer default null,
  _personalization_strategy text default null,
  _custom_prompt text default null,
  _instantly_campaign_id text default null
)
returns table (
  campaign_id uuid,
  campaign_name text,
  campaign_lead_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  new_campaign_id uuid;
  new_campaign_name text;
  new_lead_id uuid;
begin
  -- Set the client context for RLS checks within this transaction
  perform set_config('app.current_client_id', _client_id, true);

  -- Insert campaign
  insert into public.campaigns (
    name,
    status,
    user_id,
    source,
    lead_count,
    personalization_strategy,
    custom_prompt,
    instantly_campaign_id
  ) values (
    _name,
    coalesce(_status, 'processing'),
    _client_id,
    _source,
    _lead_count,
    _personalization_strategy,
    _custom_prompt,
    _instantly_campaign_id
  ) returning id, name into new_campaign_id, new_campaign_name;

  -- Create initial lead row with empty data
  insert into public.campaign_leads (campaign_id, lead_data)
  values (new_campaign_id, '{}'::jsonb)
  returning id into new_lead_id;

  campaign_id := new_campaign_id;
  campaign_name := new_campaign_name;
  campaign_lead_id := new_lead_id;
  return next;
end;
$$;

-- Ensure clients can execute the function
grant execute on function public.create_campaign_with_initial_lead(
  text, text, text, text, integer, text, text, text
) to anon, authenticated;
