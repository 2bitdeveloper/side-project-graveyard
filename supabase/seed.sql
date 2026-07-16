insert into public.graves (wallet, name, epitaph, cause, born, died, candles_count, community) values
('the-keeper','TodoApp v3','Survived by seventeen TODO comments and a README.','got a job','2021','2021',41,false),
('the-keeper','Google Reader','A community memorial. Gone, never replaced.','merge conflict with life','2005','2013',213,true),
('the-keeper','Midnight Static','Track four was going to be the single. Nobody ever heard track four.','lost the passion','2022','2023',68,false),
('the-keeper','The Weekly Nothing','Forty-one subscribers. Forty of them were my mom refreshing the page.','the algorithm changed','2023','2023',38,false),
('the-keeper','Kickstart This','The prototype had everything except an ending.','ran out of money','2021','2022',88,false),
('the-keeper','Sourdough & Sons','The starter outlived the business plan.','life got in the way','2022','2023',54,false),
('the-keeper','The Pivot','Eleven videos. The intro song took longer to make than the outro.','got a job','2020','2021',29,false),
('the-keeper','Grandma''s Recipe Book','The recipes are still just Post-its stuck to the fridge.','life got in the way','2019','2022',73,false),
('the-keeper','Chasing Ghosts','Page fourteen was where the plot was supposed to start making sense.','lost the passion','2021','2023',19,false),
('the-keeper','learn-haskell','Understood monads for six whole minutes.','merge conflict with life','2020','2020',33,false),
('the-keeper','Backyard Brewery','Batch three exploded. There was no batch four.','ran out of money','2022','2022',26,false),
('the-keeper','dotfiles-perfect','Still dying, slowly, to this day.','scope creep','2017','—',47,false),
('the-keeper','Open Mic Mondays','Week one had twelve people. Week nine had the host and a very patient bartender.','lost the passion','2022','2023',16,false),
('the-keeper','365 Days of Nowhere','Day forty-two was the last photo. The other three hundred and twenty-three days happened anyway.','perfectionism','2023','2023',22,false)
on conflict do nothing;
