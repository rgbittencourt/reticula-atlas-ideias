# Verificação pública de interoperabilidade — 2026-08-25

## Escopo observado

O endereço público `https://reticula-atlas-ideias.rogerio-bittencourt-1a9.workers.dev/` respondeu normalmente e apresentou a capa institucional do Retícula com título, autoria, assinaturas IFSC–INOVALAB e ação de início de pesquisa.

Ao abrir o formulário, a interface exibiu as três coordenadas de pesquisa — **Tema central**, **Assunto** e **Disciplina** — com exemplos coerentes e ação explícita para construir o atlas. A experiência não executa busca automática ao entrar no formulário; a pesquisa exige a ação do pesquisador.

Foi também verificado o deep link público com `from=academiaos`: os parâmetros `theme`, `subject` e `discipline` preencheram os três campos corretamente, mantendo o botão de construção do atlas como a única ação que inicia a pesquisa.

## Limite da verificação pública

As ações de exportação BibTeX/CSV e de continuidade com o Cartographer aparecem após a construção de um atlas. Esta inspeção não criou uma consulta nem dados acadêmicos para fins de QA; esses contratos foram validados pela suíte automatizada do projeto.
