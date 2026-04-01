-- Update FAQ: replace LicitIA with PRAEFECTUS
UPDATE public.faq
SET pergunta = REPLACE(pergunta, 'LicitIA', 'PRAEFECTUS'),
    resposta = REPLACE(resposta, 'LicitIA', 'PRAEFECTUS')
WHERE pergunta ILIKE '%licitia%' OR resposta ILIKE '%licitia%';

-- Update blog_artigos: replace LicitIA News with PRAEFECTUS News
UPDATE public.blog_artigos
SET autor = 'PRAEFECTUS News'
WHERE autor ILIKE '%licitia%';