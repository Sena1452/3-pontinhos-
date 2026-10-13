# -*- coding: utf-8 -*-
"""Validador do projeto Instituto Tres Pontinhos (uso interno, pode apagar)."""
import os, re, sys

RAIZ = os.path.dirname(os.path.abspath(__file__))
problemas = []
avisos = []


def ler(caminho):
    with open(caminho, encoding='utf-8') as f:
        return f.read()


def tira_regex_literais(js):
    """Substitui regex literais (/abc/g) por marcador, para nao confundir o parser."""
    padrao = re.compile(r"(?<![\w\)\]$])/(?:\\.|\[[^\]\n]*\]|[^/\\\n])+/[gimsuy]*")
    return padrao.sub('REGEX', js)


def remover_regex(valor):
    """Remove um regex literal que comece exatamente nesta posicao. Retorna o fim ou -1."""
    m = re.compile(r"/(?:\\.|\[[^\]\n]*\]|[^/\\\n])+/[gimsuy]*").match(valor)
    return m.end() if m else -1


def tira_strings_e_comentarios(js):
    """Remove strings, template literals e comentarios para checar delimitadores."""
    saida = []
    i, n = 0, len(js)
    while i < n:
        c = js[i]
        prox = js[i + 1] if i + 1 < n else ''
        if c == '/' and prox == '/':
            while i < n and js[i] != '\n':
                i += 1
        elif c == '/' and prox == '*':
            i += 2
            while i + 1 < n and not (js[i] == '*' and js[i + 1] == '/'):
                i += 1
            i += 2
        elif c in '"\'':
            aspas = c
            i += 1
            while i < n and js[i] != aspas:
                if js[i] == '\\':
                    i += 1
                i += 1
            i += 1
        elif c == '`':
            i += 1
            while i < n and js[i] != '`':
                if js[i] == '\\':
                    i += 1
                i += 1
            i += 1
        else:
            if c == '/':
                fim = remover_regex(js[i:])
                if fim > 0:
                    saida.append('REGEX')
                    i += fim
                    continue
            saida.append(c)
            i += 1
    return ''.join(saida)


def checar_balanceamento(nome, codigo):
    limpo = tira_strings_e_comentarios(codigo)
    pares = {')': '(', ']': '[', '}': '{'}
    pilha = []
    for pos, ch in enumerate(limpo):
        if ch in '([{':
            pilha.append((ch, pos))
        elif ch in ')]}':
            if not pilha or pilha[-1][0] != pares[ch]:
                linha = limpo[:pos].count('\n') + 1
                problemas.append(f'{nome}: delimitador "{ch}" sem par na linha ~{linha}')
                return
            pilha.pop()
    if pilha:
        restante = pilha[-1]
        linha = limpo[:restante[1]].count('\n') + 1
        problemas.append(f'{nome}: "{restante[0]}" aberto e nao fechado (linha ~{linha})')


# ---------------------------------------------------------------- JS
arquivos_js = sorted(f for f in os.listdir(os.path.join(RAIZ, 'js')) if f.endswith('.js'))
for arquivo in arquivos_js:
    codigo = ler(os.path.join(RAIZ, 'js', arquivo))
    checar_balanceamento('js/' + arquivo, codigo)

# ---------------------------------------------------------------- CSS
css = ler(os.path.join(RAIZ, 'css', 'estilo.css'))
checar_balanceamento('css/estilo.css', css)
raizes = len(re.findall(r'^\s*:root\s*\{', css, re.M))
if raizes != 1:
    problemas.append(f'css/estilo.css: {raizes} blocos :root (deve ser exatamente 1)')
if '@import' in css:
    problemas.append('css/estilo.css: contem @import (o navegador ignora fora do topo)')

# ---------------------------------------------------------------- HTML
paginas = sorted(f for f in os.listdir(RAIZ) if f.endswith('.html'))
for pagina in paginas:
    html = ler(os.path.join(RAIZ, pagina))
    checar_balanceamento(pagina, html)

    for ref in re.findall(r'(?:src|href)="([^"]+)"', html):
        if ref.startswith(('http', 'mailto:', '#', 'data:', 'tel:')):
            continue
        destino = os.path.join(RAIZ, ref.split('?')[0].split('#')[0])
        if not os.path.exists(destino):
            problemas.append(f'{pagina}: referencia quebrada -> {ref}')

    ids = re.findall(r'\sid="([^"]+)"', html)
    duplicados = sorted({i for i in ids if ids.count(i) > 1})
    if duplicados:
        problemas.append(f'{pagina}: IDs duplicados -> {duplicados}')

    if pagina in ('diretor.html', 'coordenacao.html', 'profissional.html', 'cliente.html'):
        if 'Auth.exigir(' not in html:
            problemas.append(f'{pagina}: SEM guard de rota (Auth.exigir)')
        if 'js/auth.js' not in html:
            problemas.append(f'{pagina}: nao carrega js/auth.js')

    if 'localStorage.clear()' in html:
        problemas.append(f'{pagina}: ainda usa localStorage.clear() (apaga dados da clinica)')

print('=' * 66)
print('RELATORIO DE VALIDACAO - Instituto Tres Pontinhos')
print('=' * 66)
print(f'Paginas HTML : {len(paginas)} -> {", ".join(paginas)}')
print(f'Arquivos JS  : {len(arquivos_js)} -> {", ".join(arquivos_js)}')
print(f'CSS          : {len(css.splitlines())} linhas, {raizes} bloco :root')
print('-' * 66)
if problemas:
    print(f'PROBLEMAS ({len(problemas)}):')
    for p in problemas:
        print('  [X] ' + p)
else:
    print('PROBLEMAS: nenhum')
print('=' * 66)
sys.exit(1 if problemas else 0)