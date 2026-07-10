-- =====================================================================
-- Founding graves — run once after schema.sql.
-- These keep the cemetery populated at launch. Buried by 'the-keeper'
-- (not a real wallet), so nobody can claim or resurrect them except
-- via manual SQL. candles_count is set directly as flavor; real candles
-- accrue on top through the candles table + trigger.
-- =====================================================================

insert into public.graves (wallet, name, epitaph, cause, born, died, candles_count, community) values
('the-keeper','TodoApp v3','Survived by seventeen TODO comments and a README.','got a job','2021','2021',41,false),
('the-keeper','Google Reader','A community memorial. Gone, never replaced.','merge conflict with life','2005','2013',213,true),
('the-keeper','MyOwnJSFramework','Faster than React in exactly one benchmark.','new shiny framework','2020','2023',67,false),
('the-keeper','CryptoPortfolioTracker','Tracked the losses with perfect accuracy.','it actually worked and I got bored','2022','2022',38,false),
('the-keeper','GameEngine3D','Rendered one triangle. It was beautiful.','scope creep','2019','2022',88,false),
('the-keeper','blog-rewrite-v7','Four static site generators. Zero posts.','new shiny framework','2018','2024',54,false),
('the-keeper','AIStartupIdea.docx','Pivoted fourteen times before the first commit.','scope creep','2023','2023',29,false),
('the-keeper','recipe-app-for-mom','She still uses the notebook.','got a job','2021','2024',73,false),
('the-keeper','HabitTracker','Streak: 2 days.','the tutorial ended','2022','2022',19,false),
('the-keeper','learn-haskell','Understood monads for six whole minutes.','merge conflict with life','2020','2020',33,false),
('the-keeper','NFTMarketplace','Right idea. Wrong everything.','AWS bill','2022','2022',26,false),
('the-keeper','dotfiles-perfect','Still dying, slowly, to this day.','scope creep','2017','—',47,false),
('the-keeper','discord-clone-but-better','The ''better'' part remains theoretical.','scope creep','2021','2022',15,false),
('the-keeper','saas-boilerplate','The boilerplate WAS the product.','it actually worked and I got bored','2023','2023',22,false)
on conflict do nothing;
