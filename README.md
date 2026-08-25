# Retícula — Atlas de Literatura Científica

Aplicação web que transforma três coordenadas — **tema central**, **assunto** e **disciplina** — em um atlas navegável de literatura científica. O corpus é recuperado de serviços acadêmicos reais, deduplicado e apresentado como rede 3D, cronologia, conceitos, autores, relações e referências rastreáveis.

## O que está incluído

- construtor guiado das três coordenadas de pesquisa;
- interpretação semântica distinta de tema, assunto e disciplina, com consultas adaptadas por base;
- busca simultânea em Semantic Scholar, Crossref, OpenAlex, SciELO, OpenAIRE, Europe PMC/PubMed, arXiv e CORE;
- deduplicação por DOI e título normalizado;
- rede tridimensional de conceitos e autores;
- cronologia do corpus, verbetes, coocorrências e referências;
- tradução opcional das coordenadas de português para inglês;
- fotos de autores obtidas da Wikipedia somente quando a correspondência é confiável;
- transparência sobre proveniência, limites e indisponibilidade das fontes;
- exportação do conjunto filtrado em RIS, BibTeX e CSV de auditoria;
- continuidade explícita de descoberta com o AcademiaOS/Cartographer, sem sincronização automática;
- interface responsiva em português.

## Pré-requisitos

