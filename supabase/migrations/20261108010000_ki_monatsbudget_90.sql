-- Benjamin 08.11.2026: the Max plan's API credit (100 USD a month, linked to "Twista's Individual Org" on 08.11.) is there.
-- Monthly AI cap of the whole app from 20 to 90 USD (10 USD stay free as a buffer, e.g. for Demopin in the same org).
-- The daily cap (ki_tageslimit, 11 USD ≈ 10 €) and the plan budgets per firm stay as they are.
alter table jarvis_katalog.ki_budget drop constraint if exists ki_budget_limit_usd_check;
alter table jarvis_katalog.ki_budget add constraint ki_budget_limit_usd_check check (limit_usd between 0 and 90);
alter table jarvis_katalog.ki_budget alter column limit_usd set default 90;
update jarvis_katalog.ki_budget set limit_usd = 90 where monat >= date_trunc('month', now())::date;