- [Node.js](https://nodejs.org/) 22.13 ou superior;
- [pnpm](https://pnpm.io/) 11 (recomendado via `corepack enable`);
- acesso à internet durante o uso, pois o atlas consulta APIs acadêmicas públicas.

## Instalação reproduzível

```bash
git clone https://github.com/rgbittencourt/reticula-atlas-ideias.git
cd reticula-atlas-ideias
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

Abra o endereço local exibido no terminal. No Windows PowerShell, copie o arquivo de ambiente com:

```powershell
Copy-Item .env.example .env.local
```

As chaves são opcionais: sem elas, a aplicação continua consultando as fontes públicas que não exigem autenticação.

## Variáveis de ambiente

| Variável | Obrigatória | Finalidade |
| --- | --- | --- |
| `SEMANTIC_SCHOLAR_API_KEY` | Não | Aumenta o limite da consulta ao Semantic Scholar. |
| `OPENALEX_API_KEY` | Não | Autentica consultas ao OpenAlex. |
| `CORE_API_KEY` | Não | Habilita a fonte CORE, que exige chave. |

### Cobertura das fontes

O Retícula adapta a consulta ao vocabulário e à sintaxe de cada serviço. Europe PMC / PubMed é priorizado para saúde e biomedicina; arXiv, para computação, física, matemática, engenharia e áreas quantitativas. Em outros recortes, essas bases aparecem como **não priorizadas**, e não como defeituosas.

Semantic Scholar e OpenAlex podem funcionar sem chave, mas aplicam limites mais severos e podem responder com HTTP 429. Para estabilidade, configure `SEMANTIC_SCHOLAR_API_KEY` e `OPENALEX_API_KEY`. A CORE só é ativada com `CORE_API_KEY`. Crossref, SciELO e OpenAIRE permanecem como fontes gerais sem chave obrigatória.

A tradução para inglês usa primeiro a OpenAI para preservar o significado científico das três coordenadas. Se a OpenAI estiver temporariamente indisponível, o servidor tenta os tradutores públicos como contingência.

### Fontes brasileiras, latino-americanas e de acesso aberto

- **Oasisbr / IBICT:** produção científica de repositórios brasileiros. O servidor recebe limite de tempo isolado para não atrasar as demais bases.
- **BDTD / IBICT:** teses e dissertações brasileiras, consultadas e exibidas separadamente do Oasisbr.
- **DOAJ:** artigos de periódicos de acesso aberto.
- **CAPES Dados Abertos:** inclui o catálogo nacional de teses e dissertações. Como a CAPES distribui arquivos anuais, sua incorporação integral depende de uma rotina de indexação periódica, e não de uma consulta HTTP por pesquisa.
- **ERIC:** ativado semanticamente para Educação, ensino, escola e aprendizagem.
- **DataCite:** amplia a descoberta para teses, datasets, relatórios e outros objetos com DOI.
- **LA Referencia:** repositórios científicos da América Latina.
- **Repositórios institucionais brasileiros via OAI-PMH:** representados pelo agregador Oasisbr, evitando consultar centenas de servidores e duplicar registros a cada pesquisa.
| `OPENAI_API_KEY` | Não | Ativa o planejador semântico das três coordenadas; sem ela, usa fallback determinístico. |
| `OPENAI_SEMANTIC_MODEL` | Não | Modelo usado no planejamento semântico (padrão: `gpt-5-mini`). |

Nunca envie `.env.local` ou chaves reais ao GitHub. O `.gitignore` bloqueia arquivos `.env*`, preservando apenas `.env.example`.

## Comandos

```bash
pnpm dev       # desenvolvimento
pnpm build     # compilação de produção
pnpm start     # servidor usando a compilação
pnpm test      # compilação + teste de renderização
pnpm lint      # análise estática
```

## Estrutura

```text
app/
  api/atlas/           recuperação, deduplicação e construção do grafo
  api/author-photos/   retratos acadêmicos via Wikipedia
  api/translate/       tradução das coordenadas
  page.tsx             interface e visualização 3D
  globals.css          identidade visual principal
  enhancements.css     componentes e refinamentos da interface
public/                logos e ícones
tests/                 teste de renderização da aplicação compilada
worker/                entrada compatível com Cloudflare Workers
.openai/hosting.json   configuração de hospedagem no OpenAI Sites
```

## Como o atlas é construído

1. Tema, assunto e disciplina são interpretados em papéis científicos distintos.
2. O planejador cria vocabulário de inclusão/exclusão e consultas específicas para bases gerais, lusófonas, técnicas e biomédicas.
3. O servidor consulta até oito provedores em paralelo com a estratégia adequada a cada um.
4. Registros são unificados por DOI ou título normalizado e ordenados por aderência às coordenadas.
5. As três coordenadas aparecem como nós estruturais do atlas.
6. Termos recorrentes em títulos e campos de estudo formam os conceitos.
7. Dois conceitos são ligados quando aparecem nos mesmos documentos.
8. Autores são conectados aos conceitos sustentados por suas obras no corpus.

As relações representam **coocorrência documental**, não causalidade, consenso científico ou qualidade metodológica. Consulte sempre as fontes originais.

## Interoperabilidade bibliográfica

O Retícula exporta somente os trabalhos que permanecem no filtro ativo. **RIS** é a opção indicada para importadores bibliográficos; **BibTeX** atende fluxos LaTeX e gerenciadores compatíveis; **CSV** é um relatório de auditoria em UTF-8 com BOM, com colunas de proveniência. Em todos os formatos, o projeto preserva título, autores, ano, veículo, DOI, URL, resumo quando disponível, fonte, consulta, coordenadas e horário de exportação.

Para continuar o levantamento no AcademiaOS, use a ação **Abrir no Cartographer** após gerar o atlas. Ela abre uma nova aba com a consulta e o contexto de origem preenchidos. O Retícula também aceita os parâmetros `theme`, `subject`, `discipline` e `from=academiaos` para preconfigurar o construtor quando o acesso partir do Cartographer. Nenhuma dessas ações dispara uma nova busca automaticamente: a execução permanece uma decisão explícita do pesquisador.

## Implantação

O projeto usa [vinext](https://github.com/cloudflare/vinext) e gera saída ESM compatível com Cloudflare Workers/OpenAI Sites:

```bash
pnpm build
```

O artefato é criado em `dist/`. A pasta é ignorada porque deve ser reproduzida a partir do código e do `pnpm-lock.yaml`.

## Créditos

Desenvolvimento: [Rogério G. Bittencourt](https://github.com/rgbittencourt) — [INOVALAB](mailto:inovalab.cte@ifsc.edu.br), IFSC Câmpus Florianópolis-Continente.

## Licença

Distribuído sob a licença MIT. Consulte [LICENSE](LICENSE).
